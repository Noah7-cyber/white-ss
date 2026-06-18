import { body, param, query } from "express-validator";
import { schoolIdExist, admissionNumberExist, classroomIdExist, studentNameExist } from "./student.validator";
import { Suffix } from "../../shared";
import { Gender, StudentStatus } from "../../shared/entities";

const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const createStudentValidation = [

  // // schoolId
  // body("schoolId")
  //   .notEmpty().withMessage("School ID is required")
  //   .isInt().withMessage("School ID must be a number"),

  // classroomId
  body("classroomId")
    .optional()
    .isInt().withMessage("Classroom ID must be a number"),

  // schedule
  body("schedule")
    .optional()
    .isArray().withMessage("Schedule must be an array")
    .custom((arr: string[]) => arr.every(day => validDays.includes(day)))
    .withMessage(`Schedule can only contain valid days: ${validDays.join(", ")}`),

  // -------------------------
  // GENERAL INFO
  // -------------------------
  body("generalInfo")
    .notEmpty().withMessage("General info is required")
    .isObject().withMessage("General info must be an object"),

  body("generalInfo.firstName")
    .notEmpty().withMessage("First name is required")
    .isString().withMessage("First name be a string")
    .isLength({ max: 50 }).withMessage("First name is too long"),

  body("generalInfo.lastName")
    .notEmpty().withMessage("Last name is required")
    .isString().withMessage("Last name must be a string")
    .isLength({ max: 50 }).withMessage("Last name is too long"),

  body("generalInfo.middleName")
    .optional()
    .isString().withMessage("Middle name must be a string")
    .isLength({ max: 50 }).withMessage("Middle name is too long"),

  body("generalInfo.gender")
    .optional()
    .isIn(Object.values(Gender)).withMessage("Invalid gender"),

  body("generalInfo.address")
    .notEmpty().withMessage("Address is required")
    .isString().withMessage("Address must be a string"),

  body("generalInfo.dateOfBirth")
    .notEmpty().withMessage("Date of birth is required")
    .isISO8601().withMessage("Date of birth must be a valid date"),

  body("generalInfo.enrolmentDate")
    .notEmpty().withMessage("Enrollment date is required")
    .isISO8601().withMessage("Enrollment date must be a valid date"),

  body("generalInfo.photoUrl")
    .optional()
    .isString().withMessage("Photo URL must be a string"),

  // -------------------------
  // MEDICAL INFO
  // -------------------------
  body("medicalInfo")
    .optional()
    .isObject().withMessage("Medical info must be an object"),

  body("medicalInfo.allergies").optional().isString(),
  body("medicalInfo.medications").optional().isString(),
  body("medicalInfo.foodPreferences").optional().isString(),
  body("medicalInfo.dietRestriction").optional().isString(),
  body("medicalInfo.notes").optional().isString(),

  // -------------------------
  // EMERGENCY CONTACT
  // -------------------------
  body("emergencyContact")
    .optional()
    .isObject().withMessage("Emergency contact must be an object"),

  body("emergencyContact.suffix")
    .customSanitizer((value) => {
      if (!value) return undefined;
      return Object.values(Suffix).includes(value) ? value : undefined;
    }),


  body("emergencyContact.contactName")
    .optional()
    .isString().withMessage("Contact name must be a string"),

  body("emergencyContact.phone")
    .optional()
    .isString().withMessage("Phone must be a valid string"),

  body("emergencyContact.relationship")
    .optional()
    .isString().withMessage("Relationship must be a string"),

  body("emergencyContact.email")
    .optional()
    .isEmail().withMessage("Email must be valid"),

  body("emergencyContact.address")
    .optional()
    .isString(),

  // -------------------------
  // PARENTS ARRAY
  // -------------------------
  body("parents")
    .exists()
    .isArray().withMessage("Parents must be an array"),

  // Each parent must be identifiable: either an existing parent id, or an email
  body("parents.*")
    .custom((parent: any) => {
      if (!parent || typeof parent !== "object") {
        throw new Error("Each parent entry must be an object");
      }
      const hasId = parent.id !== undefined && parent.id !== null && parent.id !== "";
      const hasEmail = typeof parent.email === "string" && parent.email.trim().length > 0;
      if (!hasId && !hasEmail) {
        throw new Error("Each parent must include either an existing parent id or an email");
      }
      return true;
    }),

  body("parents.*.id")
    .optional()
    .isInt({ min: 1 }).withMessage("Parent id must be a positive integer"),

  // Suffix is a UI-only nicety; missing / empty / invalid values are normalized
  // to undefined so they end up as NULL in the DB instead of triggering the
  // Postgres enum check (empty string is not a valid enum value).
  body("parents.*.suffix")
    .customSanitizer((value) => {
      if (!value) return undefined;
      return Object.values(Suffix).includes(value) ? value : undefined;
    }),


  body("parents.*.firstName")
    .notEmpty().withMessage("Parent first name is required")
    .isString(),

  body("parents.*.lastName")
    .notEmpty().withMessage("Parent last name is required")
    .isString(),

  body("parents.*.email")
    .optional()
    .isEmail().withMessage("Parent email must be valid"),

  body("parents.*.phone")
    .notEmpty().withMessage("Parent phone is required")
    .isString(),

  body("parents.*.address")
    .optional()
    .isString(),

  body("parents.*.relationship")
    .notEmpty().withMessage("Parent relationship is required")
    .isString(),

  body("parents.*.photoUrl")
    .optional()
    .isString(),

  body("parents.*.notes")
    .optional()
    .isString(),

  // PIN should not be set via the student endpoint
  body("parents.*.pin")
    .not().exists().withMessage("Parent PIN cannot be set through this endpoint"),

  // -------------------------
  // DOCUMENTS ARRAY
  // -------------------------
  body("documents")
    .optional()
    .isArray().withMessage("Documents must be an array"),

  body("documents.*.id")
    .optional()
    .isInt({ min: 1 }).withMessage("Document id must be a positive integer"),

  body("documents.*.docName")
    .notEmpty().withMessage("Document name is required")
    .isString(),

  body("documents.*.documentUrl")
    .notEmpty().withMessage("Document URL is required")
    .isString(),

];

