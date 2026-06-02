import { AppDataSource } from "../../core/config/database";
import { LearningActivity } from "../../shared/entities";
import { Repository } from "typeorm";

export class LearningActivityService {
  private activityRepository: Repository<LearningActivity>;

  constructor() {
    this.activityRepository = AppDataSource.getRepository(LearningActivity);
  }

  async createActivity(data: Partial<LearningActivity>, creatorId: number, schoolId: number): Promise<LearningActivity> {
    const activity = this.activityRepository.create({
      ...data,
      creatorId,
      schoolId,
    });
    return await this.activityRepository.save(activity);
  }

  async getActivityById(id: number, schoolId: number): Promise<LearningActivity | null> {
    return await this.activityRepository.findOne({
      where: { id, schoolId },
      relations: ["subject", "milestones"],
    });
  }

  async getActivitiesBySubject(subjectId: number, schoolId: number): Promise<LearningActivity[]> {
    return await this.activityRepository.find({
      where: { subjectId, schoolId },
      relations: ["milestones"],
    });
  }

  async updateActivity(id: number, schoolId: number, data: Partial<LearningActivity>): Promise<LearningActivity | null> {
    const activity = await this.getActivityById(id, schoolId);
    if (!activity) return null;

    Object.assign(activity, data);
    return await this.activityRepository.save(activity);
  }

  async deleteActivity(id: number, schoolId: number): Promise<boolean> {
    const result = await this.activityRepository.delete({ id, schoolId });
    return result.affected !== 0 && result.affected !== null && result.affected !== undefined;
  }
}
