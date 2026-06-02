import { Repository } from "typeorm";
import { AppDataSource } from "../../core/config/database";
import {
  StudentReportDelivery,
  StudentReportRecipientResult,
  StudentReportSnapshot,
} from "../../shared/entities/StudentReportDelivery";
import {
  StudentReportRecipientType,
  StudentReportStatus,
  StudentReportTrigger,
  StudentReportType,
} from "../../shared/entities/EntityEnums";
import { logger } from "../../shared/utils/logger";

export interface RecordDeliveryInput {
  studentId: number;
  schoolId: number;
  reportType: StudentReportType;
  trigger: StudentReportTrigger;
  senderUserId?: number | null;
  parentDeliveryId?: number | null;
  periodStart: Date;
  periodEnd: Date;
  dateRangeLabel: string;
  activityIds?: number[] | null;
  recipientType: StudentReportRecipientType;
  recipients: StudentReportRecipientResult[];
  messageNote?: string | null;
  snapshot?: StudentReportSnapshot | null;
}

export interface ListByStudentInput {
  studentId: number;
  schoolId: number;
  type?: StudentReportType;
  startDate?: string;
  endDate?: string;
  pos?: number;
  delta?: number;
}

export class StudentReportDeliveryService {
  private get repo(): Repository<StudentReportDelivery> {
    return AppDataSource.getRepository(StudentReportDelivery);
  }

  // Determine the overall status from per-recipient send results.
  computeStatus(recipients: StudentReportRecipientResult[]): StudentReportStatus {
    if (recipients.length === 0) return StudentReportStatus.FAILED;
    const sent = recipients.filter((r) => r.sent).length;
    if (sent === 0) return StudentReportStatus.FAILED;
    if (sent === recipients.length) return StudentReportStatus.SENT;
    return StudentReportStatus.PARTIAL;
  }

  async recordDelivery(input: RecordDeliveryInput): Promise<StudentReportDelivery | null> {
    try {
      const status = this.computeStatus(input.recipients);
      const entity = this.repo.create({
        studentId: input.studentId,
        schoolId: input.schoolId,
        reportType: input.reportType,
        trigger: input.trigger,
        senderUserId: input.senderUserId ?? null,
        parentDeliveryId: input.parentDeliveryId ?? null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        dateRangeLabel: input.dateRangeLabel,
        activityIds: input.activityIds ?? null,
        recipientType: input.recipientType,
        recipients: input.recipients,
        messageNote: input.messageNote ?? null,
        status,
        snapshot: input.snapshot ?? null,
      });
      return await this.repo.save(entity);
    } catch (error) {
      // Persistence is best-effort - never break the email send path.
      logger.error("Failed to persist StudentReportDelivery", {
        studentId: input.studentId,
        schoolId: input.schoolId,
        reportType: input.reportType,
        trigger: input.trigger,
        error,
      });
      return null;
    }
  }

  async listByStudent(input: ListByStudentInput): Promise<{
    rows: StudentReportDelivery[];
    total: number;
    pos: number;
    delta: number;
  }> {
    const pos = input.pos ?? 0;
    const delta = input.delta ?? 25;

    const qb = this.repo
      .createQueryBuilder("d")
      .where("d.studentId = :studentId", { studentId: input.studentId })
      .andWhere("d.schoolId = :schoolId", { schoolId: input.schoolId });

    if (input.type) {
      qb.andWhere("d.reportType = :type", { type: input.type });
    }
    if (input.startDate) {
      qb.andWhere("d.createdAt >= :start", { start: new Date(input.startDate) });
    }
    if (input.endDate) {
      qb.andWhere("d.createdAt <= :end", { end: new Date(input.endDate) });
    }

    const total = await qb.getCount();
    const rows = await qb
      .orderBy("d.createdAt", "DESC")
      .addOrderBy("d.id", "DESC")
      .skip(pos)
      .take(delta)
      .getMany();

    return { rows, total, pos, delta };
  }

  async getById(id: number, schoolId: number): Promise<StudentReportDelivery | null> {
    return this.repo.findOne({
      where: { id, schoolId },
      relations: ["sender"],
    });
  }

  /**
   * Fetch every report matching the same filters as `listByStudent` (skipping
   * pagination) so they can be exported in one shot. The `sender` relation is
   * loaded so the export can include the sender's name without a follow-up
   * round-trip. A safety cap is enforced to avoid unbounded queries.
   */
  async listForExport(
    input: Omit<ListByStudentInput, "pos" | "delta">,
    exportLimit = 5000,
  ): Promise<StudentReportDelivery[]> {
    const qb = this.repo
      .createQueryBuilder("d")
      .leftJoinAndSelect("d.sender", "sender")
      .where("d.studentId = :studentId", { studentId: input.studentId })
      .andWhere("d.schoolId = :schoolId", { schoolId: input.schoolId });

    if (input.type) {
      qb.andWhere("d.reportType = :type", { type: input.type });
    }
    if (input.startDate) {
      qb.andWhere("d.createdAt >= :start", { start: new Date(input.startDate) });
    }
    if (input.endDate) {
      qb.andWhere("d.createdAt <= :end", { end: new Date(input.endDate) });
    }

    return qb
      .orderBy("d.createdAt", "DESC")
      .addOrderBy("d.id", "DESC")
      .take(exportLimit)
      .getMany();
  }
}

export const studentReportDeliveryService = new StudentReportDeliveryService();
