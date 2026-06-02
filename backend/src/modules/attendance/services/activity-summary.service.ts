import { Brackets, In, Repository } from "typeorm";
import { AppDataSource } from "../../core";
import { ActivityType } from "../../shared";
import { Attendance } from "../../shared/entities/Attendance";
import { ClassroomActivity } from "../../shared/entities/ClassroomActivity";
import { Milestone } from "../../shared/entities/Milestone";
import { MilestoneStatus, AttendanceStatus } from "../../shared/entities/EntityEnums";
import { Student } from "../../shared/entities/StudentEntity";
import { Parent } from "../../shared/entities/Parent";
import { pdfService, type AttendancePdfRow } from "../../shared/services/pdf.service";
import { getNigeriaStartOfDay, getNigeriaEndOfDay, getNigeriaDayName } from "../../shared/utils/date-util";
import { formatDateKey } from "../../shared/utils/date-util";
import { logger } from "../../shared/utils/logger";
import { emailService } from "../../shared/services/email.service";
import { buildDailyActivityPdfModel } from "../utils/daily-activity-report.mapper";
import { mapMilestonesToLearningRows } from "../utils/daily-activity-report-learning.mapper";
import { StaffClassesAndSubject } from "../../shared/entities/StaffClassesAndSubject";
import { getSchoolPortalUrl } from "../../shared/services/utils";
import { studentService } from "../../student/services/student.service";
import {
  StudentReportRecipientType,
  StudentReportTrigger,
  StudentReportType,
} from "../../shared/entities/EntityEnums";
import {
  StudentReportDelivery,
  StudentReportRecipientResult,
} from "../../shared/entities/StudentReportDelivery";
import { studentReportDeliveryService } from "../../student_report/services/student-report.service";

export interface ActivitySummaryData {
  meals: string[];
  naps: { startTime: string; endTime?: string }[];
  pottyDiapers: string[];
  photoUrls: string[];
}

/**
 * Get the Monday (start of week) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Check if today is the student's last scheduled day of the week.
 * Student.schedule is e.g. ["Monday","Tuesday","Wednesday","Thursday","Friday"]
 */
export function isLastScheduledDayOfWeek(schedule?: string[]): boolean {
  if (!schedule || schedule.length === 0) return false;
  const todayName = getNigeriaDayName(new Date());
  const normalizedSchedule = schedule.map((d) => d.trim().toLowerCase());
  const todayNorm = todayName.toLowerCase();
  if (!normalizedSchedule.includes(todayNorm)) return false;
  const dayOrder = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const todayIndex = dayOrder.indexOf(todayNorm);
  const lastScheduledIndex = Math.max(...normalizedSchedule.map((d) => dayOrder.indexOf(d)));
  return todayIndex === lastScheduledIndex;
}

function sanitizeFilenamePart(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "report";
}

