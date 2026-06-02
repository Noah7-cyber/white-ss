import { Router } from "express";
import {
  createLearningActivity,
  getLearningActivity,
  updateLearningActivity,
  deleteLearningActivity,
  getLearningActivitiesBySubject,
} from "../controllers/learning-activity.controller";
import { authenticate } from "../../auth/middleware/middleware";
import { createLearningActivitySchema, updateLearningActivitySchema } from "../validations/learning-activity.validation";
import { handleValidationErrors } from "../../shared/middleware/validation";

const router = Router();

router.use(authenticate);

router.post(
  "/",
  createLearningActivitySchema,
  handleValidationErrors,
  (req: any, res: any) => createLearningActivity(req, res)
);

router.get("/:id", (req: any, res: any) => getLearningActivity(req, res));
router.get("/subject/:subjectId", (req: any, res: any) => getLearningActivitiesBySubject(req, res));

router.put(
  "/:id",
  updateLearningActivitySchema,
  handleValidationErrors,
  (req: any, res: any) => updateLearningActivity(req, res)
);

router.delete("/:id", (req: any, res: any) => deleteLearningActivity(req, res));

export { router as learningActivityRoutes };
