import { AppDataSource } from "../src/modules/core/config/database";
import { rolesService } from "../src/modules/roles";

/**
 * Removes duplicate role assignments so each user has at most one role.
 *
 * Removal priority:
 *   1. Super Admin assignments are removed first whenever the user has any other role.
 *   2. If a user has only Super Admin assignments, the most recent one is kept.
 *   3. If a user has multiple non Super Admin roles, the most recent assignment is kept.
 *
 * Usage:
 *   ts-node scripts/dedupe-user-roles.ts
 *
 * This logic is also wired into server startup via
 * RolesService.bootstrapAllRolePermissions so it runs on every launch. Use this
 * standalone script only when you want to run the cleanup ad hoc.
 */
async function main(): Promise<void> {
  console.log("[dedupe-user-roles] Initializing data source...");
  await AppDataSource.initialize();

  try {
    const result = await rolesService.enforceSingleRolePerUser();
    console.log(
      `[dedupe-user-roles] Done. usersInspected=${result.usersInspected} usersUpdated=${result.usersUpdated} assignmentsRemoved=${result.assignmentsRemoved}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[dedupe-user-roles] Failed:", err);
    process.exit(1);
  });
