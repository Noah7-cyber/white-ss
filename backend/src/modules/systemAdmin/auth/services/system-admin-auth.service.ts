import { Repository } from "typeorm";
import { AppDataSource } from "../../../core/config/database";
import { User } from "../../../shared/entities/User";
import { Admin } from "../../../shared/entities/Admin";
import { UserRole } from "../../../shared/entities/EntityEnums";
import { validationService } from "../../../auth/services/validation.service";
import { jwtService } from "../../../auth/services/jwt.service";
import { sessionService } from "../../../auth/services/session.service";
import { tokenService } from "../../../auth/services/token.service";
import { AUTH_MESSAGES, getLoginSuccessMessage } from "../../../auth/constants/messages";
import { AuthResponse, AuthUser, DeviceInfo, LoginRequest, MFAVerificationRequest } from "../../../auth/types/types";
import { SYSTEM_ADMIN_AUTH_MESSAGES } from "../constants/messages";

const LOGIN_USER_SELECT = [
  "id",
  "email",
  "phone",
  "password",
  "role",
  "schoolId",
  "firstName",
  "lastName",
  "middleName",
  "emailVerified",
  "phoneVerified",
  "isActive",
  "loginAttempts",
  "lockedUntil",
  "mfaEnabled",
  "mfaSecret",
  "backupCodes",
  "isSystemGeneratedPassword",
] as const;

export class SystemAdminAuthService {
  private userRepository: Repository<User>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  async login(data: LoginRequest, deviceInfo: DeviceInfo): Promise<AuthResponse> {
    if (!data.email && !data.phone) {
      return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.IDENTIFIER_REQUIRED };
    }

