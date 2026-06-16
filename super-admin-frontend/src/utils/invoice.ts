// Shared invoice helpers used across rendering, form payload and previews so
// every surface agrees on which payment methods require bank account details.

// Backend payment method values (mirrors InvoiceStatus enum on the backend).
// We compare lowercase strings here to stay decoupled from the admin form's
// PaymentMethod enum and to handle stray casings from older records.
const NON_BANK_PAYMENT_METHODS = new Set(["cash", "card", "other"]);

export function isBankPaymentMethod(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  return !NON_BANK_PAYMENT_METHODS.has(String(paymentMethod).trim().toLowerCase());
}

// Backend soft-deletes a user account by mutating the email column with a
// "[deleted]" marker (or, historically, a trailing "deleted" suffix) so the
// original address can be reused. Those addresses must never be invited to
// invoice emails or shown in the recipient preview.
export function isTombstonedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = String(email).trim();
  if (!normalized) return false;
  if (/\[deleted\]/i.test(normalized)) return true;
  // Match emails ending with "deleted" (case-insensitive), e.g. foo@bar.com-deleted.
  if (/deleted\s*$/i.test(normalized)) return true;
  return false;
}

export function formatPaymentMethodLabel(paymentMethod?: string | null): string {
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
