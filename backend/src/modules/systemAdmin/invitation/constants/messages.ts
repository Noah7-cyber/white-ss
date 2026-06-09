export const SYSTEM_ADMIN_INVITATION_MESSAGES = {
  INVITATION_SENT: "System administrator invitation sent successfully",
  INVITATION_CREATE_FAILED: "Failed to create system administrator invitation",
  USER_ALREADY_EXISTS: "A user with this email already exists",
  PENDING_INVITATION_EXISTS: "A pending invitation already exists for this email",
  INVALID_TOKEN: "Invalid invitation token",
  INVITATION_EXPIRED: "Invitation has expired",
  INVITATION_ALREADY_ACCEPTED: "Invitation has already been accepted",
  EMAIL_MISMATCH: "Invitation email does not match the provided email",
  ACCEPT_SUCCESS: "System administrator account created successfully. You can now sign in.",
  ACCEPT_FAILED: "Failed to accept system administrator invitation",
} as const;
