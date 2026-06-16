import { ApiMethods } from "@/utils/client";
import { NotificationSettings } from "./school.service";

const systemAdminSettingsRoot = "/api/v1/system-admin/settings";

export interface GetSystemAdminNotificationSettingsResponse {
  success: boolean;
  message: string;
  settings: NotificationSettings;
}

export interface UpdateSystemAdminNotificationSettingsRequest {
  adminEmail: boolean;
  adminSms: boolean;
  adminWhatsApp: boolean;
  parentEmail: boolean;
  parentSms: boolean;
  parentWhatsApp: boolean;
  staffEmail: boolean;
  staffSms: boolean;
  staffWhatsApp: boolean;
  dailyReportFrequency: "daily" | "weekly" | "monthly";
}

export const systemAdminSettingsEndpoints = {
  getNotificationSettings: () => ({
    path: `${systemAdminSettingsRoot}/notifications`,
    method: ApiMethods.GET,
  }),
  updateNotificationSettings: () => ({
    path: `${systemAdminSettingsRoot}/notifications`,
    method: ApiMethods.PUT,
  }),
};
