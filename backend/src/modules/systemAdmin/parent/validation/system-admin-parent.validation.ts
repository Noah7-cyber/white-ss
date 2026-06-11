import { param, query } from "express-validator";
import { ParentStatus, RelationshipType } from "../../../shared/entities/EntityEnums";

export const validateListParentsQuery = [
  query("schoolId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("School ID must be a valid integer"),

  query("status")
    .optional()
    .isIn(Object.values(ParentStatus))
    .withMessage(`Status must be one of: ${Object.values(ParentStatus).join(", ")}`),

  query("relationship")
    .optional()
    .isIn(Object.values(RelationshipType))
    .withMessage(`Relationship must be one of: ${Object.values(RelationshipType).join(", ")}`),

  query("pos")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Position must be a non-negative integer"),

  query("delta")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Delta must be between 1 and 100"),

  query("sortBy")
    .optional()
    .isIn(["firstName", "firstname", "lastName", "lastname", "createdAt", "createdat", "id"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC")
    .toUpperCase(),
];

export const validateParentId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Parent ID must be a valid positive integer"),
];