function formatTimeForDisplay(time?: string | null): string {
  if (!time?.trim()) return "—";
  const parts = time.trim().split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return time.trim();
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

function formatAttendanceStatusLabel(status?: AttendanceStatus | null): string {
  if (!status) return "—";
  switch (status) {
    case AttendanceStatus.PRESENT:
      return "Present";
    case AttendanceStatus.ABSENT:
      return "Absent";
    case AttendanceStatus.LATE:
      return "Late";
    case AttendanceStatus.LEAVE:
      return "Leave";
    case AttendanceStatus.EXCUSED:
      return "Excused";
    default:
      return String(status).replace(/_/g, " ");
  }
}

function pickBestAttendanceLog(logs: Attendance[]): Attendance | undefined {
  if (!logs.length) return undefined;
  const withBoth = logs.find((l) => l.timeIn && l.timeOut);
  if (withBoth) return withBoth;
  return logs[logs.length - 1];
}

class ActivitySummaryService {
  private get studentRepository(): Repository<Student> {
    return AppDataSource.getRepository(Student);
  }

  private get classroomActivityRepository(): Repository<ClassroomActivity> {
    return AppDataSource.getRepository(ClassroomActivity);
  }

  private get attendanceRepository(): Repository<Attendance> {
    return AppDataSource.getRepository(Attendance);
  }

  private get milestoneRepository(): Repository<Milestone> {
    return AppDataSource.getRepository(Milestone);
  }

  /**
   * Parent portal gallery URL (uses shared getSchoolPortalUrl).
   */
  private buildParentGalleryUrl(subDomain?: string): string {
    return getSchoolPortalUrl("/parent/dashboard", subDomain);
  }

  private async resolveTeacherName(student: Student, attendanceId?: number): Promise<string> {
    try {
      // 1. Try to get teacher from attendance record
      if (attendanceId) {
        const row = await this.attendanceRepository.findOne({
          where: { id: attendanceId },
          relations: ["teacher", "teacher.user"],
        });
        const u = row?.teacher?.user;
        if (u) {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
          if (name) return name;
        }
      }

      // 2. Fallback to assigned classroom teacher
      const classroomId = student.classroomId || student.currentClassroom?.id;
      if (classroomId) {
        const staffClassRepo = AppDataSource.getRepository(StaffClassesAndSubject);
        const staffAssignment = await staffClassRepo.findOne({
          where: { classroomId },
          relations: ["staff", "staff.user"],
        });
        const u = staffAssignment?.staff?.user;
        if (u) {
          const name = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
          if (name) return name;
        }
      }

      return "—";
    } catch (e) {
      logger.warn("resolveTeacherName failed", { studentId: student.id, attendanceId, e });
      return "—";
    }
  }

  async fetchActivitiesForStudent(
    studentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ClassroomActivity[]> {
    return this.classroomActivityRepository
      .createQueryBuilder("activity")
      .innerJoin("activity.studentActivities", "csa")
      .where("csa.studentId = :studentId", { studentId })
      .andWhere("activity.createdAt >= :startDate", { startDate })
      .andWhere("activity.createdAt <= :endDate", { endDate })
      .orderBy("activity.createdAt", "ASC")
      .getMany();
  }

  async fetchAttendanceRowsForReport(
    student: Student,
    startDate: Date,
    endDate: Date,
    isWeekly: boolean
  ): Promise<AttendancePdfRow[]> {
    if (!student.schoolId) return [];

    const logs = await this.attendanceRepository
      .createQueryBuilder("attendance")
      .where("attendance.studentId = :studentId", { studentId: student.id })
      .andWhere("(attendance.schoolId = :schoolId OR attendance.schoolId IS NULL)", {
        schoolId: student.schoolId,
      })
      .andWhere("attendance.date >= :startDate", { startDate: formatDateKey(startDate) })
      .andWhere("attendance.date <= :endDate", { endDate: formatDateKey(endDate) })
      .orderBy("attendance.date", "ASC")
      .addOrderBy("attendance.createdAt", "ASC")
      .getMany();

    const logsByDate = logs.reduce<Record<string, Attendance[]>>((acc, log) => {
      const key = formatDateKey(log.date);
      (acc[key] = acc[key] || []).push(log);
      return acc;
    }, {});

    if (!isWeekly) {
      const todayKey = formatDateKey(endDate);
      const best = pickBestAttendanceLog(logsByDate[todayKey] || []);
      return [
        {
          status: formatAttendanceStatusLabel(best?.status),
          clockIn: formatTimeForDisplay(best?.timeIn),
          clockOut: formatTimeForDisplay(best?.timeOut),
        },
      ];
    }

    const schedule = (
      student.schedule?.length
        ? student.schedule
        : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    ).map((d) => d.trim().toLowerCase());

    const rows: AttendancePdfRow[] = [];
    const cur = new Date(startDate.getTime());
    const endDay = new Date(endDate.getTime());

    while (cur <= endDay) {
      const dayName = getNigeriaDayName(cur).toLowerCase();
      if (schedule.includes(dayName)) {
        const key = formatDateKey(cur);
        const best = pickBestAttendanceLog(logsByDate[key] || []);
        rows.push({
          date: formatDateKey(cur),
          status: formatAttendanceStatusLabel(best?.status),
          clockIn: formatTimeForDisplay(best?.timeIn),
          clockOut: formatTimeForDisplay(best?.timeOut),
        });
      }
      cur.setDate(cur.getDate() + 1);
    }

    return rows;
  }

  async fetchMilestonesForReport(student: Student, startDate: Date, endDate: Date): Promise<Milestone[]> {
    const schoolId = student.schoolId;
    if (!schoolId) return [];

    const classroomId = student.classroomId || student.currentClassroom?.id;
    const reportStart = formatDateKey(startDate);
    const reportEnd = formatDateKey(endDate);

    const qb = this.milestoneRepository
      .createQueryBuilder("milestone")
      .leftJoinAndSelect("milestone.subject", "subject")
      .leftJoinAndSelect("subject.curriculum", "curriculum")
      .leftJoinAndSelect(
        "milestone.studentAssessmentScores",
        "score",
        "score.studentId = :studentId",
        { studentId: student.id }
      )
      .where("milestone.schoolId = :schoolId", { schoolId })
      .andWhere("milestone.status != :draft", { draft: MilestoneStatus.DRAFT })
      .andWhere("(milestone.startDate IS NULL OR milestone.startDate <= :reportEnd)", { reportEnd })
      .andWhere("(milestone.endDate IS NULL OR milestone.endDate >= :reportStart)", { reportStart });

    const scoreSubQuery = qb
      .subQuery()
      .select("1")
      .from("studentAssessmentScore", "sas")
      .where("sas.milestoneId = milestone.id")
      .andWhere("sas.studentId = :studentId")
      .getQuery();

    if (classroomId) {
      const scsSubQuery = qb
        .subQuery()
        .select("1")
        .from("staffClassesAndSubject", "scs")
        .where("scs.classroomId = :classroomId")
        .andWhere("scs.subjectId = milestone.subjectId")
        .getQuery();
      const ccSubQuery = qb
        .subQuery()
        .select("1")
        .from("curriculumClassrooms", "cc")
        .where("cc.classroomId = :classroomId")
        .andWhere("cc.curriculumId = subject.curriculumId")
        .getQuery();

      qb.andWhere(
        new Brackets((b) =>
          b
            .where(`EXISTS (${scsSubQuery})`)
            .orWhere(`EXISTS (${ccSubQuery})`)
            .orWhere(`EXISTS (${scoreSubQuery})`)
        ),
        { classroomId, studentId: student.id }
      );
    } else {
      qb.andWhere(`EXISTS (${scoreSubQuery})`, { studentId: student.id });
    }

    return qb.orderBy("subject.name", "ASC").addOrderBy("milestone.startDate", "ASC").getMany();
  }

  /**
   * Aggregate classroom activities for a student within a date range.
   * Returns structured data for legacy callers.
   */
  async getActivitySummaryForStudent(
    studentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<ActivitySummaryData> {
    const result: ActivitySummaryData = {
      meals: [],
      naps: [],
      pottyDiapers: [],
      photoUrls: [],
    };

    try {
      const activities = await this.fetchActivitiesForStudent(studentId, startDate, endDate);

      for (const a of activities) {
        switch (a.activityType) {
          case ActivityType.MEAL:
            if (a.foodItems) {
              const mealLabel = a.mealType
                ? `${a.mealType}: ${a.foodItems}${a.timeGiven ? ` (${a.timeGiven})` : ""}`
                : a.foodItems;
              result.meals.push(mealLabel);
            }
            break;
          case ActivityType.NAP:
            if (a.startTime) {
              result.naps.push({
                startTime: a.startTime,
                endTime: a.endTime || undefined,
              });
            }
            break;
          case ActivityType.BATHROOM:
            if (a.bathroomType) {
              const label = `${a.bathroomType}${a.timeGiven ? ` at ${a.timeGiven}` : ""}`;
              result.pottyDiapers.push(label);
            }
            break;
          case ActivityType.PHOTO:
            if (a.photoUrl) {
              result.photoUrls.push(a.photoUrl);
            }
            break;
          default:
            break;
        }
      }
    } catch (error) {
      logger.error("Failed to fetch activity summary for student", { studentId, error });
    }

    return result;
  }

  /**
   * Get daily activity summary (for a single day)
   */
  async getDailySummary(studentId: number, date: Date): Promise<ActivitySummaryData> {
    const start = getNigeriaStartOfDay(date);
    const end = getNigeriaEndOfDay(date);
    return this.getActivitySummaryForStudent(studentId, start, end);
  }

  /**
   * Get weekly activity summary (from Monday of the week to the given date)
   */
  async getWeeklySummary(studentId: number, throughDate: Date): Promise<ActivitySummaryData> {
    const weekStart = getWeekStart(throughDate);
    const end = getNigeriaEndOfDay(throughDate);
    return this.getActivitySummaryForStudent(studentId, weekStart, end);
  }

  /**
   * Ensure parents (with user emails) are loaded even when relations were omitted on the student entity.
   */
  private async resolveParentsWithEmail(student: Student): Promise<Parent[]> {
    const hasEmail = (p: Parent) => Boolean(p.user?.email?.trim());
    let parents = (student.parents ?? []).filter(hasEmail);

    const needsReload =
      parents.length === 0 ||
      (student.parents ?? []).some((p) => Boolean(p.userId) && !hasEmail(p)) ||
      !student.user ||
      !student.school;

    if (needsReload || !student.user || !student.school) {
      const reloaded = await this.studentRepository.findOne({
        where: { id: student.id },
        relations: ["parents", "parents.user", "school", "user"],
      });
      if (reloaded) {
        student.parents = reloaded.parents;
        student.school = student.school ?? reloaded.school;
        student.user = student.user ?? reloaded.user;
        parents = (reloaded.parents ?? []).filter(hasEmail);
      }
    }

    return parents;
  }

  private async fetchReportDataForCheckout(
    student: Student,
    startDate: Date,
    endDate: Date,
    isWeekly: boolean
  ): Promise<{
    activities: ClassroomActivity[];
    attendanceRows: AttendancePdfRow[];
    learningRows: ReturnType<typeof mapMilestonesToLearningRows>;
    overallDevelopmentPercent: number | null;
  }> {
    const [activitiesResult, attendanceResult, milestonesResult, perfResult] = await Promise.allSettled([
      this.fetchActivitiesForStudent(student.id, startDate, endDate),
      this.fetchAttendanceRowsForReport(student, startDate, endDate, isWeekly),
      this.fetchMilestonesForReport(student, startDate, endDate),
      student.schoolId
        ? studentService.getGradedMilestonePerformancePercentMap(student.schoolId, [student.id])
        : Promise.resolve(new Map<number, number | null>()),
    ]);

    const activities = activitiesResult.status === "fulfilled" ? activitiesResult.value : [];
    const attendanceRows = attendanceResult.status === "fulfilled" ? attendanceResult.value : [];
    const milestones = milestonesResult.status === "fulfilled" ? milestonesResult.value : [];
    const perfMap =
      perfResult.status === "fulfilled" ? perfResult.value : new Map<number, number | null>();

    if (activitiesResult.status === "rejected") {
      logger.error("Daily report: failed to fetch activities", {
        studentId: student.id,
        error: activitiesResult.reason,
      });
    }
    if (attendanceResult.status === "rejected") {
      logger.error("Daily report: failed to fetch attendance", {
        studentId: student.id,
        error: attendanceResult.reason,
      });
    }
    if (milestonesResult.status === "rejected") {
      logger.error("Daily report: failed to fetch milestones", {
        studentId: student.id,
        error: milestonesResult.reason,
      });
    }
    if (perfResult.status === "rejected") {
      logger.error("Daily report: failed to fetch performance", {
        studentId: student.id,
        error: perfResult.reason,
      });
    }

    return {
      activities,
      attendanceRows,
      learningRows: mapMilestonesToLearningRows(milestones, student.id),
      overallDevelopmentPercent: perfMap.get(student.id) ?? null,
    };
  }

  /**
   * Send activity summary email to all parents when a child is checked out.
   * Daily: when any checkout. Weekly: when checkout is on student's last scheduled day of the week.
   */
  async sendActivitySummaryOnCheckout(student: Student, options?: { attendanceId?: number }): Promise<void> {
    const parents = await this.resolveParentsWithEmail(student);
    if (parents.length === 0) {
      logger.warn("Activity summary skipped: no parent with email", { studentId: student.id });
      return;
    }

    const school = student.school;
    const subDomain = school?.subDomain;
    const centerName = school?.schoolName || "Your Center";
    const childFirstName = student.user?.firstName || "Your child";
    const childFullName = student.user
      ? [student.user.firstName, student.user.lastName].filter(Boolean).join(" ").trim() || "Student"
      : "Student";

    const today = new Date();
    const isWeekly = isLastScheduledDayOfWeek(student.schedule);

    const startDate = isWeekly ? getWeekStart(today) : getNigeriaStartOfDay(today);
    const endDate = getNigeriaEndOfDay(today);

    const dateOrPeriod = isWeekly
      ? `${formatDateKey(startDate)} – ${formatDateKey(today)}`
      : formatDateKey(today);

    const teacherName = await this.resolveTeacherName(student, options?.attendanceId);

    const galleryUrl = this.buildParentGalleryUrl(subDomain);

    const { activities, attendanceRows, learningRows, overallDevelopmentPercent } =
      await this.fetchReportDataForCheckout(student, startDate, endDate, isWeekly);

    const pdfModel = buildDailyActivityPdfModel(activities, {
      childFullName,
      schoolName: centerName,
      teacherName,
      isWeekly,
      dateRangeLabel: dateOrPeriod,
      galleryUrl,
      attendanceRows,
      learningRows,
      overallDevelopmentPercent,
    });

    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await pdfService.generateDailyActivityReportPDF({
        school: school ?? {},
        model: pdfModel,
      });
    } catch (e) {
      logger.error("Daily activity PDF generation failed; sending email without attachment", {
        studentId: student.id,
        error: e,
      });
    }

    const safeChild = sanitizeFilenamePart(childFirstName);
    const safeDate = sanitizeFilenamePart(dateOrPeriod.replace(/\s+/g, "_"));
    const pdfFilename = `${isWeekly ? "Weekly" : "Daily"}_Activity_Report_${safeChild}_${safeDate}.pdf`;

    const emailPromises = parents.map((parent) =>
      emailService.sendActivitySummaryEmail({
        parentEmail: parent.user!.email!,
        parentName: parent.user
          ? [parent.user.firstName, parent.user.lastName].filter(Boolean).join(" ") || "Parent"
          : "Parent",
        childFirstName,
        centerName,
        periodType: isWeekly ? "weekly" : "daily",
        dateOrPeriod,
        subDomain,
        pdfBuffer,
        pdfFilename,
      })
    );

    const results = await Promise.allSettled(emailPromises);
    const recipientResults: StudentReportRecipientResult[] = results.map((result, i) => {
      const parent = parents[i];
      const email = parent?.user?.email ?? "";
      const name = parent?.user
        ? [parent.user.firstName, parent.user.lastName].filter(Boolean).join(" ") || "Parent"
        : "Parent";
      if (result.status === "fulfilled") {
        return { email, name, sent: true };
      }
      logger.error("Activity summary email failed", {
        parentEmail: email,
        studentId: student.id,
        error: result.reason,
      });
      return {
        email,
        name,
        sent: false,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });

    // Persist a metadata-only delivery row so the child's Reports tab can list/resend/download it.
    if (student.schoolId) {
      await studentReportDeliveryService.recordDelivery({
        studentId: student.id,
        schoolId: student.schoolId,
        reportType: isWeekly
          ? StudentReportType.WEEKLY_ACTIVITY
          : StudentReportType.DAILY_ACTIVITY,
        trigger: StudentReportTrigger.AUTO,
        senderUserId: null,
        periodStart: startDate,
        periodEnd: endDate,
        dateRangeLabel: dateOrPeriod,
        activityIds: null,
        recipientType: StudentReportRecipientType.PARENTS,
        recipients: recipientResults,
        snapshot: {
          childFullName,
          schoolName: centerName,
          teacherName,
          galleryUrl,
          isWeekly,
          overallDevelopmentPercent,
        },
      });
    }
  }

  /**
   * Send a PDF report of caller-selected classroom activities.
   *
   * The activities are loaded from the database (tenant-scoped to `schoolId`), grouped by
   * student, then one email-with-PDF is sent per (student, recipient) pair. Recipients are
   * either each student's active parents (recipients="parents") or an explicit list of
   * email addresses (recipients="custom"). Optional `studentIds` filters the per-activity
   * student set so callers can target a subset of the students attached to an activity.
   */
  async sendSelectedActivities(input: {
    activityIds: number[];
    schoolId: number;
    recipients: "parents" | "custom";
    customEmails?: string[];
    studentIds?: number[];
    message?: string;
    senderUserId?: number;
  }): Promise<{
    success: boolean;
    message: string;
    summary: {
      activitiesRequested: number;
      activitiesLoaded: number;
      studentsTargeted: number;
      emailsSent: number;
      emailsFailed: number;
    };
    perStudent: Array<{
      studentId: number;
      childFullName: string;
      activityCount: number;
      recipients: Array<{ email: string; sent: boolean; error?: string }>;
      skippedReason?: string;
    }>;
  }> {
    const uniqueActivityIds = Array.from(new Set((input.activityIds || []).filter((n) => Number.isFinite(n) && n > 0)));
    const studentIdFilter = input.studentIds && input.studentIds.length > 0
      ? new Set(input.studentIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))
      : null;

    const baseSummary = {
      activitiesRequested: uniqueActivityIds.length,
      activitiesLoaded: 0,
      studentsTargeted: 0,
      emailsSent: 0,
      emailsFailed: 0,
    };

    if (uniqueActivityIds.length === 0) {
      return {
        success: false,
        message: "No activity IDs were provided",
        summary: baseSummary,
        perStudent: [],
      };
    }

    if (input.recipients === "custom") {
      const emails = (input.customEmails ?? []).map((e) => String(e || "").trim()).filter(Boolean);
      if (emails.length === 0) {
        return {
          success: false,
          message: "At least one email is required when recipients is 'custom'",
          summary: baseSummary,
          perStudent: [],
        };
      }
    }

    const activities = await this.classroomActivityRepository.find({
      where: { id: In(uniqueActivityIds) },
      relations: [
        "classroom",
        "creator",
        "studentActivities",
        "studentActivities.student",
        "studentActivities.student.user",
        "studentActivities.student.school",
        "studentActivities.student.parents",
        "studentActivities.student.parents.user",
      ],
    });

    if (activities.length === 0) {
      return {
        success: false,
        message: "None of the requested activities were found",
        summary: baseSummary,
        perStudent: [],
      };
    }

    // Enforce tenant isolation: every activity must belong to the caller's school
    const offending = activities.find((a) => a.classroom?.schoolId !== input.schoolId);
    if (offending) {
      return {
        success: false,
        message: "One or more activities do not belong to your school",
        summary: { ...baseSummary, activitiesLoaded: activities.length },
        perStudent: [],
      };
    }

    // Group activities by student
    const perStudent = new Map<number, { student: Student; activities: ClassroomActivity[] }>();
    for (const activity of activities) {
      for (const csa of activity.studentActivities ?? []) {
        const student = csa.student;
        if (!student) continue;
        if (studentIdFilter && !studentIdFilter.has(student.id)) continue;
        const bucket = perStudent.get(student.id);
        if (bucket) {
          bucket.activities.push(activity);
        } else {
          perStudent.set(student.id, { student, activities: [activity] });
        }
      }
    }

    if (perStudent.size === 0) {
      return {
        success: false,
        message: "No matching students found for the selected activities",
        summary: { ...baseSummary, activitiesLoaded: activities.length },
        perStudent: [],
      };
    }

    const teacherName = await this.resolveTeacherFromActivities(activities);
    const perStudentResults: Array<{
      studentId: number;
      childFullName: string;
      activityCount: number;
      recipients: Array<{ email: string; sent: boolean; error?: string }>;
      skippedReason?: string;
    }> = [];

    let emailsSent = 0;
    let emailsFailed = 0;
    let studentsWithoutRecipients = 0;

    for (const { student, activities: studentActivities } of perStudent.values()) {
      // Resolve recipients FIRST so we can skip the (expensive) PDF render when there's no one to email.
      // For "parents" mode, reuse the existing helper which is tolerant of missing relations and
      // does NOT filter on Parent.status (matches the on-checkout report behavior).
      const recipientList: Array<{ email: string; name: string }> = [];
      if (input.recipients === "parents") {
        const parents = await this.resolveParentsWithEmail(student);
        for (const parent of parents) {
          const email = parent.user?.email?.trim();
          if (!email) continue;
          recipientList.push({
            email,
            name: parent.user
              ? [parent.user.firstName, parent.user.lastName].filter(Boolean).join(" ") || "Parent"
              : "Parent",
          });
        }
      } else {
        for (const raw of input.customEmails ?? []) {
          const email = String(raw || "").trim();
          if (!email) continue;
          recipientList.push({ email, name: "" });
        }
      }

      // De-duplicate recipient emails (case-insensitive) per student
      const seen = new Set<string>();
      const uniqueRecipients = recipientList.filter((r) => {
        const key = r.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const childFirstName = student.user?.firstName || "Your child";
      const childFullName = student.user
        ? [student.user.firstName, student.user.lastName].filter(Boolean).join(" ").trim() || "Student"
        : "Student";

      if (uniqueRecipients.length === 0) {
        studentsWithoutRecipients += 1;
        const skippedReason =
          input.recipients === "parents"
            ? "No parents with an email on file for this student"
            : "No valid recipient emails provided";
        logger.warn("sendSelectedActivities: no recipients resolved for student", {
          studentId: student.id,
          recipientsMode: input.recipients,
        });
        perStudentResults.push({
          studentId: student.id,
          childFullName,
          activityCount: studentActivities.length,
          recipients: [],
          skippedReason,
        });
        continue;
      }

      const school = student.school;
      const subDomain = school?.subDomain;
      const centerName = school?.schoolName || "Your Center";

      const {
        startDate: periodStart,
        endDate: periodEnd,
        isWeekly,
        dateRangeLabel,
      } = this.computeRangeForActivities(studentActivities);
      const galleryUrl = this.buildParentGalleryUrl(subDomain);

      const pdfModel = buildDailyActivityPdfModel(studentActivities, {
        childFullName,
        schoolName: centerName,
        teacherName,
        isWeekly,
        dateRangeLabel,
        galleryUrl,
        attendanceRows: [],
        learningRows: [],
        overallDevelopmentPercent: null,
      });

      // Append caller-provided message (if any) so it surfaces in the PDF's parent notes section
      if (input.message?.trim()) {
        pdfModel.parentNotesLines = [...(pdfModel.parentNotesLines ?? []), input.message.trim()];
      }

      let pdfBuffer: Buffer | undefined;
      try {
        pdfBuffer = await pdfService.generateDailyActivityReportPDF({
          school: school ?? {},
          model: pdfModel,
        });
      } catch (e) {
        logger.error("sendSelectedActivities: PDF generation failed; sending email without attachment", {
          studentId: student.id,
          error: e,
        });
      }

      const safeChild = sanitizeFilenamePart(childFirstName);
      const safeDate = sanitizeFilenamePart(dateRangeLabel.replace(/\s+/g, "_"));
      const pdfFilename = `Activities_${safeChild}_${safeDate}.pdf`;

      const sendResults = await Promise.allSettled(
        uniqueRecipients.map((r) =>
          emailService.sendActivitySummaryEmail({
            parentEmail: r.email,
            parentName: r.name || "Recipient",
            childFirstName,
            centerName,
            periodType: isWeekly ? "weekly" : "daily",
            dateOrPeriod: dateRangeLabel,
            subDomain,
            pdfBuffer,
            pdfFilename,
          })
        )
      );

      const recipientResults: StudentReportRecipientResult[] = [];
      sendResults.forEach((res, idx) => {
        const recipient = uniqueRecipients[idx]!;
        if (res.status === "fulfilled") {
          emailsSent += 1;
          recipientResults.push({ email: recipient.email, name: recipient.name, sent: true });
        } else {
          emailsFailed += 1;
          logger.error("sendSelectedActivities email failed", {
            studentId: student.id,
            email: recipient.email,
            error: res.reason,
          });
          recipientResults.push({
            email: recipient.email,
            name: recipient.name,
            sent: false,
            error: res.reason instanceof Error ? res.reason.message : String(res.reason),
          });
        }
      });

      // Persist a metadata-only delivery row per student so the Reports tab can list/resend/download.
      await studentReportDeliveryService.recordDelivery({
        studentId: student.id,
        schoolId: input.schoolId,
        reportType: StudentReportType.SELECTED_ACTIVITIES,
        trigger: StudentReportTrigger.MANUAL,
        senderUserId: input.senderUserId ?? null,
        periodStart,
        periodEnd,
        dateRangeLabel,
        activityIds: studentActivities.map((a) => a.id),
        recipientType:
          input.recipients === "custom"
            ? StudentReportRecipientType.CUSTOM
            : StudentReportRecipientType.PARENTS,
        recipients: recipientResults,
        messageNote: input.message?.trim() || null,
        snapshot: {
          childFullName,
          schoolName: centerName,
          teacherName,
          galleryUrl,
          isWeekly,
          overallDevelopmentPercent: null,
        },
      });

      perStudentResults.push({
        studentId: student.id,
        childFullName,
        activityCount: studentActivities.length,
        recipients: recipientResults,
      });
    }

    const success = emailsSent > 0;
    let message: string;
    if (success) {
      message =
        emailsFailed === 0
          ? `Sent ${emailsSent} email(s)`
          : `Sent ${emailsSent} email(s); ${emailsFailed} failed`;
    } else if (studentsWithoutRecipients === perStudent.size) {
      message =
        input.recipients === "parents"
          ? "None of the targeted students have a parent email on file"
          : "No valid recipient emails were provided";
    } else {
      message = `All ${emailsFailed} email send attempt(s) failed`;
    }

    return {
      success,
      message,
      summary: {
        ...baseSummary,
        activitiesLoaded: activities.length,
        studentsTargeted: perStudent.size,
        emailsSent,
        emailsFailed,
      },
      perStudent: perStudentResults,
    };
  }

  /**
   * Best-effort teacher name pulled from the most recent activity creator that is a staff user.
   * Falls back to "—" when no name is available.
   */
  private async resolveTeacherFromActivities(activities: ClassroomActivity[]): Promise<string> {
    const sorted = [...activities].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    for (const activity of sorted) {
      const creator = activity.creator;
      if (!creator) continue;
      const name = [creator.firstName, creator.lastName].filter(Boolean).join(" ").trim();
      if (name) return name;
    }
    return "—";
  }

  /**
   * Compute the report date range for a set of activities. Single-day selections produce a
   * "daily" model; multi-day selections produce a "weekly" model so the mapper prefixes rows
   * with their date.
   */
  private computeRangeForActivities(activities: ClassroomActivity[]): {
    startDate: Date;
    endDate: Date;
    isWeekly: boolean;
    dateRangeLabel: string;
  } {
    if (activities.length === 0) {
      const now = new Date();
      return {
        startDate: getNigeriaStartOfDay(now),
        endDate: getNigeriaEndOfDay(now),
        isWeekly: false,
        dateRangeLabel: formatDateKey(now),
      };
    }

    let minTs = Number.POSITIVE_INFINITY;
    let maxTs = Number.NEGATIVE_INFINITY;
    for (const a of activities) {
      const ts = new Date(a.createdAt).getTime();
      if (ts < minTs) minTs = ts;
      if (ts > maxTs) maxTs = ts;
    }

    const minDate = new Date(minTs);
    const maxDate = new Date(maxTs);
    const startKey = formatDateKey(minDate);
    const endKey = formatDateKey(maxDate);
    const isWeekly = startKey !== endKey;

    return {
      startDate: getNigeriaStartOfDay(minDate),
      endDate: getNigeriaEndOfDay(maxDate),
      isWeekly,
      dateRangeLabel: isWeekly ? `${startKey} – ${endKey}` : startKey,
    };
  }

  /**
   * Rebuild the PDF for a previously persisted delivery, using the stored metadata
   * (activityIds for selected_activities, periodStart/End for daily/weekly auto reports).
   * Returns null when not enough data survives to render anything useful (e.g. all
   * activities have been deleted).
   */
  async regenerateReportPdf(
    delivery: StudentReportDelivery
  ): Promise<{ pdfBuffer: Buffer; pdfFilename: string; activitiesAvailable: number; activitiesRequested: number } | null> {
    const studentRepo = AppDataSource.getRepository(Student);
    const student = await studentRepo.findOne({
      where: { id: delivery.studentId },
      relations: ["user", "school"],
    });
    if (!student) {
      logger.warn("regenerateReportPdf: student not found", { deliveryId: delivery.id });
      return null;
    }

    const snapshot = delivery.snapshot ?? {};
    const childFirstName = student.user?.firstName || "Your child";
    const childFullName =
      snapshot.childFullName ||
      (student.user
        ? [student.user.firstName, student.user.lastName].filter(Boolean).join(" ").trim() || "Student"
        : "Student");
    const schoolName = snapshot.schoolName || student.school?.schoolName || "Your Center";
    const teacherName = snapshot.teacherName || "—";
    const galleryUrl = snapshot.galleryUrl || this.buildParentGalleryUrl(student.school?.subDomain);

    const isWeekly =
      snapshot.isWeekly ?? delivery.reportType === StudentReportType.WEEKLY_ACTIVITY;

    let activities: ClassroomActivity[] = [];
    let attendanceRows: AttendancePdfRow[] = [];
    let learningRows: ReturnType<typeof mapMilestonesToLearningRows> = [];
    let overallDevelopmentPercent: number | null = snapshot.overallDevelopmentPercent ?? null;
    const activitiesRequested = delivery.activityIds?.length ?? 0;

    if (delivery.reportType === StudentReportType.SELECTED_ACTIVITIES) {
      const ids = delivery.activityIds ?? [];
      if (ids.length > 0) {
        // Match the existing pattern used in sendSelectedActivities: load by IDs,
        // then explicitly verify tenant isolation in JS rather than relying on
        // nested-where clauses (which are version-sensitive in TypeORM).
        const loaded = await this.classroomActivityRepository.find({
          where: { id: In(ids) },
          relations: ["classroom", "creator"],
        });
        activities = loaded.filter(
          (a) => a.classroom?.schoolId === delivery.schoolId
        );
      }
      if (activities.length === 0) {
        return null;
      }
    } else {
      const data = await this.fetchReportDataForCheckout(
        student,
        delivery.periodStart,
        delivery.periodEnd,
        isWeekly
      );
      activities = data.activities;
      attendanceRows = data.attendanceRows;
      learningRows = data.learningRows;
      if (overallDevelopmentPercent == null) {
        overallDevelopmentPercent = data.overallDevelopmentPercent;
      }
    }

    const pdfModel = buildDailyActivityPdfModel(activities, {
      childFullName,
      schoolName,
      teacherName,
      isWeekly,
      dateRangeLabel: delivery.dateRangeLabel,
      galleryUrl,
      attendanceRows,
      learningRows,
      overallDevelopmentPercent,
    });

    if (delivery.messageNote?.trim()) {
      pdfModel.parentNotesLines = [
        ...(pdfModel.parentNotesLines ?? []),
        delivery.messageNote.trim(),
      ];
    }

    if (
      delivery.reportType === StudentReportType.SELECTED_ACTIVITIES &&
      activitiesRequested > 0 &&
      activities.length < activitiesRequested
    ) {
      const missing = activitiesRequested - activities.length;
      pdfModel.parentNotesLines = [
        ...(pdfModel.parentNotesLines ?? []),
        `Note: ${missing} activity item(s) included in the original report are no longer available.`,
      ];
    }

    const pdfBuffer = await pdfService.generateDailyActivityReportPDF({
      school: student.school ?? {},
      model: pdfModel,
    });

    const safeChild = sanitizeFilenamePart(childFirstName);
    const safeDate = sanitizeFilenamePart(delivery.dateRangeLabel.replace(/\s+/g, "_"));
    const baseLabel =
      delivery.reportType === StudentReportType.SELECTED_ACTIVITIES
        ? "Activities"
        : isWeekly
        ? "Weekly_Activity_Report"
        : "Daily_Activity_Report";
    const pdfFilename = `${baseLabel}_${safeChild}_${safeDate}.pdf`;

    return {
      pdfBuffer,
      pdfFilename,
      activitiesAvailable: activities.length,
      activitiesRequested,
    };
  }

  /**
   * Re-send a previously persisted delivery. Defaults to the original recipients/message
   * but accepts overrides. Records a NEW StudentReportDelivery linked back to the
   * original via parentDeliveryId so the history shows every attempt.
   */
  async resendReport(input: {
    delivery: StudentReportDelivery;
    senderUserId: number;
    recipients?: "parents" | "custom";
    customEmails?: string[];
    message?: string;
  }): Promise<{
    success: boolean;
    message: string;
    delivery: StudentReportDelivery | null;
    recipients: StudentReportRecipientResult[];
  }> {
    const original = input.delivery;
    const studentRepo = AppDataSource.getRepository(Student);
    const student = await studentRepo.findOne({
      where: { id: original.studentId },
      relations: ["user", "school", "parents", "parents.user"],
    });
    if (!student) {
      return {
        success: false,
        message: "Student not found",
        delivery: null,
        recipients: [],
      };
    }

    const recipientType: StudentReportRecipientType =
      input.recipients === "custom"
        ? StudentReportRecipientType.CUSTOM
        : input.recipients === "parents"
        ? StudentReportRecipientType.PARENTS
        : original.recipientType;

    const recipientList: Array<{ email: string; name: string }> = [];
    if (recipientType === StudentReportRecipientType.PARENTS) {
      const parents = await this.resolveParentsWithEmail(student);
      for (const parent of parents) {
        const email = parent.user?.email?.trim();
        if (!email) continue;
        recipientList.push({
          email,
          name: parent.user
            ? [parent.user.firstName, parent.user.lastName].filter(Boolean).join(" ") || "Parent"
            : "Parent",
        });
      }
    } else {
      // CUSTOM: prefer caller-supplied list, otherwise replay the originals.
      const source =
        input.customEmails && input.customEmails.length > 0
          ? input.customEmails.map((e) => ({ email: e.trim(), name: "Recipient" }))
          : (original.recipients ?? []).map((r) => ({
              email: r.email,
              name: r.name || "Recipient",
            }));
      for (const r of source) {
        if (r.email) recipientList.push(r);
      }
    }

    const seen = new Set<string>();
    const uniqueRecipients = recipientList.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (uniqueRecipients.length === 0) {
      return {
        success: false,
        message:
          recipientType === StudentReportRecipientType.PARENTS
            ? "No parent email on file for this student"
            : "No valid recipient emails available",
        delivery: null,
        recipients: [],
      };
    }

    // Build the message override for the regenerated PDF/email.
    const messageNote = input.message?.trim() || original.messageNote || null;
    const regen = await this.regenerateReportPdf({
      ...original,
      messageNote: messageNote ?? null,
    } as StudentReportDelivery);
    if (!regen) {
      return {
        success: false,
        message: "Original report can no longer be reconstructed (source data has been deleted)",
        delivery: null,
        recipients: [],
      };
    }

    const childFirstName = student.user?.firstName || "Your child";
    const centerName = student.school?.schoolName || "Your Center";
    const subDomain = student.school?.subDomain;
    const isWeekly =
      original.snapshot?.isWeekly ??
      original.reportType === StudentReportType.WEEKLY_ACTIVITY;

    const sendResults = await Promise.allSettled(
      uniqueRecipients.map((r) =>
        emailService.sendActivitySummaryEmail({
          parentEmail: r.email,
          parentName: r.name || "Recipient",
          childFirstName,
          centerName,
          periodType: isWeekly ? "weekly" : "daily",
          dateOrPeriod: original.dateRangeLabel,
          subDomain,
          pdfBuffer: regen.pdfBuffer,
          pdfFilename: regen.pdfFilename,
        })
      )
    );

    const recipientResults: StudentReportRecipientResult[] = sendResults.map((res, idx) => {
      const recipient = uniqueRecipients[idx]!;
      if (res.status === "fulfilled") {
        return { email: recipient.email, name: recipient.name, sent: true };
      }
      logger.error("resendReport email failed", {
        studentId: student.id,
        deliveryId: original.id,
        email: recipient.email,
        error: res.reason,
      });
      return {
        email: recipient.email,
        name: recipient.name,
        sent: false,
        error: res.reason instanceof Error ? res.reason.message : String(res.reason),
      };
    });

    const newDelivery = await studentReportDeliveryService.recordDelivery({
      studentId: original.studentId,
      schoolId: original.schoolId,
      reportType: original.reportType,
      trigger: StudentReportTrigger.MANUAL,
      senderUserId: input.senderUserId,
      parentDeliveryId: original.id,
      periodStart: original.periodStart,
      periodEnd: original.periodEnd,
      dateRangeLabel: original.dateRangeLabel,
      activityIds: original.activityIds ?? null,
      recipientType,
      recipients: recipientResults,
      messageNote,
      snapshot: original.snapshot ?? null,
    });

    const sentCount = recipientResults.filter((r) => r.sent).length;
    const success = sentCount > 0;
    const message = success
      ? sentCount === recipientResults.length
        ? `Resent to ${sentCount} recipient(s)`
        : `Resent to ${sentCount}/${recipientResults.length} recipient(s)`
      : "All resend attempts failed";

    return {
      success,
      message,
      delivery: newDelivery,
      recipients: recipientResults,
    };
  }
}

export const activitySummaryService = new ActivitySummaryService();
