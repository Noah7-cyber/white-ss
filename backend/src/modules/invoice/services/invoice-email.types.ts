import { Invoice } from "../../shared/entities/Invoice";
import { School } from "../../shared/entities/School";
import { PaymentMethod } from "../../shared/entities/EntityEnums";

export type InvoiceEmailKind = "issued" | "updated" | "reminder" | "receipt";

export type InvoiceEmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType: string;
};

export type BankDetails = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type InvoiceEmailItem = {
  description: string;
  quantity: number;
  rate: number;
};

export type InvoiceEmailCustomization = {
  subject?: string;
  body?: string;
};

export type InvoiceEmailContext = {
  invoice: Invoice;
  school: School;
  studentName: string;
  bankDetails?: BankDetails;
  items: InvoiceEmailItem[];
};

export type SendInvoiceEmailBase = {
  invoiceId: number;
  schoolId: number;
  email?: string[];
  subject?: string;
  body?: string;
  attachments?: string[];
  additionalEmails?: string[];
  sendInApp?: boolean;
};

export type SendInvoiceIssuedOptions = SendInvoiceEmailBase & {
  emailCustomization?: InvoiceEmailCustomization;
};

export type SendInvoiceUpdatedOptions = SendInvoiceEmailBase & {
  emailCustomization?: InvoiceEmailCustomization;
};

export type SendInvoiceReminderOptions = SendInvoiceEmailBase & {
  inAppTitle?: string;
  inAppMessage?: string;
};

export type SendInvoiceReceiptOptions = {
  invoiceId: number;
  schoolId: number;
  amountPaid: number;
  paymentDate: Date | string;
  paymentMethod: PaymentMethod;
  balance: number;
  sendInApp?: boolean;
};

export type SendInvoiceEmailResult = {
  success: boolean;
  message: string;
  recipients?: string[];
};
