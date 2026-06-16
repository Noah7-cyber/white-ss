import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { DailyReportFrequency } from "../../../shared/entities/EntityEnums";

@Entity("system_admin_notification_settings")
export class SystemAdminNotificationSetting {
    constructor(data?: Partial<SystemAdminNotificationSetting>) {
        if (typeof data === "object" && data !== null) {
            Object.assign(this, data);
        }
    }

    @PrimaryGeneratedColumn("increment")
    id!: number;

    // Admin Notifications
    @Column({ type: "boolean", default: true })
    adminEmail!: boolean;

    @Column({ type: "boolean", default: false })
    adminSms!: boolean;

    @Column({ type: "boolean", default: false })
    adminWhatsApp!: boolean;

    // Parent Notifications
    @Column({ type: "boolean", default: true })
    parentEmail!: boolean;

    @Column({ type: "boolean", default: false })
    parentSms!: boolean;

    @Column({ type: "boolean", default: false })
    parentWhatsApp!: boolean;

    // Staff Notifications
    @Column({ type: "boolean", default: true })
    staffEmail!: boolean;

    @Column({ type: "boolean", default: false })
    staffSms!: boolean;

    @Column({ type: "boolean", default: false })
    staffWhatsApp!: boolean;

    @Column({
        type: "enum",
        enum: DailyReportFrequency,
        default: DailyReportFrequency.DAILY,
    })
    dailyReportFrequency!: DailyReportFrequency;

    @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
}
