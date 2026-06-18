// Shared email validation helpers used across invoice + payment flows so every
// surface agrees on which addresses are usable.

// Soft-deleted users have their email mutated with a "[deleted]" marker (or a
// trailing "deleted" suffix) so the original address can be reused later.
// These addresses must never be used for outbound email, nor passed to payment
// gateways (Paystack rejects them as invalid email format with HTTP 400).
export function isTombstonedEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = String(email).trim();
  if (!normalized) return false;
  if (/\[deleted\]/i.test(normalized)) return true;
  if (/deleted\s*$/i.test(normalized)) return true;
  return false;
}

// Returns the input email when it is a usable address, otherwise undefined.
// Useful for short-circuiting fallback chains:
//   const payerEmail = sanitizeEmail(user.email) || sanitizeEmail(parent.email);
export function sanitizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const normalized = String(email).trim();
  if (!normalized) return undefined;
  if (isTombstonedEmail(normalized)) return undefined;
  return normalized;
}
