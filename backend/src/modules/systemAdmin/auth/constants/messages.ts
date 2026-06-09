export const SYSTEM_ADMIN_AUTH_MESSAGES = {
  NOT_SYSTEM_ADMIN: "This user is not a super admin, please use proper route",
  USE_SYSTEM_ADMIN_ROUTE:
    "This account uses system admin login. Please use POST /api/v1/system-admin/auth/login",
  MISCONFIGURED_SYSTEM_ADMIN: "System admin account must not be linked to a school",
  IDENTIFIER_REQUIRED: "Email or phone is required",
  INVALID_CREDENTIALS: "Invalid email/phone or password",
  ACCOUNT_DEACTIVATED: "Account is deactivated",
  TOO_MANY_LOGIN_ATTEMPTS: "Too many login attempts. Please try again later.",
  LOGIN_FAILED: "Login failed. Please try again.",
  MFA_REQUIRED: "Multi-factor authentication required",
  MFA_NOT_ENABLED: "MFA is not enabled for this account",
  MFA_INVALID: "Invalid MFA code",
} as const;
