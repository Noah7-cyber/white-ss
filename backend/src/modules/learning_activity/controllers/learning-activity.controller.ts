import { Response } from "express";
import { LearningActivityService } from "../services/learning-activity.service";
import { AuthenticatedRequest } from "../../auth/middleware/middleware";

const learningActivityService = new LearningActivityService();

export const createLearningActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { title, description, subjectId } = req.body;
    const schoolId = req.user?.schoolId;
    const creatorId = req.user?.id;

    if (!schoolId || !creatorId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const newActivity = await learningActivityService.createActivity(
      { title, description, subjectId },
      creatorId,
      schoolId
    );

    res.status(201).json({ success: true, message: "Learning Activity created successfully", data: newActivity });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLearningActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const idParam = req.params["id"];
    if (!idParam) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const id = parseInt(idParam, 10);
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const activity = await learningActivityService.getActivityById(id, schoolId);

    if (!activity) {
      res.status(404).json({ success: false, message: "Learning Activity not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Learning Activity retrieved successfully", data: activity });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getLearningActivitiesBySubject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const subjectIdParam = req.params["subjectId"];
    if (!subjectIdParam) {
      res.status(400).json({ success: false, message: "Invalid Subject ID" });
      return;
    }
    const subjectId = parseInt(subjectIdParam, 10);
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const activities = await learningActivityService.getActivitiesBySubject(subjectId, schoolId);

    res.status(200).json({ success: true, message: "Learning Activities retrieved successfully", data: activities });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateLearningActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const idParam = req.params["id"];
    if (!idParam) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const id = parseInt(idParam, 10);
    const schoolId = req.user?.schoolId;
    const updateData = req.body;

    if (!schoolId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const updatedActivity = await learningActivityService.updateActivity(id, schoolId, updateData);

    if (!updatedActivity) {
      res.status(404).json({ success: false, message: "Learning Activity not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Learning Activity updated successfully", data: updatedActivity });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteLearningActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const idParam = req.params["id"];
    if (!idParam) {
      res.status(400).json({ success: false, message: "Invalid ID" });
      return;
    }
    const id = parseInt(idParam, 10);
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const deleted = await learningActivityService.deleteActivity(id, schoolId);

    if (!deleted) {
      res.status(404).json({ success: false, message: "Learning Activity not found" });
      return;
    }

    res.status(200).json({ success: true, message: "Learning Activity deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