// -------------------------
// UPDATE STUDENT VALIDATION
// Fields are mostly optional (partial update). Where present, the same rules apply.
// -------------------------
export const updateStudentValidation = [
  param("id")
    .notEmpty().withMessage("Student ID is required")
    .isInt().withMessage("Student ID must be a number"),

  body("classroomId")
    .optional({ nullable: true })
    .isInt().withMessage("Classroom ID must be a number"),

  body("schedule")
    .optional()
    .isArray().withMessage("Schedule must be an array")
    .custom((arr: string[]) => arr.every((day) => validDays.includes(day)))
    .withMessage(`Schedule can only contain valid days: ${validDays.join(", ")}`),

  // generalInfo (all optional on update)
  body("generalInfo").optional().isObject().withMessage("General info must be an object"),
  body("generalInfo.firstName").optional().isString().isLength({ max: 50 }).withMessage("First name is too long"),
  body("generalInfo.lastName").optional().isString().isLength({ max: 50 }).withMessage("Last name is too long"),
  body("generalInfo.middleName").optional().isString().isLength({ max: 50 }).withMessage("Middle name is too long"),
  body("generalInfo.gender").optional().isIn(Object.values(Gender)).withMessage("Invalid gender"),
  body("generalInfo.address").optional().isString(),
  body("generalInfo.dateOfBirth").optional().isISO8601().withMessage("Date of birth must be a valid date"),
  body("generalInfo.enrolmentDate").optional().isISO8601().withMessage("Enrollment date must be a valid date"),
  body("generalInfo.photoUrl").optional().isString(),

  // medicalInfo (all optional)
  body("medicalInfo").optional().isObject().withMessage("Medical info must be an object"),
  body("medicalInfo.allergies").optional().isString(),
  body("medicalInfo.medications").optional().isString(),
  body("medicalInfo.foodPreferences").optional().isString(),
  body("medicalInfo.dietRestriction").optional().isString(),
  body("medicalInfo.notes").optional().isString(),

  // emergencyContact (all optional)
  body("emergencyContact").optional().isObject().withMessage("Emergency contact must be an object"),
  body("emergencyContact.suffix")
    .customSanitizer((value) => {
      if (!value) return undefined;
      return Object.values(Suffix).includes(value) ? value : undefined;
    }),
  body("emergencyContact.contactName").optional().isString(),
  body("emergencyContact.phone").optional().isString(),
  body("emergencyContact.relationship").optional().isString(),
  body("emergencyContact.email").optional().isEmail().withMessage("Email must be valid"),
  body("emergencyContact.address").optional().isString(),

  // parents (optional array on update, but if provided, replace semantics apply)
  body("parents")
    .optional()
    .isArray().withMessage("Parents must be an array"),

  body("parents.*")
    .custom((parent: any) => {
      if (!parent || typeof parent !== "object") {
        throw new Error("Each parent entry must be an object");
      }
      const hasId = parent.id !== undefined && parent.id !== null && parent.id !== "";
      const hasEmail = typeof parent.email === "string" && parent.email.trim().length > 0;
      if (!hasId && !hasEmail) {
        throw new Error("Each parent must include either an existing parent id or an email");
      }
      return true;
    }),

  body("parents.*.id").optional().isInt({ min: 1 }).withMessage("Parent id must be a positive integer"),
  body("parents.*.suffix")
    .customSanitizer((value) => {
      if (!value) return undefined;
      return Object.values(Suffix).includes(value) ? value : undefined;
    }),
  body("parents.*.firstName").optional().isString(),
  body("parents.*.lastName").optional().isString(),
  body("parents.*.email").optional().isEmail().withMessage("Parent email must be valid"),
  body("parents.*.phone").optional().isString(),
  body("parents.*.address").optional().isString(),
  body("parents.*.relationship").optional().isString(),
  body("parents.*.photoUrl").optional().isString(),
  body("parents.*.notes").optional().isString(),
  body("parents.*.pin")
    .not().exists().withMessage("Parent PIN cannot be set through this endpoint"),

  // documents (optional; replace semantics)
  body("documents").optional().isArray().withMessage("Documents must be an array"),
  body("documents.*.id").optional().isInt({ min: 1 }).withMessage("Document id must be a positive integer"),
  body("documents.*.docName").optional().isString(),
  body("documents.*.documentUrl").optional().isString(),
];

