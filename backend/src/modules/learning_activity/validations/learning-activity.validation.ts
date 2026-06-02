import { body, param } from "express-validator";

export const createLearningActivitySchema = [
  body("title").notEmpty().withMessage("Title is required"),
  body("description").optional().isString().withMessage("Description must be a string"),
  body("subjectId").optional().isInt().withMessage("Subject ID must be an integer"),
];

export const updateLearningActivitySchema = [
  param("id").isInt().withMessage("Learning Activity ID must be an integer"),
  body("title").optional().isString().withMessage("Title must be a string"),
  body("description").optional().isString().withMessage("Description must be a string"),
  body("subjectId").optional().isInt().withMessage("Subject ID must be an integer"),
];