    const identifier = data.email || data.phone || "unknown";
    const rateLimit = await tokenService.checkRateLimit(identifier, "login");
    if (!rateLimit.allowed) {
      return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.TOO_MANY_LOGIN_ATTEMPTS };
    }

    try {
      const users = await this.findUsersByIdentifier(data.email, data.phone);
      if (users.length === 0) {
        return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.INVALID_CREDENTIALS };
      }

      let authenticatedUser: User | undefined;
      for (const u of users) {
        if (await validationService.comparePassword(data.password, u.password)) {
          authenticatedUser = u;
          break;
        }
      }

      if (!authenticatedUser) {
        return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.INVALID_CREDENTIALS };
      }

      if (authenticatedUser.role !== UserRole.SYSTEM_ADMIN) {
        return {
          success: false,
          message: SYSTEM_ADMIN_AUTH_MESSAGES.NOT_SYSTEM_ADMIN,
          httpStatus: 403,
        };
      }

      const schoolId = (authenticatedUser as User & { schoolId?: number | null }).schoolId;
      if (schoolId != null) {
        return {
          success: false,
          message: SYSTEM_ADMIN_AUTH_MESSAGES.MISCONFIGURED_SYSTEM_ADMIN,
          httpStatus: 403,
        };
      }

      const adminLink = await AppDataSource.getRepository(Admin).findOne({
        where: { userId: authenticatedUser.id },
        select: { id: true },
      });
      if (adminLink) {
        return {
          success: false,
          message: SYSTEM_ADMIN_AUTH_MESSAGES.MISCONFIGURED_SYSTEM_ADMIN,
          httpStatus: 403,
        };
      }

      if (!authenticatedUser.isActive) {
        return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.ACCOUNT_DEACTIVATED };
      }

      if (authenticatedUser.lockedUntil && new Date() < authenticatedUser.lockedUntil) {
        const lockTimeRemaining = Math.ceil((authenticatedUser.lockedUntil.getTime() - Date.now()) / (1000 * 60));
        return {
          success: false,
          message: `Account is locked. Try again in ${lockTimeRemaining} minutes.`,
        };
      }

      const verificationCheck = this.checkVerificationStatus(authenticatedUser, data.email, data.phone);
      if (!verificationCheck.verified) {
        return {
          success: false,
          message: verificationCheck.message || "Verification required",
        };
      }

      await this.userRepository.update(authenticatedUser.id, {
        loginAttempts: 0,
        lastLogin: new Date(),
      });

      if (authenticatedUser.mfaEnabled) {
        const mfaToken = jwtService.generateMFAToken({
          userId: authenticatedUser.id,
          email: authenticatedUser.email || "",
          phone: authenticatedUser.phone || "",
          role: UserRole.SYSTEM_ADMIN,
        });

        return {
          success: true,
          user: this.toAuthUser(authenticatedUser),
          requiresMFA: true,
          mfaToken,
          message: SYSTEM_ADMIN_AUTH_MESSAGES.MFA_REQUIRED,
        };
      }

      const session = await sessionService.createSession(authenticatedUser.id, deviceInfo);
      const { accessToken, refreshToken } = jwtService.generateTokenPair({
        userId: authenticatedUser.id,
        email: authenticatedUser.email || "",
        phone: authenticatedUser.phone || "",
        role: UserRole.SYSTEM_ADMIN,
        sessionId: session.id,
      });

      return {
        success: true,
        user: this.toAuthUser(authenticatedUser),
        accessToken,
        refreshToken,
        message: getLoginSuccessMessage(UserRole.SYSTEM_ADMIN),
      };
    } catch (error) {
      console.error("System admin login error:", error);
      return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.LOGIN_FAILED };
    }
  }

  async verifyMFA(data: MFAVerificationRequest, deviceInfo: DeviceInfo): Promise<AuthResponse> {
    try {
      const mfaPayload = await jwtService.verifyMFAToken(data.mfaToken);

      const user = await this.userRepository.findOne({
        where: { id: mfaPayload.userId },
        select: [...LOGIN_USER_SELECT] as any,
      });

      if (!user || user.role !== UserRole.SYSTEM_ADMIN) {
        return {
          success: false,
          message: SYSTEM_ADMIN_AUTH_MESSAGES.NOT_SYSTEM_ADMIN,
          httpStatus: 403,
        };
      }

      if (user.schoolId != null) {
        return {
          success: false,
          message: SYSTEM_ADMIN_AUTH_MESSAGES.MISCONFIGURED_SYSTEM_ADMIN,
          httpStatus: 403,
        };
      }

      if (!user.mfaEnabled || !user.mfaSecret) {
        return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.MFA_NOT_ENABLED };
      }

      const isValidMFA = /^\d{6}$/.test(data.code);
      if (!isValidMFA) {
        return { success: false, message: SYSTEM_ADMIN_AUTH_MESSAGES.MFA_INVALID };
      }

      await this.userRepository.update(user.id, { lastLogin: new Date() });

      const session = await sessionService.createSession(user.id, deviceInfo);
      const { accessToken, refreshToken } = jwtService.generateTokenPair({
        userId: user.id,
        email: user.email || "",
        phone: user.phone || "",
        role: UserRole.SYSTEM_ADMIN,
        sessionId: session.id,
      });

      return {
        success: true,
        user: this.toAuthUser(user),
        accessToken,
        refreshToken,
        message: getLoginSuccessMessage(UserRole.SYSTEM_ADMIN),
      };
    } catch (error) {
      console.error("System admin MFA verification error:", error);
      return { success: false, message: AUTH_MESSAGES.MFA_VERIFICATION_FAILED };
    }
  }

  private toAuthUser(user: User): AuthUser {
    const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      name: displayName,
      role: UserRole.SYSTEM_ADMIN,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      mfaEnabled: user.mfaEnabled,
      isSystemGeneratedPassword: user.isSystemGeneratedPassword,
    };
  }

  private checkVerificationStatus(user: User, email?: string, phone?: string): { verified: boolean; message?: string } {
    if (email && !user.emailVerified) {
      return { verified: false, message: AUTH_MESSAGES.EMAIL_NOT_VERIFIED };
    }
    if (phone && !user.phoneVerified) {
      return { verified: false, message: AUTH_MESSAGES.PHONE_NOT_VERIFIED };
    }
    return { verified: true };
  }

  private async findUsersByIdentifier(email?: string, phone?: string): Promise<User[]> {
    const select = [...LOGIN_USER_SELECT] as any;

    if (email) {
      const normalizedEmail = email.toLowerCase();
      const usersByEmail = await this.userRepository.find({
        where: { email: normalizedEmail } as any,
        select,
      });
      if (!usersByEmail.length) return [];
      return usersByEmail;
    }

    if (phone) {
      const normalizedPhone = validationService.normalizePhone(phone);
      return this.userRepository.find({
        where: { phone: normalizedPhone } as any,
        select,
      });
    }

    return [];
  }
}

export const systemAdminAuthService = new SystemAdminAuthService();
