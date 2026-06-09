import { Request, Response, NextFunction } from "express";
import { validationService } from "../../../auth/services/validation.service";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = req.validationErrors;
  if (errors && errors.length > 0) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.map((error) => error.msg),
    });
    return;
  }
  next();
};

export const validateSystemAdminLogin = (req: Request, _res: Response, next: NextFunction): void => {
  const { email, phone, password } = req.body;
  const errors: Array<{ msg: string }> = [];

  if (!email && !phone) {
    errors.push({ msg: AUTH_MESSAGES.IDENTIFIER_REQUIRED });
  }
  if (!password) {
    errors.push({ msg: AUTH_MESSAGES.PASSWORD_REQUIRED });
  }
  if (email && !validationService.validateEmail(email)) {
    errors.push({ msg: AUTH_MESSAGES.INVALID_EMAIL_FORMAT });
  }
  if (phone && !validationService.validatePhone(validationService.normalizePhone(phone))) {
    errors.push({ msg: AUTH_MESSAGES.INVALID_PHONE_FORMAT });
  }

  if (errors.length > 0) {
    req.validationErrors = errors;
  }
  next();
};

export const validateSystemAdminMFA = (req: Request, _res: Response, next: NextFunction): void => {
  const { mfaToken, code } = req.body;
  const errors: Array<{ msg: string }> = [];

  if (!mfaToken) {
    errors.push({ msg: "MFA token is required" });
  }
  if (!code || !validationService.validateMFACode(code)) {
    errors.push({ msg: AUTH_MESSAGES.MFA_INVALID });
  }

  if (errors.length > 0) {
    req.validationErrors = errors;
  }
  next();
};
