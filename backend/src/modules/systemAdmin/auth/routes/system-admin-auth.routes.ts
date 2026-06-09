import express from "express";
import { rateLimit, securityHeaders, requestLogger } from "../../../auth/middleware/middleware";
import { systemAdminAuthController } from "../controllers/system-admin-auth.controller";
import {
  handleValidationErrors,
  validateSystemAdminLogin,
  validateSystemAdminMFA,
} from "../validation/system-admin-auth.validation";

export const systemAdminAuthRoutes = express.Router();

systemAdminAuthRoutes.use(securityHeaders);
systemAdminAuthRoutes.use(requestLogger);

systemAdminAuthRoutes.post(
  "/login",
  rateLimit("login"),
  validateSystemAdminLogin,
  handleValidationErrors,
  systemAdminAuthController.login.bind(systemAdminAuthController),
);

systemAdminAuthRoutes.post(
  "/verify-mfa",
  validateSystemAdminMFA,
  handleValidationErrors,
  systemAdminAuthController.verifyMFA.bind(systemAdminAuthController),
);

export default systemAdminAuthRoutes;
