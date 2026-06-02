import { basename } from "path";
import { AppDataSource } from "../../core/config/database";
import { Invoice } from "../../shared/entities/Invoice";
import { InvoiceStatus, PaymentMethod } from "../../shared/entities/EntityEnums";
import { School } from "../../shared/entities/School";
import { BankAccount } from "../../shared/entities/BankAccount";
import { Parent } from "../../shared/entities/Parent";
import { emailService } from "../../shared/services/email.service";
import { pdfService } from "../../shared/services/pdf.service";
import { logger } from "../../shared/utils/logger";
import { notificationService } from "../../notification";
import { NotificationType } from "../../shared/entities/Notification";
import { invoicePaymentGatewayService } from "./invoice-payment-gateway.service";
import {
  BankDetails,
  InvoiceEmailAttachment,
  InvoiceEmailContext,
  InvoiceEmailCustomization,
  SendInvoiceEmailResult,
  SendInvoiceIssuedOptions,
  SendInvoiceReceiptOptions,
  SendInvoiceReminderOptions,
  SendInvoiceUpdatedOptions,
} from "./invoice-email.types";

const INVOICE_RELATIONS = [
  "items",
  "student",
  "student.user",
  "student.parents",
  "student.parents.user",
  "parents",
  "parents.user",
  "school",
] as const;

const NON_BANK_PAYMENT_METHODS = new Set<string>([
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.OTHER,
]);

function isBankPaymentMethod(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  return !NON_BANK_PAYMENT_METHODS.has(String(paymentMethod).trim().toLowerCase());
}

// Soft-deleted users have their email mutated with a "[deleted]" marker (or a
// trailing "deleted" suffix) so the original address can be reused later.
// These addresses must never receive invoice emails.
function isTombstonedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = String(email).trim();
  if (!normalized) return false;
  if (/\[deleted\]/i.test(normalized)) return true;
  if (/deleted\s*$/i.test(normalized)) return true;
  return false;
}

