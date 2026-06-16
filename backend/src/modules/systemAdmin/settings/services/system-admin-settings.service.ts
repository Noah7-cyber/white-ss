import { Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { SystemAdminNotificationSetting } from "../entities/SystemAdminNotificationSetting";
import { logger } from "../../../shared/utils/logger";

export class SystemAdminSettingsService {
  private get notificationSettingRepository(): Repository<SystemAdminNotificationSetting> {
    return AppDataSource.getRepository(SystemAdminNotificationSetting);
  }

  async getNotificationSettings(): Promise<{ success: boolean; message: string; settings?: SystemAdminNotificationSetting }> {
    try {
      let settings = await this.notificationSettingRepository.findOne({
        where: {} // Since there's only one system admin settings, we can just grab the first one
      });

      if (!settings) {
        settings = this.notificationSettingRepository.create({});
        await this.notificationSettingRepository.save(settings);
      }

      return {
        success: true,
        message: "System Admin Notification settings retrieved successfully",
        settings
      };
    } catch (error) {
      logger.error("Error getting system admin notification settings:", error);
      return {
        success: false,
        message: "Failed to retrieve system admin notification settings"
      };
    }
  }

  async updateNotificationSettings(data: Partial<SystemAdminNotificationSetting>): Promise<{ success: boolean; message: string; settings?: SystemAdminNotificationSetting }> {
    try {
      let settings = await this.notificationSettingRepository.findOne({
        where: {}
      });

      if (!settings) {
        settings = this.notificationSettingRepository.create({});
      }

      Object.assign(settings, data);
      await this.notificationSettingRepository.save(settings);

      return {
        success: true,
        message: "System Admin Notification settings updated successfully",
        settings
      };
    } catch (error) {
      logger.error("Error updating system admin notification settings:", error);
      return {
        success: false,
        message: "Failed to update system admin notification settings"
      };
    }
  }
}

export const systemAdminSettingsService = new SystemAdminSettingsService();
