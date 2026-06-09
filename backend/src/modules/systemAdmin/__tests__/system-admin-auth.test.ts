import request from "supertest";
import express from "express";
import { systemAdminAuthRoutes } from "../auth/routes/system-admin-auth.routes";
import { systemAdminAuthService } from "../auth/services/system-admin-auth.service";
import { UserRole } from "../../shared/entities/EntityEnums";

const app = express();
app.use(express.json());
// Stub req.ip etc if needed, rate limit works if we give IP
app.set("trust proxy", true);
app.use("/system-admin/auth", systemAdminAuthRoutes);

describe("System Admin Auth Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /system-admin/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          email: "admin@example.com",
          phone: "1234567890",
          name: "Admin User",
          role: UserRole.SYSTEM_ADMIN,
          isActive: true,
          emailVerified: true,
          phoneVerified: true,
          mfaEnabled: false,
          isSystemGeneratedPassword: false,
        },
        accessToken: "access_token",
        refreshToken: "refresh_token",
        message: "Login successful",
      };

      jest.spyOn(systemAdminAuthService, "login").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post("/system-admin/auth/login")
        .send({ email: "admin@example.com", password: "password123" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it("should return 401 for invalid credentials", async () => {
      jest.spyOn(systemAdminAuthService, "login").mockResolvedValue({
        success: false,
        message: "Invalid email/phone or password",
        httpStatus: 401,
      } as any);

      const response = await request(app)
        .post("/system-admin/auth/login")
        .send({ email: "wrong@example.com", password: "wrong" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 400 validation error if password is missing", async () => {
      const response = await request(app)
        .post("/system-admin/auth/login")
        .send({ email: "admin@example.com" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain("Password is required");
    });
  });

  describe("POST /system-admin/auth/verify-mfa", () => {
    it("should verify MFA successfully", async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          email: "admin@example.com",
          role: UserRole.SYSTEM_ADMIN,
        },
        accessToken: "access_token",
        refreshToken: "refresh_token",
        message: "Login successful",
      };

      jest.spyOn(systemAdminAuthService, "verifyMFA").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post("/system-admin/auth/verify-mfa")
        .send({ mfaToken: "some_mfa_token", code: "123456" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });
  });
});
