import express, { NextFunction, Request, Response } from "express";
import {
  authenticate,
  AuthenticatedRequest,
  requireSystemAdmin,
  securityHeaders,
  requestLogger,
} from "../../../auth/middleware/middleware";
import { systemAdminAnalyticsController } from "../controllers/system-admin-analytics.controller";

export const systemAdminAnalyticsRoutes = express.Router();

systemAdminAnalyticsRoutes.use(securityHeaders);
systemAdminAnalyticsRoutes.use(requestLogger);
systemAdminAnalyticsRoutes.use(authenticate);
systemAdminAnalyticsRoutes.use((req: Request, res: Response, next: NextFunction) => {
  requireSystemAdmin(req as AuthenticatedRequest, res, next);
});

systemAdminAnalyticsRoutes.get(
  "/dashboard",
  (req, res) => systemAdminAnalyticsController.getDashboardAnalytics(req as AuthenticatedRequest, res),
);

export default systemAdminAnalyticsRoutes;
