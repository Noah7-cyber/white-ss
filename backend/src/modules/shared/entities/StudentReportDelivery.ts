import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  StudentReportRecipientType,
  StudentReportStatus,
  StudentReportTrigger,
  StudentReportType,
} from "./EntityEnums";
import { Student } from "./StudentEntity";
import { School } from "./School";
import { User } from "./User";

export interface StudentReportRecipientResult {
  email: string;
  name?: string;
  sent: boolean;
  error?: string;
}

export interface StudentReportSnapshot {
  childFullName?: string;
  schoolName?: string;
  teacherName?: string;
  galleryUrl?: string;
  isWeekly?: boolean;
  overallDevelopmentPercent?: number | null;
}

// Persists metadata for every activity-summary report email sent for a student.
// We never store the PDF itself - downloads regenerate it from this metadata.
@Entity("studentReportDelivery")
@Index(["studentId", "createdAt"])
export class StudentReportDelivery {
  constructor(data?: Partial<StudentReportDelivery>) {
    if (typeof data === "object" && data !== null) {
      Object.assign(this, data);
    }
  }

  @PrimaryGeneratedColumn("increment")
  id!: number;

  @Index()
  @Column({ type: "int" })
  schoolId!: number;

  @ManyToOne(() => School, { onDelete: "CASCADE" })
  @JoinColumn({ name: "schoolId" })
  school?: School;

  @Index()
  @Column({ type: "int" })
  studentId!: number;

  @ManyToOne(() => Student, (student) => student.reportDeliveries, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "studentId" })
  student?: Student;

  @Column({ type: "enum", enum: StudentReportType })
  reportType!: StudentReportType;

  @Column({ type: "enum", enum: StudentReportTrigger })
  trigger!: StudentReportTrigger;

  @Column({ type: "int", nullable: true })
  senderUserId?: number | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "senderUserId" })
  sender?: User | null;

  // Set when this row is a resend of an earlier delivery, so the UI can show the chain.
  @Index()
  @Column({ type: "int", nullable: true })
  parentDeliveryId?: number | null;

  @ManyToOne(() => StudentReportDelivery, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "parentDeliveryId" })
  parentDelivery?: StudentReportDelivery | null;

  @Column({ type: "timestamp" })
  periodStart!: Date;

  @Column({ type: "timestamp" })
  periodEnd!: Date;

  @Column({ type: "varchar", length: 100 })
  dateRangeLabel!: string;

  // Populated for SELECTED_ACTIVITIES; null for daily/weekly auto reports.
  @Column({ type: "simple-json", nullable: true })
  activityIds?: number[] | null;

  @Column({ type: "enum", enum: StudentReportRecipientType })
  recipientType!: StudentReportRecipientType;

  @Column({ type: "simple-json" })
  recipients!: StudentReportRecipientResult[];

  @Column({ type: "text", nullable: true })
  messageNote?: string | null;

  @Column({ type: "enum", enum: StudentReportStatus })
  status!: StudentReportStatus;

  // Small bag of values needed to faithfully regenerate the PDF later, even if
  // school/teacher data drifts. Text only - no binary.
  @Column({ type: "simple-json", nullable: true })
  snapshot?: StudentReportSnapshot | null;

  @CreateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  updatedAt!: Date;
}
