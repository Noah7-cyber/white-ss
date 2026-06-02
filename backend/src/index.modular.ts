import { app, initializeDatabase } from "./app.modular";
import http from "http";

import { countrySeederService } from "./modules/shared/seed/country-seeder.service";
import { qualificationSeederService } from "./modules/shared/seed/qualification-seeder.service";
import { stateSeederService } from "./modules/shared/services/state-seeder.service";
import { citySeederService } from "./modules/shared/services/city-seeder.service";
import { websocketService } from "./modules/notification/services/websocket.service";
import { curriculumTemplateSeederService } from "./modules/shared/seed/curriculum-template-seeder.service";
import { subscriptionCatalogSeederService } from "./modules/shared/seed/subscription-catalog-seeder.service";
import { rolesService } from "./modules/roles";
// import { subdomainGuard } from "./modules/shared";

const PORT = process.env["PORT"] || 3001;

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    try {
      await subscriptionCatalogSeederService.syncCatalog();
    } catch (error: any) {
      console.error("Subscription catalog sync failed (server will continue):", error?.message || error);
    }

    // Idempotent sync of all DB role permissions so newly added entries in Resources
    // (e.g. invoice) get applied across every school on boot. The per-school system
    // Super Admin role gets full CRUD; all other roles get rows created with all flags
    // = false so admin-configured permissions are preserved.
    try {
      console.log("[Startup] Syncing role permissions across all schools...");
      await rolesService.bootstrapAllRolePermissions();
      console.log("[Startup] Role permissions sync complete.");
    } catch (error: any) {
      console.error("Role permissions sync failed (server will continue):", error?.message || error);
    }

    // Seeding disabled by default; set ENABLE_SEEDING=true to run seeders on startup
    if (process.env["ENABLE_SEEDING"] === "true") {
      try {
        await countrySeederService.seedCountries();
        await qualificationSeederService.seedQualifications();
        await stateSeederService.seedStates();
        await citySeederService.seedCities();
        await curriculumTemplateSeederService.seedSystemCurriculumTemplates();
      } catch (error: any) {
        console.error("Seeding failed (server will continue):", error.message);
      }
    }
    const httpServer = http.createServer(app);

    websocketService.initialize(httpServer);

    // // Dynamic subdomain support
    // app.use(subdomainGuard);

    // Start server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/v1/auth`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
