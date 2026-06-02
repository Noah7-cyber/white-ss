import { Request, Response } from "express";
import { studentService } from "../services/student.service";
import { validationResult } from "express-validator";
import { authService } from "../../auth";
import { medicalService } from "../../medical";
import { emergencyContactService } from "../../emergencyContact";
import { profileService } from "../../user/services/profile.service";
import { AppDataSource } from "../../core";
import { Parent } from "../../shared/entities/Parent";
import { School } from "../../shared/entities/School";
import { Classroom } from "../../shared/entities/Classroom";
import { Student } from "../../shared/entities/StudentEntity";
import { parentService } from "../../parent";
import { studentDocumentService } from "../../studentDocument/services/studentDocument.service";
import { Medical } from "../../shared/entities/Medical";
import { Emergency } from "../../shared/entities/Emergency";
import { StudentDocument } from "../../shared/entities/StudentDocument";
import { logger, userAssociationService, UserRole, User, Gender } from "../../shared";
import { requireSchoolId, validateSchoolAccess } from "../../shared/utils/tenant-context";
import { AuthenticatedRequest } from "../../auth/middleware/middleware";
import { notificationService } from "../../notification";
import { NotificationType, NotificationPriority } from "../../shared/entities/Notification";
import { activityLogger } from "../../shared/services/activity-logger.service";
import { classroomService } from "../../classroom/services/classroom.service";
import { buildXlsxBuffer, sanitizeXlsxFilename, sendXlsx } from "../../shared/utils/xlsx";

interface ParentInput {
  id?: number; // Optional: parent ID to identify existing parent for updates
  firstName: string;
  lastName: string;
  email: string;
  address?: string; // Profile field
  city?: string; // Profile field
  state?: string; // Profile field
  postalCode?: string; // Profile field
  countryCode?: string; // Profile field
  relationship: Parent["relationship"];
  notes?: string;
  photoUrl?: string; // Parent entity field
  photo?: string; // Profile field
  phone?: string;
  suffix?: Parent["suffix"]; // Profile field
  username?: string; // Parent entity field
  pin?: string; // Parent entity field
}