// Friendly label shown on the email body / receipt, mirroring the frontend
// `formatPaymentMethodLabel` helper. Cash invoices fall back to "Cash" so
// the recipient always sees a payment method line.
function formatPaymentMethodLabel(paymentMethod?: string | null): string {
  const normalized = String(paymentMethod || "").trim().toLowerCase();
  if (!normalized) return "Cash";
  if (normalized === "card") return "Online Payment";
  if (normalized === "transfer" || normalized === "bank_transfer") return "Transfer";
  if (normalized === "cash") return "Cash";
  if (normalized === "cheque") return "Cheque";
  if (normalized === "other") return "Other";
  return normalized
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

class InvoiceEmailService {
  private contentTypeToExtension(contentType: string): string {
    const normalized = contentType.split(";")[0]?.trim().toLowerCase();
    if (normalized === "application/pdf") return "pdf";
    if (normalized === "image/png") return "png";
    if (normalized === "image/jpeg") return "jpg";
    if (normalized === "image/webp") return "webp";
    if (normalized === "text/plain") return "txt";
    return "bin";
  }

  async resolveBankDetailsForSchool(
    schoolId: number,
    bankAccountId?: number | null,
    paymentMethod?: string | null,
  ): Promise<BankDetails | undefined> {
    // Cash / card / other invoices should never advertise bank details on the
    // PDF or in the email body. Skip the lookup entirely so the template
    // falls into its "no bank" branch.
    if (paymentMethod !== undefined && !isBankPaymentMethod(paymentMethod)) {
      return undefined;
    }
    try {
      const bankAccountWhere = bankAccountId != null ? { id: bankAccountId, schoolId } : { schoolId, isDefault: true };
      const bankAccount = await AppDataSource.getRepository(BankAccount).findOne({ where: bankAccountWhere });
      if (bankAccount?.bankName && bankAccount.accountNumber && bankAccount.accountName) {
        return {
          bankName: bankAccount.bankName,
          accountNumber: bankAccount.accountNumber,
          accountName: bankAccount.accountName,
        };
      }
    } catch (e) {
      logger.error(`Failed to load bank account for school ${schoolId}:`, e);
    }
    return undefined;
  }

  async resolveAttachmentRefs(attachmentRefs?: string[]): Promise<InvoiceEmailAttachment[]> {
    if (!attachmentRefs || attachmentRefs.length === 0) return [];
    const resolved: InvoiceEmailAttachment[] = [];

    for (let i = 0; i < attachmentRefs.length; i++) {
      const ref = String(attachmentRefs[i] || "").trim();
      if (!ref) continue;

      try {
        if (ref.startsWith("data:")) {
          const match = ref.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) continue;
          const contentType = match[1] || "application/octet-stream";
          resolved.push({
            filename: `Attachment_${i + 1}.${this.contentTypeToExtension(contentType)}`,
            content: Buffer.from(match[2] || "", "base64"),
            contentType,
          });
          continue;
        }

        if (ref.startsWith("http://") || ref.startsWith("https://")) {
          const response = await fetch(ref);
          if (!response.ok) {
            logger.warn(`Skipping attachment URL (status ${response.status}): ${ref}`);
            continue;
          }
          const arrayBuffer = await response.arrayBuffer();
          const contentType = response.headers.get("content-type") || "application/octet-stream";
          const parsedName = basename(new URL(ref).pathname);
          const ext = this.contentTypeToExtension(contentType);
          resolved.push({
            filename: parsedName && parsedName !== "/" ? parsedName : `Attachment_${i + 1}.${ext}`,
            content: Buffer.from(arrayBuffer),
            contentType,
          });
        }
      } catch (error) {
        logger.warn(`Failed to resolve attachment reference at index ${i}`, error);
      }
    }

    return resolved;
  }

  private mapItems(invoice: Invoice) {
    return (
      invoice.items?.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        rate: Number(item.rate),
      })) || []
    );
  }

  private getStudentName(invoice: Invoice): string {
    if (invoice.student?.user) {
      return `${invoice.student.user.firstName || ""} ${invoice.student.user.lastName || ""}`.trim() || "your child";
    }
    return "your child";
  }

  private getParentDisplayName(parent: { user?: { firstName?: string; lastName?: string } | null }): string {
    if (!parent.user) return "Parent";
    return `${parent.user.firstName || ""} ${parent.user.lastName || ""}`.trim() || "Parent";
  }

  async loadContext(invoiceId: number, schoolId: number): Promise<InvoiceEmailContext | null> {
    const invoice = await AppDataSource.getRepository(Invoice).findOne({
      where: { id: invoiceId, schoolId },
      relations: [...INVOICE_RELATIONS],
    });

    if (!invoice) return null;

    const school =
      invoice.school || (await AppDataSource.getRepository(School).findOne({ where: { id: schoolId } }));
    if (!school) return null;

    const bankDetails = await this.resolveBankDetailsForSchool(
      schoolId,
      invoice.bankAccountId,
      invoice.paymentMethod,
    );

    return {
      invoice,
      school,
      studentName: this.getStudentName(invoice),
      bankDetails,
      items: this.mapItems(invoice),
    };
  }

  resolveRecipients(ctx: InvoiceEmailContext, emailOverride?: string[]): string[] {
    const toRecipients =
      Array.isArray(emailOverride) && emailOverride.length > 0
        ? emailOverride
        : [
            ...(ctx.invoice.parents?.map((p) => p?.user?.email) || []),
            ...(ctx.invoice.student?.parents?.map((p) => p?.user?.email) || []),
          ];

    return Array.from(
      new Set(
        toRecipients
          .map((e) => (e || "").trim())
          .filter((e) => e.length > 0 && !isTombstonedEmail(e))
          .map((e) => e.toLowerCase()),
      ),
    );
  }

  private resolvePayerEmail(ctx: InvoiceEmailContext, recipients: string[]): string | undefined {
    const candidates = [
      ctx.invoice.parents?.[0]?.user?.email,
      ctx.invoice.student?.parents?.[0]?.user?.email,
      ctx.school.email,
      recipients[0],
    ];
    return candidates.find((email) => !!email && !isTombstonedEmail(email)) || undefined;
  }

  async resolvePayNowUrl(ctx: InvoiceEmailContext, payerEmail?: string): Promise<string | undefined> {
    try {
      return await invoicePaymentGatewayService.buildPayNowUrlIfAvailable(
        ctx.invoice.id,
        payerEmail || ctx.school.email,
      );
    } catch (error) {
      logger.error(`Failed to build pay-now URL for invoice ${ctx.invoice.id}:`, error);
      return undefined;
    }
  }

  async buildPdfAttachment(
    ctx: InvoiceEmailContext,
    payNowUrl?: string,
  ): Promise<InvoiceEmailAttachment | undefined> {
    try {
      const pdfBuffer = await pdfService.generateInvoicePDF(
        ctx.invoice as Invoice,
        ctx.school,
        ctx.bankDetails,
        payNowUrl,
      );
      return {
        filename: `Invoice_${ctx.invoice.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      };
    } catch (error) {
      logger.error(`Failed to generate invoice PDF for ${ctx.invoice.invoiceNumber}:`, error);
      return undefined;
    }
  }

  private mergeCustomization(
    options: { subject?: string; body?: string; emailCustomization?: InvoiceEmailCustomization },
  ): InvoiceEmailCustomization | undefined {
    const subject = options.subject ?? options.emailCustomization?.subject;
    const body = options.body ?? options.emailCustomization?.body;
    if (!subject && !body) return options.emailCustomization;
    return { ...(subject ? { subject } : {}), ...(body ? { body } : {}) };
  }

  private async sendIssuedOrUpdated(
    ctx: InvoiceEmailContext,
    options: SendInvoiceIssuedOptions | SendInvoiceUpdatedOptions,
    variant: "issued" | "updated",
  ): Promise<SendInvoiceEmailResult> {
    const parentRecipients = this.resolveRecipients(ctx, options.email);
    const hasRecipients =
      parentRecipients.length > 0 || (options.additionalEmails?.length ?? 0) > 0;
    if (!hasRecipients) {
      return { success: false, message: "No recipient email found for this invoice" };
    }

    const payerEmail = this.resolvePayerEmail(ctx, parentRecipients);
    const payNowUrl = await this.resolvePayNowUrl(ctx, payerEmail);
    const pdfAttachment = await this.buildPdfAttachment(ctx, payNowUrl);
    const extraAttachments = await this.resolveAttachmentRefs(options.attachments);
    const attachments = [...(pdfAttachment ? [pdfAttachment] : []), ...extraAttachments];

    const customization = this.mergeCustomization({
      subject: options.subject,
      body: options.body,
      emailCustomization: options.emailCustomization,
    });

    const schoolName = ctx.school.schoolName || "School";
    const paymentMethodLabel = formatPaymentMethodLabel(ctx.invoice.paymentMethod);
    const sentEmails = new Set<string>();
    const linkedParents = new Map<number, Parent>();
    for (const parent of [...(ctx.invoice.parents || []), ...(ctx.invoice.student?.parents || [])]) {
      if (parent?.userId) linkedParents.set(parent.userId, parent);
    }

    const sendToAddress = async (to: string, parentName: string) => {
      const normalized = to.trim().toLowerCase();
      if (sentEmails.has(normalized)) return;
      sentEmails.add(normalized);

      await emailService.sendInvoiceEmailToParent(
        to,
        parentName,
        ctx.studentName,
        ctx.invoice.invoiceNumber,
        ctx.invoice.issueDate,
        ctx.invoice.dueDate,
        Number(ctx.invoice.total),
        Number(ctx.invoice.amountPaid),
        Number(ctx.invoice.balance),
        ctx.items,
        schoolName,
        ctx.invoice.notes || undefined,
        ctx.invoice.id,
        ctx.school.subDomain,
        attachments.length > 0 ? attachments : undefined,
        ctx.bankDetails,
        customization,
        variant,
        paymentMethodLabel,
        payNowUrl,
      );
    };

    for (const parent of linkedParents.values()) {
      if (parent.user?.email && !isTombstonedEmail(parent.user.email)) {
        try {
          await sendToAddress(parent.user.email, this.getParentDisplayName(parent));
          if (options.sendInApp !== false && parent.userId) {
            const title = variant === "updated" ? "Invoice Updated" : "New Invoice Received";
            const message =
              variant === "updated"
                ? `Invoice ${ctx.invoice.invoiceNumber} for ${ctx.studentName} has been updated.`
                : `A new invoice ${ctx.invoice.invoiceNumber} for ${ctx.studentName} has been issued.`;
            await notificationService
              .sendNotification({
                userId: parent.userId,
                schoolId: options.schoolId,
                title,
                message,
                type: NotificationType.INVOICE,
                data: { invoiceId: ctx.invoice.id },
                sendEmail: false,
              })
              .catch((err) => logger.error(`Failed to send in-app notification for invoice ${ctx.invoice.id}`, err));
          }
        } catch (error) {
          logger.error(`Failed to send invoice email to parent ${parent.user.email}:`, error);
        }
      }
    }

    if (options.additionalEmails?.length) {
      for (const extraEmail of options.additionalEmails) {
        if (isTombstonedEmail(extraEmail)) {
          logger.warn(
            `Skipping tombstoned additional recipient for invoice ${ctx.invoice.id}: ${extraEmail}`,
          );
          continue;
        }
        try {
          await sendToAddress(extraEmail, "Recipient");
        } catch (error) {
          logger.error(`Failed to send invoice email to additional recipient ${extraEmail}:`, error);
        }
      }
    }

    return {
      success: true,
      message: variant === "updated" ? "Invoice update email sent successfully" : "Invoice email sent successfully",
      recipients: Array.from(sentEmails),
    };
  }

  async sendIssued(options: SendInvoiceIssuedOptions): Promise<SendInvoiceEmailResult> {
    const ctx = await this.loadContext(options.invoiceId, options.schoolId);
    if (!ctx) return { success: false, message: "Invoice not found" };
    return this.sendIssuedOrUpdated(ctx, options, "issued");
  }

  async sendUpdated(options: SendInvoiceUpdatedOptions): Promise<SendInvoiceEmailResult> {
    const ctx = await this.loadContext(options.invoiceId, options.schoolId);
    if (!ctx) return { success: false, message: "Invoice not found" };
    return this.sendIssuedOrUpdated(ctx, options, "updated");
  }

  async sendReminder(options: SendInvoiceReminderOptions): Promise<SendInvoiceEmailResult> {
    const ctx = await this.loadContext(options.invoiceId, options.schoolId);
    if (!ctx) return { success: false, message: "Invoice not found" };

    const recipients = this.resolveRecipients(ctx, options.email);
    if (recipients.length === 0) {
      return { success: false, message: "No recipient email found for this invoice" };
    }

    const payerEmail = this.resolvePayerEmail(ctx, recipients);
    const payNowUrl = await this.resolvePayNowUrl(ctx, payerEmail);
    const pdfAttachment = await this.buildPdfAttachment(ctx, payNowUrl);
    const extraAttachments = await this.resolveAttachmentRefs(options.attachments);
    const attachments = [...(pdfAttachment ? [pdfAttachment] : []), ...extraAttachments];

    const recipientName =
      ctx.invoice.parents?.[0]?.user ? this.getParentDisplayName(ctx.invoice.parents[0]) : "Parent";

    await emailService.sendInvoiceReminderEmail({
      to: recipients,
      recipientName,
      studentName: ctx.studentName,
      invoiceNumber: ctx.invoice.invoiceNumber,
      dueDate: ctx.invoice.dueDate,
      total: Number(ctx.invoice.total || 0),
      amountPaid: Number(ctx.invoice.amountPaid || 0),
      balance: Number(ctx.invoice.balance || 0),
      schoolName: ctx.school.schoolName || "School",
      subject: options.subject,
      body: options.body,
      attachments: attachments.length > 0 ? attachments : undefined,
      paymentMethodLabel: formatPaymentMethodLabel(ctx.invoice.paymentMethod),
      payNowUrl,
    });

    if (options.sendInApp !== false) {
      const parents = new Map<number, Parent>();
      for (const p of ctx.invoice.parents || []) {
        if (p.userId) parents.set(p.userId, p);
      }
      for (const p of ctx.invoice.student?.parents || []) {
        if (p.userId) parents.set(p.userId, p);
      }

      const title = options.inAppTitle || "Invoice Reminder";
      const message =
        options.inAppMessage ||
        `Reminder: invoice ${ctx.invoice.invoiceNumber} for ${ctx.studentName}. Amount due: ${ctx.invoice.balance}.`;

      for (const parent of parents.values()) {
        await notificationService
          .sendNotification({
            userId: parent.userId,
            schoolId: options.schoolId,
            title,
            message,
            type: NotificationType.INVOICE,
            data: { invoiceId: ctx.invoice.id },
            sendEmail: false,
          })
          .catch((err) => logger.error(`Failed to send in-app invoice reminder to parent ${parent.userId}`, err));
      }
    }

    return {
      success: true,
      message: "Invoice reminder sent successfully",
      recipients,
    };
  }

  async sendReceipt(options: SendInvoiceReceiptOptions): Promise<SendInvoiceEmailResult> {
    const ctx = await this.loadContext(options.invoiceId, options.schoolId);
    if (!ctx) return { success: false, message: "Invoice not found" };

    const schoolName = ctx.school.schoolName || "School";
    const sentEmails: string[] = [];

    for (const parent of ctx.invoice.parents || []) {
      if (!parent.user?.email) continue;
      if (isTombstonedEmail(parent.user.email)) {
        logger.warn(
          `Skipping receipt for tombstoned parent email on invoice ${ctx.invoice.id}: ${parent.user.email}`,
        );
        continue;
      }
      const parentName = this.getParentDisplayName(parent);

      try {
        await emailService.sendPaymentReceiptEmail(
          parent.user.email,
          parentName,
          ctx.studentName,
          ctx.invoice.invoiceNumber,
          options.amountPaid,
          options.paymentDate,
          options.paymentMethod,
          ctx.items,
          options.balance,
          schoolName,
          ctx.invoice.id,
          ctx.school.subDomain,
        );
        sentEmails.push(parent.user.email.toLowerCase());

        if (options.sendInApp !== false && parent.userId) {
          await notificationService
            .sendNotification({
              userId: parent.userId,
              schoolId: options.schoolId,
              title: "Payment Received",
              message: `Your payment of ${options.amountPaid} for invoice ${ctx.invoice.invoiceNumber} (${ctx.studentName}) has been received.`,
              type: NotificationType.PAYMENT,
              data: { invoiceId: ctx.invoice.id },
              sendEmail: false,
            })
            .catch((err) => logger.error("Failed to send payment notification to parent", err));
        }
      } catch (error) {
        logger.error(`Failed to send receipt email to ${parent.user.email}:`, error);
      }
    }

    if (options.sendInApp !== false) {
      await notificationService
        .notifyAdmins({
          schoolId: options.schoolId,
          title: "Payment Recorded",
          message: `A payment of ${options.amountPaid} has been recorded for invoice ${ctx.invoice.invoiceNumber} (${ctx.studentName}).`,
          type: NotificationType.PAYMENT,
          data: { invoiceId: ctx.invoice.id },
        })
        .catch((err) => logger.error("Failed to notify admins of payment", err));
    }

    return {
      success: true,
      message: "Payment receipt email sent",
      recipients: sentEmails,
    };
  }

  async markSentIfSaved(invoiceId: number, schoolId: number): Promise<void> {
    const repo = AppDataSource.getRepository(Invoice);
    const invoice = await repo.findOne({ where: { id: invoiceId, schoolId } });
    if (!invoice) return;
    if (invoice.status !== InvoiceStatus.SAVED) return;
    await repo.update({ id: invoiceId, schoolId }, { status: InvoiceStatus.SENT });
    logger.info(`Invoice ${invoiceId} status updated from saved to sent`);
  }
}

export const invoiceEmailService = new InvoiceEmailService();
