import request from "supertest";
import express from "express";

// Mock the entire middleware module so any internal requireRole uses won't break
jest.mock("../../auth/middleware/middleware", () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = { id: 1, role: "SYSTEM_ADMIN", name: "Admin" };
    next();
  },
  requireSystemAdmin: (_req: any, _res: any, next: any) => {
    next();
  },
  requireRole: () => (_req: any, _res: any, next: any) => next(),
  rateLimit: () => (_req: any, _res: any, next: any) => next(),
  securityHeaders: (_req: any, _res: any, next: any) => next(),
  requestLogger: (_req: any, _res: any, next: any) => next(),
  authenticateWithSkipList: (_req: any, _res: any, next: any) => next(),
  extractDeviceInfo: () => ({}),
}));

// Mock express-validator validation errors to properly test behavior when validation passes/fails
jest.mock("express-validator", () => {
  const original = jest.requireActual("express-validator");
  return {
    ...original,
    validationResult: (req: any) => ({
      isEmpty: () => !req.validationErrors || req.validationErrors.length === 0,
      array: () => req.validationErrors || [],
    })
  };
});

jest.mock("../invitation/validation/system-admin-invitation.validation", () => {
  return {
    createSystemAdminInvitationValidation: [
      (req: any, _res: any, next: any) => {
        if (!req.body.email) {
          req.validationErrors = [{ msg: "Valid email is required" }];
        }
        next();
      }
    ],
    acceptSystemAdminInvitationValidation: [
      (req: any, _res: any, next: any) => {
        if (!req.body.password) {
          req.validationErrors = [{ msg: "Password is required" }];
        }
        next();
      }
    ],
    handleValidationErrors: (req: any, res: any, next: any) => {
      const errors = req.validationErrors;
      if (errors && errors.length > 0) {
        res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.map((error: any) => error.msg),
        });
        return;
      }
      next();
    }
  };
});

import { systemAdminInvitationService } from "../invitation/services/system-admin-invitation.service";

const app = express();
app.use(express.json());

// Re-import after mocking
const { systemAdminInvitationRoutes } = require("../invitation/routes/system-admin-invitation.routes");
app.set("trust proxy", true);
app.use("/system-admin/invitations", systemAdminInvitationRoutes);

describe("System Admin Invitation Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /system-admin/invitations/accept", () => {
    it("should accept invitation successfully", async () => {
      const mockResponse = {
        success: true,
        message: "System administrator account created successfully. You can now sign in.",
        user: { id: 2, email: "newadmin@example.com" },
      };

      jest.spyOn(systemAdminInvitationService, "acceptInvitation").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .post("/system-admin/invitations/accept")
        .send({
          token: "valid-token",
          email: "newadmin@example.com",
          firstName: "John",
          lastName: "Doe",
          password: "StrongPassword123!"
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockResponse);
    });

    it("should return 400 for validation errors (missing password)", async () => {
      const response = await request(app)
        .post("/system-admin/invitations/accept")
        .send({
          token: "valid-token",
          email: "newadmin@example.com",
          firstName: "John",
          lastName: "Doe",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe("POST /system-admin/invitations", () => {
    it("should create invitation successfully", async () => {
      const mockResponse = {
        success: true,
        message: "System administrator invitation sent successfully",
        invitation: {
          id: 1,
          email: "invitee@example.com",
          token: "generated-token",
          expiresAt: new Date()
        }
      };

      jest.spyOn(systemAdminInvitationService, "createInvitation").mockResolvedValue(mockResponse as any);

      const activityLogger = require("../../shared/services/activity-logger.service").activityLogger;
      jest.spyOn(activityLogger, "log").mockResolvedValue(true as any);

      const response = await request(app)
        .post("/system-admin/invitations")
        .send({
          email: "invitee@example.com",
          firstName: "Jane",
          lastName: "Smith",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(mockResponse.message);
    });

    it("should fail creation on validation error", async () => {
      const response = await request(app)
        .post("/system-admin/invitations")
        .send({
          firstName: "Jane",
          lastName: "Smith",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toContain("Valid email is required");
    });
  });
});
