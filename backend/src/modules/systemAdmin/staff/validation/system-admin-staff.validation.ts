import { query } from "express-validator";
import { validateListStaffQuery, validateStaffId } from "../../../staff/validation/staff.validation";

export { validateStaffId };

export const validateListSystemAdminStaffQuery = [
  ...validateListStaffQuery,
  query("schoolId").optional().isInt({ min: 1 }).withMessage("School ID must be a positive integer").toInt(),
  query("classroomId").optional().isInt({ min: 1 }).withMessage("Classroom ID must be a positive integer").toInt(),
];
