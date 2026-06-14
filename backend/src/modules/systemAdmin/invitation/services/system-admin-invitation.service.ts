import crypto from "crypto";
import { Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { User } from "../../../shared/entities/User";
import { Admin } from "../../../shared/entities/Admin";
import { UserRole } from "../../../shared/entities/EntityEnums";
import { validationService } from "../../../auth/services/validation.service";
import { AUTH_MESSAGES } from "../../../auth/constants/messages";
import { AuthUser } from "../../../auth/types/types";
import { logger } from "../../../shared/utils/logger";
import { SystemAdminInvitation } from "../entities/SystemAdminInvitation";
import { SYSTEM_ADMIN_INVITATION_MESSAGES } from "../constants/messages";
import { systemAdminInvitationEmailService } from "./system-admin-invitation-email.service";

export interface CreateSystemAdminInvitationInput {
  email: string;
  firstName: string;
  lastName: string;
  invitedById: number;
}

export interface AcceptSystemAdminInvitationInput {
  token: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface SystemAdminInvitationSummary {
  id: number;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  token: string;
  expiresAt: Date;
}

function toAuthUser(user: User): AuthUser {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: displayName,
    role: user.role,
    isActive: user.isActive,
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    mfaEnabled: user.mfaEnabled,
    isSystemGeneratedPassword: user.isSystemGeneratedPassword,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class SystemAdminInvitationService {
  private invitationRepository: Repository<SystemAdminInvitation>;
  private userRepository: Repository<User>;

  constructor() {
    this.invitationRepository = AppDataSource.getRepository(SystemAdminInvitation);
    this.userRepository = AppDataSource.getRepository(User);
  }

  async createInvitation(
    data: CreateSystemAdminInvitationInput,
  ): Promise<{ success: boolean; message: string; invitation?: SystemAdminInvitationSummary }> {
    try {
      const email = normalizeEmail(data.email);

      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.USER_ALREADY_EXISTS };
      }

      const pendingInvite = await this.invitationRepository.findOne({
        where: { email, hasAccepted: false },
      });
      if (pendingInvite && pendingInvite.expiresAt > new Date()) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.PENDING_INVITATION_EXISTS };
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = this.invitationRepository.create({
        email,
        firstName: validationService.sanitizeInput(data.firstName),
        lastName: validationService.sanitizeInput(data.lastName),
        token,
        invitedById: data.invitedById,
        expiresAt,
        hasAccepted: false,
      });

      const saved = await this.invitationRepository.save(invitation);

      const inviter = await this.userRepository.findOne({ where: { id: data.invitedById } });
      await systemAdminInvitationEmailService.sendInvitation(saved, inviter || undefined);

      logger.info(`System admin invitation created for ${email}`);

      return {
        success: true,
        message: SYSTEM_ADMIN_INVITATION_MESSAGES.INVITATION_SENT,
        invitation: {
          id: saved.id,
          email: saved.email,
          firstName: saved.firstName,
          lastName: saved.lastName,
          token: saved.token,
          expiresAt: saved.expiresAt,
        },
      };
    } catch (error) {
      console.error("\n[SystemAdminInvitationService] FATAL ERROR IN createInvitation:\n", error, "\n");
      logger.error("Error creating system admin invitation:", error);
      const message = error instanceof Error ? error.message : SYSTEM_ADMIN_INVITATION_MESSAGES.INVITATION_CREATE_FAILED;
      return { success: false, message };
    }
  }

  async acceptInvitation(
    data: AcceptSystemAdminInvitationInput,
  ): Promise<{ success: boolean; message: string; user?: AuthUser }> {
    try {
      const email = normalizeEmail(data.email);

      const invitation = await this.invitationRepository.findOne({
        where: { token: data.token.trim() },
      });

      if (!invitation) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.INVALID_TOKEN };
      }

      if (invitation.hasAccepted) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.INVITATION_ALREADY_ACCEPTED };
      }

      if (invitation.expiresAt < new Date()) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.INVITATION_EXPIRED };
      }

      if (normalizeEmail(invitation.email) !== email) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.EMAIL_MISMATCH };
      }

      const existingUser = await this.userRepository.findOne({ where: { email } });
      if (existingUser) {
        return { success: false, message: SYSTEM_ADMIN_INVITATION_MESSAGES.USER_ALREADY_EXISTS };
      }

      const hashedPassword = await validationService.hashPassword(data.password);

      const result = await AppDataSource.transaction(async (manager) => {
        const invitationRepo = manager.getRepository(SystemAdminInvitation);
        const userRepo = manager.getRepository(User);
        const adminRepo = manager.getRepository(Admin);

        const lockedInvite = await invitationRepo.findOne({
          where: { id: invitation.id, token: invitation.token },
        });
        if (!lockedInvite || lockedInvite.hasAccepted) {
          return { ok: false as const, message: SYSTEM_ADMIN_INVITATION_MESSAGES.INVITATION_ALREADY_ACCEPTED };
        }
        if (lockedInvite.expiresAt < new Date()) {
          return { ok: false as const, message: SYSTEM_ADMIN_INVITATION_MESSAGES.INVITATION_EXPIRED };
        }

        const user = userRepo.create({
          firstName: validationService.sanitizeInput(data.firstName),
          lastName: validationService.sanitizeInput(data.lastName),
          email,
          password: hashedPassword,
          role: UserRole.SYSTEM_ADMIN,
          emailVerified: true,
          phoneVerified: false,
          isActive: true,
          loginAttempts: 0,
          mfaEnabled: false,
          passwordHistory: [],
          schoolId: undefined,
        });

        const savedUser = await userRepo.save(user);

        const adminRow = await adminRepo.findOne({ where: { userId: savedUser.id } });
        if (adminRow) {
          throw new Error(AUTH_MESSAGES.INTERNAL_ERROR);
        }

        lockedInvite.hasAccepted = true;
        lockedInvite.acceptedAt = new Date();
        await invitationRepo.save(lockedInvite);

        return { ok: true as const, user: savedUser };
      });

      if (!result.ok) {
        return { success: false, message: result.message };
      }

      const displayName = [result.user.firstName, result.user.lastName].filter(Boolean).join(" ");
      try {
        await systemAdminInvitationEmailService.sendWelcome(email, displayName || result.user.lastName);
      } catch (emailError) {
        logger.error("Failed to send system admin welcome email:", emailError);
      }

      logger.info(`System admin invitation accepted for ${email}`);

      return {
        success: true,
        message: SYSTEM_ADMIN_INVITATION_MESSAGES.ACCEPT_SUCCESS,
        user: toAuthUser(result.user),
      };
    } catch (error) {
      console.error("\n[SystemAdminInvitationService] FATAL ERROR IN acceptInvitation:\n", error, "\n");
      logger.error("Error accepting system admin invitation:", error);
      const message = error instanceof Error ? error.message : SYSTEM_ADMIN_INVITATION_MESSAGES.ACCEPT_FAILED;
      return { success: false, message };
    }
  }
}

export const systemAdminInvitationService = new SystemAdminInvitationService();
