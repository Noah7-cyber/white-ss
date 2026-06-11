import { query } from "express-validator";
import { validateAdminId, validateListAdminsQuery } from "../../../admin/validation/admin.validation";

export { validateAdminId };

export const validateListSystemAdminAdminsQuery = [
  query("schoolId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("School ID must be a valid positive integer")
    .toInt(),
  ...validateListAdminsQuery,
  query("sortBy")
    .optional()
    .isIn(["firstName", "firstname", "lastName", "lastname", "email", "createdAt", "createdat", "id"])
    .withMessage("Invalid sort field"),
  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC")
    .toUpperCase(),
];
