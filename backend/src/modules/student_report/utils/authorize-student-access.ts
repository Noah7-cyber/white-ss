import { AuthenticatedRequest } from "../../auth/middleware/middleware";
import { AppDataSource } from "../../core/config/database";
import { Student } from "../../shared/entities/StudentEntity";
import { UserRole } from "../../shared/entities/EntityEnums";
import { RBACService } from "../../shared/middleware/rbac.middleware";
import { Resources, Action } from "../../auth/constants/role-permissions";

export type AuthorizeOutcome =
  | { ok: true; student: Student; isParent: boolean }
  | { ok: false; status: 403 | 404; message: string };

interface AuthorizeOptions {
  // When true, parents listed on the student are allowed (read paths). When false,
  // only RBAC view-permission holders (admin/staff) pass (write paths like resend).
  allowParent: boolean;
}

// Loads the student (with parents.user), enforces tenant isolation, then checks:
//   1. Caller has STUDENT view permission via RBAC, OR
//   2. options.allowParent is true and caller is a parent of the student.
export async function authorizeStudentAccess(
  req: AuthenticatedRequest,
  studentId: number,
  schoolId: number,
  options: AuthorizeOptions
): Promise<AuthorizeOutcome> {
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return { ok: false, status: 404, message: "Student not found" };
  }

  const studentRepo = AppDataSource.getRepository(Student);
  const student = await studentRepo.findOne({
    where: { id: studentId },
    relations: ["parents", "parents.user", "user", "school"],
  });

  if (!student) {
    return { ok: false, status: 404, message: "Student not found" };
  }
  if (student.schoolId !== schoolId) {
    return { ok: false, status: 403, message: "User does not belong to this school" };
  }

  const role = req.user.role;

  // PARENT and STUDENT roles both have STUDENT:VIEW globally via the static role
  // table, but that must never let a parent see another parent's child or a
  // student see another student's reports. Always require an ownership link
  // before the global RBAC check so the global permission can't grant
  // cross-tenant access.
  if (role === UserRole.PARENT) {
    if (!options.allowParent) {
      return {
        ok: false,
        status: 403,
        message: "Parents are not allowed to perform this action",
      };
    }
    const parentId = resolveParentId(req);
    if (parentId && (student.parents ?? []).some((p) => p.id === parentId)) {
      return { ok: true, student, isParent: true };
    }
    return {
      ok: false,
      status: 403,
      message: "You do not have permission to view this student's reports",
    };
  }

  if (role === UserRole.STUDENT) {
    const ownStudentId = resolveStudentId(req);
    if (ownStudentId && ownStudentId === student.id) {
      return { ok: true, student, isParent: false };
    }
    return {
      ok: false,
      status: 403,
      message: "You do not have permission to view this student's reports",
    };
  }

  const hasViewPermission = RBACService.checkPermission(
    role,
    Resources.STUDENT,
    Action.VIEW
  );

  if (hasViewPermission) {
    return { ok: true, student, isParent: false };
  }

  return {
    ok: false,
    status: 403,
    message: "You do not have permission to view this student's reports",
  };
}

function resolveParentId(req: AuthenticatedRequest): number | undefined {
  return pickFirstId((req.user as any).parent);
}

function resolveStudentId(req: AuthenticatedRequest): number | undefined {
  return pickFirstId((req.user as any).student);
}

function pickFirstId(raw: unknown): number | undefined {
  if (Array.isArray(raw)) {
    const first = raw[0];
    return typeof first?.id === "number" ? first.id : undefined;
  }
  if (raw && typeof raw === "object" && typeof (raw as any).id === "number") {
    return (raw as any).id;
  }
  return undefined;
}