export class StudentController {
  // POST /students
  async createStudent(req: AuthenticatedRequest, res: Response) {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const schoolId = req?.user?.schoolId;

    if (!schoolId) {
      return res.status(400).json({ success: false, message: "School ID is required" });
    }

    const { generalInfo, medicalInfo, emergencyContact, parents, classroomId, schedule, documents } = req.body;

    // Validate that schoolId from body matches user's schoolId
    try {
      validateSchoolAccess(req, schoolId);
    } catch (error: any) {
      return res.status(403).json({ success: false, message: error.message });
    }

    try {
      const result = await AppDataSource.transaction(async (manager) => {
        // Create student user
        const studentResult = await profileService.createUser(
          {
            firstName: generalInfo.firstName,
            lastName: generalInfo.lastName,
            middleName: generalInfo.middleName,
            gender: generalInfo.gender,
            dateOfBirth: generalInfo.dateOfBirth,
            address: generalInfo.address,
            role: UserRole.STUDENT,
            schoolId: schoolId,
          },
          { manager },
        );

        if (!studentResult.id || !studentResult) {
          throw new Error(studentResult.message || "Failed to create student user");
        }

        const studentUser = studentResult;

        //check if school exists:
        const school = await manager.getRepository(School).findOne({
          where: { id: schoolId },
        });

        if (!school) {
          throw new Error("School not found");
        }

        //check if classroom exists
        let classroom: Classroom | null = null;
        if (classroomId) {
          // Lock the classroom row so two concurrent creates can't both pass the
          // capacity check for the last available seat.
          classroom = await manager.getRepository(Classroom).findOne({
            where: {
              id: classroomId,
              schoolId: schoolId,
            },
            lock: { mode: "pessimistic_write" },
          });

          if (!classroom) {
            throw new Error("Invalid classroom: classroom does not exist or does not belong to this school");
          }

          const capacityCheck = await classroomService.ensureClassroomHasCapacityForAssignment(classroom.id, {
            manager,
          });
          if (!capacityCheck.success) {
            throw new Error(capacityCheck.message);
          }
        }

        // Create student entity
        const studentEntity = await studentService.createStudent(
          {
            userId: studentUser.id,
            schoolId,
            classroomId: classroom ? classroomId : null,
            schedule,
            photoUrl: generalInfo.photoUrl,
            enrolmentDate: generalInfo.enrolmentDate,
          },
          { manager },
        );

        //create medical entity
        const medicalEntity = await medicalService.createMedicalRecord(
          {
            studentId: studentEntity.id,
            allergies: medicalInfo.allergies,
            medications: medicalInfo.medications,
            foodPreferences: medicalInfo.foodPreferences,
            dietRestriction: medicalInfo.dietRestriction,
            notes: medicalInfo.notes,
          },
          { manager },
        );

        //create Emergency contact

        const emergencyContactEntity = await emergencyContactService.createEmergencyContact(
          {
            studentId: studentEntity.id,
            suffix: emergencyContact.suffix,
            contactName: emergencyContact.contactName,
            relationship: emergencyContact.relationship,
            phone: emergencyContact.phone,
            email: emergencyContact.email,
            address: emergencyContact.address,
          },
          { manager },
        );

        // Create/Link parent users.
        //
        // Per-parent flow (mirrors updateStudent):
        //   PATH A: parent.id provided -> link the existing parent in this school.
        //                                 We do not overwrite fields here; admins use
        //                                 the dedicated parent update flow for that.
        //   PATH B: no parent.id       -> identify by email.
        //     B1. No User with this email                  -> register User + Parent + email.
        //     B2. User exists, role != PARENT              -> error (clear, role-specific).
        //     B3. User is a parent in THIS school          -> just link.
        //     B4. User is a parent in ANOTHER school only  -> error (clear, school-specific).
        //     B5. User exists but has no Parent record yet -> create Parent record + link.

        // Dedupe by id first, then by normalized email, so duplicate entries can't race.
        const seenIds = new Set<number>();
        const seenEmails = new Set<string>();
        const dedupedParents: ParentInput[] = [];
        for (const parent of (parents as ParentInput[]) || []) {
          const normalizedEmail = parent.email?.toLowerCase().trim();
          if (parent.id) {
            const numericId = Number(parent.id);
            if (seenIds.has(numericId)) continue;
            seenIds.add(numericId);
          } else if (normalizedEmail) {
            if (seenEmails.has(normalizedEmail)) continue;
            seenEmails.add(normalizedEmail);
          } else {
            // Validation should have caught this; defensive skip.
            continue;
          }
          dedupedParents.push(parent);
        }

        const parentUsers: Parent[] = [];
        for (const rawParent of dedupedParents) {
          // Strip fields that must never be set through the student endpoint.
          const { pin: _ignoredPin, ...parent } = rawParent as ParentInput & { pin?: string };
          let parentEntity: Parent;
          let generatedPassword: string | null = null;
          const normalizedEmail = parent.email?.toLowerCase().trim();

          // ---------- PATH A ----------
          if (parent.id) {
            const existingParent = await manager.findOne(Parent, {
              where: { id: parent.id, schoolId },
              relations: ["user"],
            });
            if (!existingParent) {
              throw new Error(`Parent ${parent.id} not found in this school`);
            }
            parentEntity = existingParent;
            (parentEntity as any).generatedPassword = null;
            (parentEntity as any).email = normalizedEmail || existingParent.user?.email;
            parentUsers.push(parentEntity);
            continue;
          }

          // ---------- PATH B ----------
          if (!normalizedEmail) {
            throw new Error("Parent email is required when no existing parent id is provided");
          }

          const existingUser = await manager.getRepository(User).findOne({
            where: { email: normalizedEmail },
          });

          if (!existingUser) {
            // B1: brand new user + parent + welcome email
            const parentResult = await authService.registerParentViaAdmin(
              {
                firstName: parent.firstName,
                lastName: parent.lastName,
                email: normalizedEmail,
                phone: parent.phone,
                address: parent.address,
                suffix: parent.suffix,
                tempPassword: true,
                role: UserRole.PARENT,
                schoolId,
              },
              { manager },
            );
            if (!parentResult.user) {
              throw new Error("Could not create parent as a user");
            }
            generatedPassword = parentResult.password;
            parentEntity = await userAssociationService.ensureParentRecord(
              parentResult.user,
              schoolId,
              parent,
              manager,
            );
            logger.info(`Created new parent user ${parentResult.user.id} via student create`);
          } else {
            // B2: email belongs to a non-parent role -> reject with a clear message
            if (existingUser.role && existingUser.role !== UserRole.PARENT) {
              throw new Error(
                `The email "${normalizedEmail}" is already in use by a ${existingUser.role} account. Please use a different email for this parent.`,
              );
            }

            const parentRecords = await manager.find(Parent, {
              where: { userId: existingUser.id },
            });
            const parentInThisSchool = parentRecords.find((p) => p.schoolId === schoolId);
            const parentInOtherSchool = parentRecords.find((p) => p.schoolId !== schoolId);

            if (parentInThisSchool) {
              // B3: already a parent in this school -> just link, do not overwrite
              parentEntity = parentInThisSchool;
              parentEntity.user = existingUser;
              logger.info(
                `Linking existing parent ${parentInThisSchool.id} (user ${existingUser.id}) to new student via email match`,
              );
            } else if (parentInOtherSchool) {
              // B4: registered as a parent under another school -> reject
              throw new Error(
                `The email "${normalizedEmail}" is already registered as a parent in another school. Ask your administrator to add them by selecting the existing parent record if appropriate.`,
              );
            } else {
              // B5: user exists but has no Parent record yet -> create one here
              parentEntity = await userAssociationService.ensureParentRecord(
                existingUser,
                schoolId,
                parent,
                manager,
              );
              logger.info(
                `Created Parent record for existing user ${existingUser.id} in school ${schoolId}`,
              );
            }
          }

          (parentEntity as any).generatedPassword = generatedPassword;
          (parentEntity as any).email = normalizedEmail || parentEntity.user?.email;
          parentUsers.push(parentEntity);
        }

        // Link parents to student. Use the additive attach helper (no existing
        // parents to compare against on a fresh student).
        const parentIds = parentUsers.map((p) => p.id);
        await parentService.attachParentsToStudent(studentEntity.id, parentIds, { manager });

        // 4️⃣ Create documents (if any)
        const { user } = req as AuthenticatedRequest;
        const documentEntities = [];
        if (documents && Array.isArray(documents)) {
          for (const doc of documents) {
            const documentEntity = await studentDocumentService.createStudentDocument(
              {
                studentId: studentEntity.id,
                docName: doc.docName,
                documentUrl: doc.documentUrl,
                uploadedBy: user.id,
              },
              { manager },
            );
            documentEntities.push(documentEntity);
          }
        }

        return {
          student: studentEntity,
          parents: parentUsers,
          medical: medicalEntity,
          emergencyContact: emergencyContactEntity,
          school: school,
          studentDocuments: documentEntities,
        };
      });

      const schoolName = result.school?.schoolName || "Your School";

      res.status(201).json({
        success: true,
        message: "Student created successfully",
        data: result,
      });

      // SEND EMAIL WITH PASSWORD TO NEW PARENTS
      // Only the parents whose Users were freshly created carry a `generatedPassword`,
      // so this naturally skips existing parents that were just linked (B3/B5).
      try {
        const { emailService } = await import("../../shared/services/email.service");
        for (const parent of result.parents) {
          if (!(parent as any).generatedPassword) continue;

          const parentName =
            `${(parent as any).user?.firstName || ""} ${(parent as any).user?.lastName || ""}`.trim() ||
            "Parent";

          await emailService.sendParentAccountCreationEmail(
            (parent as any).email,
            parentName,
            (parent as any).generatedPassword,
            schoolName,
            `${generalInfo.firstName} ${generalInfo.lastName}`,
            (parent as any).pin,
          );
        }
      } catch (err) {
        logger.error("Failed to send parent account creation emails:", err instanceof Error ? err : err);
      }

      // SEND NOTIFICATION TO ADMINS WHEN STUDENT IS ENROLLED
      try {
        await notificationService.notifyAdmins({
          schoolId,
          type: NotificationType.INFO,
          priority: NotificationPriority.MEDIUM,
          title: "New Student Enrolled",
          message: `${generalInfo.firstName} ${generalInfo.lastName} has been enrolled in ${schoolName}`,
          actionUrl: `/students/${result.student.id}`,
          actionLabel: "View Student",
          data: {
            studentId: result.student.id,
            studentName: `${generalInfo.firstName} ${generalInfo.lastName}`,
            schoolName: schoolName,
            enrolledBy: (req as AuthenticatedRequest).user?.id,
          },
        });
      } catch (err) {
        logger.error("Failed to send student enrollment notification to admins:", err);
      }

      return;
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /students/:id
  async getStudentById(req: Request, res: Response) {
    try {
      const idParam = req.params["id"];
      if (!idParam) {
        return res.status(400).json({ success: false, message: "Student ID is required" });
      }

      const id = parseInt(idParam, 10);

      const student = await studentService.getStudentById(id);
      if (!student) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      // Validate school access
      try {
        validateSchoolAccess(req, (student as any).schoolId);
      } catch (error: any) {
        return res.status(403).json({ success: false, message: error.message });
      }

      return res.json({ success: true, data: student });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  // GET /students
  async getAllStudents(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      // Extract query parameters
      const { pos: posQuery, delta: deltaQuery, classroomId, staffId, search, admissionNumber, status, sortBy, sortOrder } = req.query;
      const pos = posQuery ? parseInt(posQuery as string, 10) : 0;
      const delta = deltaQuery ? parseInt(deltaQuery as string, 10) : 10;

      // Always use user's schoolId to ensure data isolation (no need to pass schoolId in query)
      const userSchoolId = requireSchoolId(req);

      // When staffId is passed and user is STAFF, they can only filter by their own staffId
      let resolvedStaffId: number | undefined;
      if (staffId) {
        const parsedStaffId = parseInt(staffId as string, 10);
        if (isNaN(parsedStaffId)) {
          return res.status(400).json({ success: false, message: "Invalid staffId" });
        }
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role === UserRole.STAFF) {
          const staffRelation = (authReq.user as any).teacher ?? authReq.user.staff;
          const staffRecord = Array.isArray(staffRelation) ? staffRelation[0] : staffRelation;
          const myStaffId = staffRecord?.id;
          if (myStaffId !== parsedStaffId) {
            return res.status(403).json({ success: false, message: "Staff can only filter students by their own assigned classes" });
          }
        }
        resolvedStaffId = parsedStaffId;
      }

      // Build filters object with all query params
      const filters = {
        schoolId: userSchoolId, // Always use authenticated user's schoolId
        pos,
        delta,
        ...(classroomId && { classroomId: parseInt(classroomId as string, 10) }),
        ...(resolvedStaffId && { staffId: resolvedStaffId }),
        ...(search && { search: search as string }),
        ...(admissionNumber && { admissionNumber: admissionNumber as string }),
        ...(status && { status: status as any }),
        ...(sortBy && { sortBy: sortBy as string }),
        ...(sortOrder && { sortOrder: sortOrder as "ASC" | "DESC" }),
      };

      const result = await studentService.getAllStudents(filters);

      // If no students found, return 404
      if (!result.success || !result.students || result.students.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No students found matching the search criteria",
        });
      }

      return res.json({ success: true, data: result });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  //Update student
  async updateStudent(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const studentId = Number(req.params["id"]);
      const { generalInfo, medicalInfo, emergencyContact, parents, classroomId, schedule, documents } = req.body;

      // Validate school access - ensure student belongs to user's school
      const existingStudent = await studentService.getStudentById(studentId);
      if (!existingStudent || (existingStudent as any).success === false) {
        return res.status(404).json({ success: false, message: "Student not found" });
      }

      const student = existingStudent as any;
      try {
        validateSchoolAccess(req, student.schoolId);
      } catch (error: any) {
        return res.status(403).json({ success: false, message: error.message });
      }

      const result = await AppDataSource.transaction(async (manager) => {
        // Fetch school name for email context
        const school = await manager.getRepository(School).findOne({
          where: { id: student.schoolId },
        });

        // 1. Update student user profile (generalInfo)
        if (generalInfo) {
          const studentUser = await manager.findOne(User, { where: { id: student.userId } });
          if (studentUser) {
            if (generalInfo.firstName) studentUser.firstName = generalInfo.firstName;
            if (generalInfo.lastName) studentUser.lastName = generalInfo.lastName;
            if (generalInfo.gender) studentUser.gender = generalInfo.gender as Gender;
            if (generalInfo.middleName !== undefined) studentUser.middleName = generalInfo.middleName;
            if (generalInfo.dateOfBirth) studentUser.dateOfBirth = generalInfo.dateOfBirth;
            if (generalInfo.address) studentUser.address = generalInfo.address;
            await manager.save(User, studentUser);
          }
        }

        // 2. Update student entity
        const studentUpdatePayload: Partial<Student> = {};
        if (schedule !== undefined) studentUpdatePayload.schedule = schedule;
        if (generalInfo?.photoUrl !== undefined) studentUpdatePayload.photoUrl = generalInfo.photoUrl;
        if (generalInfo?.enrolmentDate !== undefined) studentUpdatePayload.enrolmentDate = generalInfo.enrolmentDate;
        if (classroomId !== undefined) {
          // Validate classroom if provided
          if (classroomId) {
            // Lock the classroom row for the rest of this transaction so concurrent
            // updates cannot both pass the capacity check for the last available seat.
            const classroom = await manager.findOne(Classroom, {
              where: {
                id: classroomId,
                schoolId: student.schoolId,
              },
              lock: { mode: "pessimistic_write" },
            });
            if (!classroom) {
              throw new Error("Invalid classroom: classroom does not exist or does not belong to this school");
            }
            const previousClassroomId =
              student.classroomId !== undefined && student.classroomId !== null
                ? Number(student.classroomId)
                : (student as any).currentClassroom?.id !== undefined
                  ? Number((student as any).currentClassroom.id)
                  : null;
            if (Number(classroomId) !== previousClassroomId) {
              const capacityCheck = await classroomService.ensureClassroomHasCapacityForAssignment(classroom.id, {
                manager,
                excludeStudentId: studentId,
              });
              if (!capacityCheck.success) {
                throw new Error(capacityCheck.message);
              }
            }
            studentUpdatePayload.classroomId = classroomId;
          } else {
            studentUpdatePayload.classroomId = undefined;
          }
        }

        if (Object.keys(studentUpdatePayload).length > 0) {
          await studentService.updateStudent(studentId, studentUpdatePayload);
        }

        // 3. Update or create medical record
        let medicalEntity = null;
        if (medicalInfo) {
          const existingMedical = await manager.findOne(Medical, {
            where: { studentId: studentId },
          });

          if (existingMedical) {
            // Update existing medical record
            existingMedical.allergies = medicalInfo.allergies !== undefined ? medicalInfo.allergies : existingMedical.allergies;
            existingMedical.medications = medicalInfo.medications !== undefined ? medicalInfo.medications : existingMedical.medications;
            existingMedical.foodPreferences =
              medicalInfo.foodPreferences !== undefined ? medicalInfo.foodPreferences : existingMedical.foodPreferences;
            existingMedical.dietRestriction =
              medicalInfo.dietRestriction !== undefined ? medicalInfo.dietRestriction : existingMedical.dietRestriction;
            existingMedical.notes = medicalInfo.notes !== undefined ? medicalInfo.notes : existingMedical.notes;
            medicalEntity = await manager.save(Medical, existingMedical);
          } else {
            // Create new medical record
            medicalEntity = await medicalService.createMedicalRecord(
              {
                studentId: studentId,
                allergies: medicalInfo.allergies,
                medications: medicalInfo.medications,
                foodPreferences: medicalInfo.foodPreferences,
                dietRestriction: medicalInfo.dietRestriction,
                notes: medicalInfo.notes,
              },
              { manager },
            );
          }
        }

        // 4. Update or create emergency contact
        let emergencyContactEntity = null;
        if (emergencyContact) {
          const existingEmergency = await manager.findOne(Emergency, {
            where: { studentId: studentId },
          });

          if (existingEmergency) {
            // Update existing emergency contact
            if (emergencyContact.suffix !== undefined) existingEmergency.suffix = emergencyContact.suffix;
            if (emergencyContact.contactName !== undefined) existingEmergency.contactName = emergencyContact.contactName;
            if (emergencyContact.relationship !== undefined) existingEmergency.relationship = emergencyContact.relationship;
            if (emergencyContact.phone !== undefined) existingEmergency.phone = emergencyContact.phone;
            if (emergencyContact.email !== undefined) existingEmergency.email = emergencyContact.email;
            if (emergencyContact.address !== undefined) existingEmergency.address = emergencyContact.address;
            emergencyContactEntity = await manager.save(Emergency, existingEmergency);
          } else {
            // Create new emergency contact
            emergencyContactEntity = await emergencyContactService.createEmergencyContact(
              {
                studentId: studentId,
                suffix: emergencyContact.suffix,
                contactName: emergencyContact.contactName,
                relationship: emergencyContact.relationship,
                phone: emergencyContact.phone,
                email: emergencyContact.email,
                address: emergencyContact.address,
              },
              { manager },
            );
          }
        }

        // 5. Update/create parents
        let parentUsers: Parent[] = [];
        if (parents && Array.isArray(parents)) {
          const userSchoolId = requireSchoolId(req);

          // Dedupe parent inputs by id (preferred) then by normalized email so two entries
          // referencing the same person don't race or create duplicate rows.
          const seenIds = new Set<number>();
          const seenEmails = new Set<string>();
          const dedupedParents: ParentInput[] = [];
          for (const parent of parents as ParentInput[]) {
            const normalizedEmail = parent.email?.toLowerCase().trim();
            if (parent.id) {
              const numericId = Number(parent.id);
              if (seenIds.has(numericId)) continue;
              seenIds.add(numericId);
            } else if (normalizedEmail) {
              if (seenEmails.has(normalizedEmail)) continue;
              seenEmails.add(normalizedEmail);
            } else {
              // Validation should have caught this; defensive skip.
              continue;
            }
            dedupedParents.push(parent);
          }

          // Process sequentially so we don't race on user lookups / registrations.
          //
          // Per-parent flow:
          //   PATH A: `parent.id` provided  -> explicit edit of an existing parent in
          //                                    this school. Other fields are applied via
          //                                    parentService.updateParent.
          //   PATH B: no `parent.id`        -> identify by email and follow the
          //                                    create-or-link rules below.
          //
          // PATH B sub-cases (email lookup):
          //   B1. No User exists with this email
          //       -> register new User, create Parent record, queue welcome email.
          //   B2. User exists but role != PARENT
          //       -> clear error: email is taken by a different role.
          //   B3. User exists, is a PARENT, has a Parent record in THIS school
          //       -> just link to the student. Do not overwrite their details
          //          (use the dedicated parent update flow for that).
          //   B4. User exists, is a PARENT, has a Parent record only in ANOTHER school
          //       -> clear error: parent is registered under another school.
          //   B5. User exists, role is PARENT (or unset) but no Parent record anywhere
          //       -> create a Parent record for this school and link. No welcome
          //          email -- they already have a login.
          for (const rawParent of dedupedParents) {
            // Strip fields that must never be set through the student endpoint.
            const { pin: _ignoredPin, ...parent } = rawParent as ParentInput & { pin?: string };
            let parentEntity: Parent;
            let generatedPassword: string | null = null;
            const normalizedEmail = parent.email?.toLowerCase().trim();

            // ---------- PATH A ----------
            if (parent.id) {
              const existingParent = await manager.findOne(Parent, {
                where: { id: parent.id, schoolId: userSchoolId },
                relations: ["user"],
              });
              if (!existingParent) {
                throw new Error(`Parent ${parent.id} not found in this school`);
              }

              // Avoid passing an unchanged email through, which would otherwise trigger
              // the "email already registered" uniqueness check unnecessarily.
              const currentEmail = existingParent.user?.email?.toLowerCase().trim();
              const updatePayload: any = { ...parent };
              if (!normalizedEmail || normalizedEmail === currentEmail) {
                delete updatePayload.email;
              } else {
                updatePayload.email = normalizedEmail;
              }

              parentEntity = await parentService.updateParent(existingParent.id, updatePayload, userSchoolId, {
                manager,
              });

              parentUsers.push(parentEntity);
              continue;
            }

            // ---------- PATH B ----------
            if (!normalizedEmail) {
              throw new Error("Parent email is required when no existing parent id is provided");
            }

            const existingUser = await manager.getRepository(User).findOne({
              where: { email: normalizedEmail },
            });

            if (!existingUser) {
              // B1: brand new user + parent + welcome email
              const parentResult = await authService.registerParentViaAdmin(
                {
                  firstName: parent.firstName,
                  lastName: parent.lastName,
                  email: normalizedEmail,
                  phone: parent.phone,
                  address: parent.address,
                  suffix: parent.suffix,
                  tempPassword: true,
                  role: UserRole.PARENT,
                  schoolId: userSchoolId,
                },
                { manager },
              );
              if (!parentResult.user) {
                throw new Error("Could not create parent as a user");
              }
              generatedPassword = parentResult.password;
              parentEntity = await userAssociationService.ensureParentRecord(
                parentResult.user,
                userSchoolId,
                parent,
                manager,
              );
              logger.info(`Created new parent user ${parentResult.user.id} via student update`);
            } else {
              // B2: email belongs to a non-parent role -> reject with a clear message
              if (existingUser.role && existingUser.role !== UserRole.PARENT) {
                throw new Error(
                  `The email "${normalizedEmail}" is already in use by a ${existingUser.role} account. Please use a different email for this parent.`,
                );
              }

              // Look up every Parent record this user has, across schools.
              const parentRecords = await manager.find(Parent, {
                where: { userId: existingUser.id },
              });
              const parentInThisSchool = parentRecords.find((p) => p.schoolId === userSchoolId);
              const parentInOtherSchool = parentRecords.find((p) => p.schoolId !== userSchoolId);

              if (parentInThisSchool) {
                // B3: already a parent in this school -> just link, do not overwrite
                parentEntity = parentInThisSchool;
                parentEntity.user = existingUser;
                logger.info(
                  `Linking existing parent ${parentInThisSchool.id} (user ${existingUser.id}) to student ${studentId} via email match`,
                );
              } else if (parentInOtherSchool) {
                // B4: registered as a parent under another school -> reject
                throw new Error(
                  `The email "${normalizedEmail}" is already registered as a parent in another school. Ask your administrator to add them by selecting the existing parent record if appropriate.`,
                );
              } else {
                // B5: user exists but has no Parent record yet -> create one here
                parentEntity = await userAssociationService.ensureParentRecord(
                  existingUser,
                  userSchoolId,
                  parent,
                  manager,
                );
                logger.info(
                  `Created Parent record for existing user ${existingUser.id} in school ${userSchoolId}`,
                );
              }
            }

            (parentEntity as any).generatedPassword = generatedPassword;
            (parentEntity as any).email = normalizedEmail || parentEntity.user?.email;
            parentUsers.push(parentEntity);
          }

          // Replace student's parent associations with exact list (supports add/remove)
          const parentIds = parentUsers.map((p) => p.id);
          await parentService.replaceStudentParents(studentId, parentIds, { manager });
        }

        // 6. Update/create documents
        //    Replace semantics, consistent with parents:
        //      - documents omitted (undefined)  -> no change
        //      - documents: []                  -> all existing documents removed
        //      - documents: [...]               -> upsert provided ones, remove any not in the list
        const { user } = req as AuthenticatedRequest;
        const documentEntities: StudentDocument[] = [];
        if (documents && Array.isArray(documents)) {
          const existingDocuments = await manager.find(StudentDocument, {
            where: { studentId },
          });
          const existingDocsById = new Map(existingDocuments.map((d) => [d.id, d]));
          const incomingIds = new Set<number>();

          for (const doc of documents) {
            if (doc.id) {
              const existingDocument = existingDocsById.get(Number(doc.id));
              if (!existingDocument) {
                throw new Error(`Document with ID ${doc.id} not found for this student`);
              }
              incomingIds.add(existingDocument.id);

              if (doc.docName !== undefined) existingDocument.docName = doc.docName;
              if (doc.documentUrl !== undefined) existingDocument.documentUrl = doc.documentUrl;

              const updatedDocument = await manager.save(StudentDocument, existingDocument);
              documentEntities.push(updatedDocument);
            } else {
              const documentEntity = await studentDocumentService.createStudentDocument(
                {
                  studentId: studentId,
                  docName: doc.docName,
                  documentUrl: doc.documentUrl,
                  uploadedBy: user.id,
                },
                { manager },
              );
              documentEntities.push(documentEntity);
            }
          }

          // Remove documents that exist on the student but were not in the incoming list.
          const docsToRemove = existingDocuments.filter((d) => !incomingIds.has(d.id));
          if (docsToRemove.length > 0) {
            await manager.remove(StudentDocument, docsToRemove);
          }
        }

        return {
          parents: parentUsers,
          medical: medicalEntity,
          emergencyContact: emergencyContactEntity,
          studentDocuments: documentEntities,
          school: school,
        };
      });

      // Fetch fresh student after transaction commits (avoids stale data from uncommitted changes)
      const updatedStudent = await studentService.getStudentById(studentId);

      res.status(200).json({
        success: true,
        message: "Student updated successfully",
        data: {
          student: updatedStudent,
          ...result,
        },
      });

      // Send emails to newly created parents
      try {
        const schoolName = result.school?.schoolName || "Your School";
        const studentName =
          `${(updatedStudent as any).user?.firstName || ""} ${(updatedStudent as any).user?.lastName || ""}`.trim() || "Your Child";
        const { emailService } = await import("../../shared/services/email.service");

        if (result.parents && Array.isArray(result.parents)) {
          for (const parent of result.parents) {
            if ((parent as any).generatedPassword) {
              await emailService.sendParentAccountCreationEmail(
                (parent as any).email,
                `${(parent as any).user?.firstName || ""} ${(parent as any).user?.lastName || ""}`.trim() || "Parent",
                (parent as any).generatedPassword,
                schoolName,
                studentName,
                (parent as any).pin,
              );
            }
          }
        }
      } catch (emailErr) {
        logger.error("Failed to send welcome emails in updateStudent:", emailErr);
      }

      return;
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || "Failed to update student",
      });
    }
  }

  // GET /students/export
  // Returns the filtered student list as an .xlsx download. Reuses the same
  // query parameters as `GET /students` so the export reflects whatever the
  // user is currently looking at (classroom filter, search, status, etc.).
  async exportStudents(req: Request, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { classroomId, staffId, search, admissionNumber, status, sortBy, sortOrder } = req.query;
      const userSchoolId = requireSchoolId(req);

      // Mirror the staff scoping behaviour from getAllStudents: staff users may
      // only export students for their own assigned classes.
      let resolvedStaffId: number | undefined;
      if (staffId) {
        const parsedStaffId = parseInt(staffId as string, 10);
        if (isNaN(parsedStaffId)) {
          return res.status(400).json({ success: false, message: "Invalid staffId" });
        }
        const authReq = req as AuthenticatedRequest;
        if (authReq.user?.role === UserRole.STAFF) {
          const staffRelation = (authReq.user as any).teacher ?? authReq.user.staff;
          const staffRecord = Array.isArray(staffRelation) ? staffRelation[0] : staffRelation;
          const myStaffId = staffRecord?.id;
          if (myStaffId !== parsedStaffId) {
            return res.status(403).json({
              success: false,
              message: "Staff can only export students for their own assigned classes",
            });
          }
        }
        resolvedStaffId = parsedStaffId;
      }

      const filters = {
        schoolId: userSchoolId,
        ...(classroomId && { classroomId: parseInt(classroomId as string, 10) }),
        ...(resolvedStaffId && { staffId: resolvedStaffId }),
        ...(search && { search: search as string }),
        ...(admissionNumber && { admissionNumber: admissionNumber as string }),
        ...(status && { status: status as any }),
        ...(sortBy && { sortBy: sortBy as string }),
        ...(sortOrder && { sortOrder: sortOrder as "ASC" | "DESC" }),
      };

      const students = await studentService.getStudentsForExport(filters);

      const columns = [
        { header: "Admission Number", width: 18 },
        { header: "First Name", width: 18 },
        { header: "Last Name", width: 18 },
        { header: "Middle Name", width: 18 },
        { header: "Gender", width: 10 },
        { header: "Date of Birth", width: 14 },
        { header: "Age", width: 12 },
        { header: "Classroom", width: 22 },
        { header: "Status", width: 12 },
        { header: "Enrolment Date", width: 14 },
        { header: "Schedule", width: 28 },
        { header: "Email", width: 28 },
        { header: "Phone", width: 16 },
        { header: "Address", width: 32 },
        { header: "Parents", width: 32 },
        { header: "Parent Emails", width: 32 },
        { header: "Parent Phones", width: 22 },
        { header: "Emergency Contact Name", width: 22 },
        { header: "Emergency Contact Phone", width: 18 },
        { header: "Allergies", width: 28 },
      ];

      const computeAge = (dob: Date | string | undefined | null): string => {
        if (!dob) return "";
        const birth = new Date(dob);
        if (Number.isNaN(birth.getTime())) return "";
        const today = new Date();
        if (birth > today) return "0 months";
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        if (today.getDate() < birth.getDate()) months--;
        if (months < 0) {
          years--;
          months += 12;
        }
        if (years > 0) return `${years} ${years === 1 ? "year" : "years"}`;
        return `${Math.max(0, months)} ${Math.max(0, months) === 1 ? "month" : "months"}`;
      };

      const toDate = (value: Date | string | null | undefined): Date | null => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      };

      const rows: unknown[][] = students.map((student: any) => {
        const parents: any[] = Array.isArray(student.parents) ? student.parents : [];
        const parentNames = parents
          .map((p) => `${p?.user?.firstName ?? ""} ${p?.user?.lastName ?? ""}`.trim())
          .filter(Boolean)
          .join("; ");
        const parentEmails = parents
          .map((p) => p?.user?.email)
          .filter(Boolean)
          .join("; ");
        const parentPhones = parents
          .map((p) => p?.user?.phone)
          .filter(Boolean)
          .join("; ");

        return [
          student.admissionNumber ?? "",
          student.user?.firstName ?? "",
          student.user?.lastName ?? "",
          student.user?.middleName ?? "",
          student.user?.gender ?? "",
          toDate(student.user?.dateOfBirth),
          computeAge(student.user?.dateOfBirth),
          student.currentClassroom?.classroomName ?? "",
          student.status ?? "",
          toDate(student.enrolmentDate),
          Array.isArray(student.schedule) ? student.schedule.join("; ") : "",
          student.user?.email ?? "",
          student.user?.phone ?? "",
          student.user?.address ?? "",
          parentNames,
          parentEmails,
          parentPhones,
          student.emergencyContact?.contactName ?? "",
          student.emergencyContact?.phone ?? "",
          student.medicalRecord?.allergies ?? "",
        ];
      });

      const buffer = await buildXlsxBuffer({
        sheetName: "Students",
        title: "Students export",
        columns,
        rows,
      });
      const today = new Date().toISOString().split("T")[0];
      const baseName = filters.classroomId
        ? `classroom-${filters.classroomId}-children`
        : "students";
      const filename = `${sanitizeXlsxFilename(baseName)}-${today}.xlsx`;

      return sendXlsx(res, filename, buffer);
    } catch (error: any) {
      logger?.error?.("Error exporting students:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to export students",
      });
    }
  }

  async deleteStudent(req: AuthenticatedRequest, res: Response) {
    try {
      const id = req.params["id"];
      if (!id) {
        return res.status(400).json({ success: false, message: "Student ID is required" });
      }

      const studentId = Number(id);

      const result = await studentService.deleteStudent(studentId);

      if (result.success) {
        if (req.user) {
          await activityLogger.log({
            userId: req.user.id,
            resource: "student",
            action: "delete",
            title: "Student deleted",
            description: `Student #${studentId} deleted by ${req.user.name} `,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }
        return res.status(200).json({ success: true, message: result.message });
      } else {
        return res.status(404).json({ success: false, message: result.message });
      }
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  async updateStudentStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const id = req.params["id"];
      const disciplinarianId = req.user?.id;

      if (!disciplinarianId) {
        return res.status(400).json({ success: false, message: "user not autheniticated" });
      }

      if (!id) {
        return res.status(400).json({ success: false, message: "Student ID is required" });
      }

      const studentId = Number(id);
      // Accept both 'type' and 'status' for flexibility (frontend may send either)
      const statusType = req.body.type ?? req.body.status;

      const result = await studentService.updateStudentStatus({
        studentId,
        disciplinarianId,
        type: statusType,
        reason: req.body.reason,
        endAt: req.body.endAt,
      });

      if (result.success) {
        if (req.user) {
          await activityLogger.log({
            userId: req.user.id,
            resource: "student",
            action: "update",
            title: "Student status updated",
            description: `Student #${studentId} status updated to ${statusType} by ${req.user.name} `,
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
          });
        }
        return res.status(200).json({ success: true, message: result.message });
      } else {
        return res.status(404).json({ success: false, message: result.message });
      }
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }
}
