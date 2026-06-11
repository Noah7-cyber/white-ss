import { query } from "express-validator";
import { param } from "express-validator";

export const validateSchoolId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("School ID must be a valid positive integer")
    .toInt(),
];

export const validateListSystemAdminSchoolsQuery = [
  query("search")
    .optional()
    .isString()
    .trim(),
  query("pos")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Position must be a valid positive integer")
    .toInt(),
  query("delta")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Delta must be a valid positive integer")
    .toInt(),
  query("sortBy")
    .optional()
    .isIn(["schoolName", "schoolname", "createdAt", "createdat", "id"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC")
    .toUpperCase(),
];