export const studentIdValidation = [
  param("id")
    .notEmpty().withMessage("Student ID is required")
    .isInt().withMessage("Student ID must be a number"),
];

export const getAllStudentsValidation = [
  // optional query params can be validated here if needed
  query("schoolId")
    .optional()
    .isInt().withMessage("School ID must be a number")
    .custom(schoolIdExist),

  query("classroomId")
    .optional()
    .isInt().withMessage("Classroom ID must be a number")
    .custom(classroomIdExist),

  query("staffId")
    .optional()
    .isInt().withMessage("Staff ID must be a number"),

  query("admissionNumber")
    .optional()
    .isString().withMessage("Admission number must be a string")
    .custom(admissionNumberExist),

  query("search")
    .optional()
    .isString().withMessage("Search must be a string")
    .custom(studentNameExist),

  query("status")
    .optional()
    .isIn(Object.values(StudentStatus)).withMessage("Invalid student status"),

  query("sortBy")
    .optional()
    .isIn(["firstName", "firstname", "lastName", "lastname", "createdAt", "createdat", "admissionNumber", "admissionnumber", "id"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["ASC", "DESC", "asc", "desc"])
    .withMessage("Sort order must be ASC or DESC")
    .toUpperCase(),
];

export const updateStudentStatusValidation = [
  param("id")
    .notEmpty().withMessage("Student ID is required")
    .isInt().withMessage("Student ID must be a number"),

  body("type")
    .optional()
    .isString().withMessage("Type must be a string")
    .isIn(Object.values(StudentStatus)).withMessage("Invalid student status"),
  body("status")
    .optional()
    .isString().withMessage("Status must be a string")
    .isIn(Object.values(StudentStatus)).withMessage("Invalid student status"),
  body()
    .custom((value) => {
      if (!value.type && !value.status) {
        throw new Error("Either type or status is required");
      }
      return true;
    }),

  body("reason")
    .optional()
    .isString().withMessage("Reason must be a string"),

  body("endAt")
    .optional()
    .isISO8601().withMessage("End at must be a valid date"),
];