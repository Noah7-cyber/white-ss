import { body, param, query, ValidationChain } from "express-validator";
import { StudentReportType } from "../../shared/entities/EntityEnums";

export const studentIdParam: ValidationChain[] = [
  param("studentId")
    .isInt({ min: 1 })
    .withMessage("studentId must be a positive integer")
    .toInt(),
];

export const reportIdParam: ValidationChain[] = [
  param("reportId")
    .isInt({ min: 1 })
    .withMessage("reportId must be a positive integer")
    .toInt(),
];

export const validateListReports: ValidationChain[] = [
  ...studentIdParam,
  query("type")
    .optional({ values: "falsy" })
    .isIn(Object.values(StudentReportType))
    .withMessage(
      `type must be one of: ${Object.values(StudentReportType).join(", ")}`
    ),
  query("startDate")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("startDate must be a valid ISO 8601 date"),
  query("endDate")
    .optional({ values: "falsy" })
    .isISO8601()
    .withMessage("endDate must be a valid ISO 8601 date"),
  query("pos")
    .optional({ values: "falsy" })
    .isInt({ min: 0 })
    .withMessage("pos must be a non-negative integer")
    .toInt(),
  query("delta")
    .optional({ values: "falsy" })
    .isInt({ min: 1, max: 100 })
    .withMessage("delta must be between 1 and 100")
    .toInt(),
];

export const validateReportPath: ValidationChain[] = [
  ...studentIdParam,
  ...reportIdParam,
];

export const validateResendReport: ValidationChain[] = [
  ...validateReportPath,
  body("recipients")
    .optional()
    .isIn(["parents", "custom"])
    .withMessage("recipients must be either 'parents' or 'custom'"),
  body("customEmails")
    .optional()
    .isArray({ min: 1, max: 50 })
    .withMessage("customEmails must be a non-empty array (max 50 items) when provided"),
  body("customEmails.*")
    .optional()
    .isEmail()
    .withMessage("Each customEmail must be a valid email address")
    .normalizeEmail(),
  body("message")
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage("message must not exceed 1000 characters"),
  body("recipients").custom((value, { req }) => {
    if (value === "custom") {
      const emails = req.body.customEmails;
      if (!Array.isArray(emails) || emails.length === 0) {
        throw new Error("customEmails is required when recipients is 'custom'");
      }
    }
    return true;
  }),
];
