import { body, validationResult } from "express-validator";
import { Request, Response, NextFunction } from "express";
import { validationService } from "../../../auth/services/validation.service";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  let errorArray: any[] = [];

  if (!errors.isEmpty()) {
    errorArray = errors.array();
  } else if ((req as any).validationErrors && (req as any).validationErrors.length > 0) {
    errorArray = (req as any).validationErrors;
  }

  if (errorArray.length > 0) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errorArray.map((error: any) => error.msg),
    });
    return;
  }
  next();
};

export const createSystemAdminInvitationValidation = [
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail().trim(),
  body("firstName").notEmpty().withMessage("First name is required").isString().trim(),
  body("lastName").notEmpty().withMessage("Last name is required").isString().trim(),
];

export const acceptSystemAdminInvitationValidation = [
  body("token").notEmpty().withMessage("Token is required").isString().trim(),
  body("email").isEmail().withMessage("Valid email is required").normalizeEmail().trim(),
  body("firstName").notEmpty().withMessage("First name is required").isString().trim(),
  body("lastName").notEmpty().withMessage("Last name is required").isString().trim(),
  body("password")
    .notEmpty()
    .withMessage(AUTH_MESSAGES.PASSWORD_REQUIRED)
    .custom((value) => {
      const result = validationService.validatePassword(value);
      if (!result.isValid) {
        throw new Error(result.errors.join(", "));
      }
      return true;
    }),
];
