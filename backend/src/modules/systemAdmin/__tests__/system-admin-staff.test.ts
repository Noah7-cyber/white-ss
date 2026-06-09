import request from "supertest";
import express from "express";

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

import { systemAdminStaffRoutes } from "../staff/routes/system-admin-staff.routes";
import { systemAdminStaffService } from "../staff/services/system-admin-staff.service";

const app = express();
app.use(express.json());
app.set("trust proxy", true);
app.use("/system-admin/staff", systemAdminStaffRoutes);

describe("System Admin Staff Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /system-admin/staff", () => {
    it("should list staff successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Staff retrieved successfully",
        staff: [
          {
            id: 1,
            user: { firstName: "John", lastName: "Doe" }
          }
        ],
        pagination: { pos: 0, delta: 10, count: 1 }
      };

      jest.spyOn(systemAdminStaffService, "listStaff").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .get("/system-admin/staff")
        .query({ pos: 0, delta: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it("should return 400 on list staff failure", async () => {
      const mockResponse = {
        success: false,
        message: "Failed to retrieve staff",
      };

      jest.spyOn(systemAdminStaffService, "listStaff").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .get("/system-admin/staff");

      expect(response.status).toBe(400);
      expect(response.body).toEqual(mockResponse);
    });
  });

  describe("GET /system-admin/staff/:id", () => {
    it("should get staff by ID successfully", async () => {
      const mockResponse = {
        success: true,
        message: "Staff retrieved successfully",
        staff: {
          id: 1,
          user: { firstName: "John", lastName: "Doe" }
        }
      };

      jest.spyOn(systemAdminStaffService, "getStaffById").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .get("/system-admin/staff/1");

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResponse);
    });

    it("should return 400 on invalid staff ID format", async () => {
      // Assuming validation throws an error or rejects invalid ID directly
      const response = await request(app)
        .get("/system-admin/staff/invalid_id");

      // Based on the validation middleware in the source, usually returns 400
      expect(response.status).toBe(400);
    });

    it("should return 404 when staff is not found", async () => {
      const mockResponse = {
        success: false,
        message: "Staff not found",
      };

      jest.spyOn(systemAdminStaffService, "getStaffById").mockResolvedValue(mockResponse as any);

      const response = await request(app)
        .get("/system-admin/staff/999");

      expect(response.status).toBe(404);
      expect(response.body).toEqual(mockResponse);
    });
  });
});
