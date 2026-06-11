import { param, query } from "express-validator";
import { StudentStatus } from "../../../shared/entities/EntityEnums";

export const validateListStudentsQuery = [
  query("schoolId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("School ID must be a valid integer"),

  query("status")
    .optional()
    .isIn(Object.values(StudentStatus))
    .withMessage(`Status must be one of: ${Object.values(StudentStatus).join(", ")}`),

  query("classroomId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Classroom ID must be a valid integer"),

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
    .isIn([
      "firstName",
      "firstname",
      "lastName",
      "lastname",
      "createdAt",
      "createdat",
      "admissionNumber",
      "admissionnumber",
      "id",
    ])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC")
    .toUpperCase(),
];

export const validateStudentId = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Student ID must be a valid positive integer"),
];
