import { Request, Response, NextFunction } from "express";
import { param, query, validationResult, ValidationChain } from "express-validator";

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
    return;
  }
  next();
};

export const validateListClassrooms: ValidationChain[] = [
  query("schoolId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("School ID must be a valid integer")
    .toInt(),

  query("staffId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Staff ID must be a valid integer")
    .toInt(),

  query("pos")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Position must be a non-negative integer")
    .toInt(),

  query("classroomStatus")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Invalid classroom status"),

  query("delta")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Delta must be between 1 and 100")
    .toInt(),

  query("search")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Search term must not exceed 100 characters"),

  query("sortBy")
    .optional()
    .isIn([
      "classroomName",
      "classroomname",
      "level",
      "minimumAge",
      "minimumage",
      "maximumAge",
      "maximumage",
      "maximumCapacity",
      "maximumcapacity",
      "tuitionFee",
      "tuitionfee",
      "createdAt",
      "createdat",
    ])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC")
    .toUpperCase(),
];

export const validateGetClassroomById: ValidationChain[] = [
  param("id")
    .notEmpty()
    .withMessage("Classroom ID is required")
    .isInt({ min: 1 })
    .withMessage("Classroom ID must be a valid integer")
    .toInt(),
];
