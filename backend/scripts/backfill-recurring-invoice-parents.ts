import { AppDataSource } from "../src/modules/core/config/database";
import { Invoice } from "../src/modules/shared/entities/Invoice";
import { Item } from "../src/modules/shared/entities/Item";
import { InvoiceActivity } from "../src/modules/shared/entities/InvoiceActivity";
import { IsNull } from "typeorm";
import { invoiceService } from "../src/modules/invoice/services/invoice.service";
import {
  InvoiceActivityType,
  InvoiceStatus,
  InvoiceType,
} from "../src/modules/shared/entities/EntityEnums";

/**
 * Backfill: clone every existing recurring invoice into the new parent-child model.
 *
 * Why this exists:
 *   Before the parent-child model, a recurring invoice was a single row that the cron
 *   treated as both template AND billable instance. Those rows are still in the DB with
 *   invoiceType='recurring' and parentInvoiceId IS NULL.
 *
 *   This script makes the legacy data match what newly-created recurring invoices look
 *   like under the new model:
 *
 *     - Creates a fresh RECURRING parent template (clone of the source, fresh invoice
 *       number, status=SAVED, amountPaid=0, lastGeneratedDate=now()).
 *     - Re-links the original row as a ONE_TIME child of that new template
 *       (keeping its invoice number, financial state, payments, status, items).
 *     - Logs RECURRING_CONVERTED activity on both rows.
 *
 *   This mirrors exactly what PUT /invoices/:id { billingPeriod } does at runtime.
 *
 * Prerequisites:
 *   - The `parentInvoiceId` column must exist on the `invoices` table.
 *     Run `scripts/add-invoice-parent-id.sql` first if DB_SYNC=false.
 *
 * Behavior notes:
 *   - Idempotent: rows that already have parentInvoiceId set are skipped automatically.
 *     Safe to re-run.
 *   - Per-row transaction: a single bad row will not abort the whole backfill.
 *   - lastGeneratedDate on new parents is set to NOW() to prevent the cron from
 *     immediately re-spawning a duplicate this cycle (matches runtime convert behavior).
 *     If you need the cron to fire sooner, manually adjust lastGeneratedDate after the run.
 *   - Invoice number counter: each processed row consumes ONE new invoice number for its
 *     new parent. The original row keeps its existing invoice number. In dry-run mode the
 *     counter is NOT touched.
 *   - Items, students, and parents many-to-many links are copied onto the new template so
 *     the cron has everything it needs to spawn future children correctly.
 *
 * Usage (npm):
 *   npm run backfill:recurring-parents:dry                          # preview only, no writes
 *   npm run backfill:recurring-parents                              # full run against every school
 *   npm run backfill:recurring-parents -- --school-id 14            # restrict to one school
 *   npm run backfill:recurring-parents -- --school-id 14 --limit 5  # combine flags
 *   npm run backfill:recurring-parents -- --dry-run --school-id 14
 *
 *   Note: when invoking via `npm run`, the `--` separator is REQUIRED before any flag
 *   you want forwarded to the script. Flags before `--` are consumed by npm itself.
 *
 * Usage (raw ts-node):
 *   ts-node scripts/backfill-recurring-invoice-parents.ts
 *   ts-node scripts/backfill-recurring-invoice-parents.ts --dry-run
 *   ts-node scripts/backfill-recurring-invoice-parents.ts --school-id 14 --limit 5
 */

interface CliArgs {
  dryRun: boolean;
  schoolId?: number;
  limit?: number;
}

function parseArgs(): CliArgs {
  const args: CliArgs = { dryRun: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "-n") {
      args.dryRun = true;
    } else if (arg === "--school-id") {
      const value = argv[++i];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --school-id value: ${value}`);
      }
      args.schoolId = parsed;
    } else if (arg === "--limit") {
      const value = argv[++i];
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value: ${value}`);
      }
      args.limit = parsed;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: ts-node scripts/backfill-recurring-invoice-parents.ts [--dry-run] [--school-id N] [--limit N]",
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

interface BackfillResult {
  invoiceId: number;
  invoiceNumber: string;
  schoolId: number;
  parentId: number | null;
  parentInvoiceNumber: string | null;
  status: "converted" | "skipped" | "failed";
  reason?: string;
}

async function backfillOne(invoiceId: number, dryRun: boolean): Promise<BackfillResult> {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const source = await queryRunner.manager.findOne(Invoice, {
      where: { id: invoiceId },
      relations: ["items", "students", "parents"],
    });
    if (!source) {
      await queryRunner.rollbackTransaction();
      return {
        invoiceId,
        invoiceNumber: "",
        schoolId: 0,
        parentId: null,
        parentInvoiceNumber: null,
        status: "skipped",
        reason: "row no longer exists",
      };
    }

    if (source.invoiceType !== InvoiceType.RECURRING || source.parentInvoiceId != null) {
      await queryRunner.rollbackTransaction();
      return {
        invoiceId: source.id,
        invoiceNumber: source.invoiceNumber,
        schoolId: source.schoolId,
        parentId: null,
        parentInvoiceNumber: null,
        status: "skipped",
        reason: "already not a legacy template (recurring + parentInvoiceId=null)",
      };
    }

    if (dryRun) {
      // Dry-run preview: do not touch the invoice number counter, do not write rows.
      await queryRunner.rollbackTransaction();
      return {
        invoiceId: source.id,
        invoiceNumber: source.invoiceNumber,
        schoolId: source.schoolId,
        parentId: null,
        parentInvoiceNumber: "<dry-run: would generate fresh INV-XXXXXX>",
        status: "converted",
      };
    }

    // Compute totals from the source's items (do not blindly copy decimals — recompute so the
    // parent template is internally consistent, same way persistInvoiceRow does it at runtime).
    const sourceItems = source.items || [];
    const subTotal = sourceItems.reduce((acc, it) => acc + Number(it.quantity) * Number(it.rate), 0);
    const taxAmount = sourceItems.reduce((acc, it) => {
      const itemTotal = Number(it.quantity) * Number(it.rate);
      const itemTax = it.tax ? Number(it.tax) : 0;
      return acc + itemTotal * (itemTax / 100);
    }, 0);
    const discount = Number(source.discount || 0);
    const total = subTotal + taxAmount - discount;

    // Generate the parent invoice number. NOTE: this opens and commits its own transaction
    // (the counter increment is intentionally durable). If the outer transaction below
    // rolls back, the counter advances anyway — same behavior as the runtime convert path.
    const parentInvoiceNumber = await invoiceService.generateInvoiceNumber();

    const parent = queryRunner.manager.create(Invoice, {
      invoiceNumber: parentInvoiceNumber,
      issueDate:
        source.issueDate instanceof Date ? source.issueDate : new Date(source.issueDate),
      dueDate: source.dueDate instanceof Date ? source.dueDate : new Date(source.dueDate),
      subTotal,
      discount,
      tax: taxAmount,
      amountPaid: 0,
      balance: total,
      total,
      notes: source.notes,
      invoiceType: InvoiceType.RECURRING,
      status: InvoiceStatus.SAVED,
      billingPeriod: source.billingPeriod,
      source: source.source,
      paymentMethod: source.paymentMethod,
      // Set to NOW to prevent the cron from spawning an extra child this billing cycle.
      // Matches what PUT /invoices/:id { billingPeriod } does at runtime.
      lastGeneratedDate: new Date(),
      parentInvoiceId: null,
      studentId: source.studentId,
      classroomId: source.classroomId,
      schoolId: source.schoolId,
      bankAccountId: source.bankAccountId ?? undefined,
    });
    const savedParent = await queryRunner.manager.save(parent);

    if (sourceItems.length > 0) {
      const clonedItems = sourceItems.map((it) =>
        queryRunner.manager.create(Item, {
          description: it.description,
          quantity: Number(it.quantity),
          rate: Number(it.rate),
          tax: it.tax ? Number(it.tax) : 0,
          total:
            Number(it.quantity) * Number(it.rate) +
            Number(it.quantity) * Number(it.rate) * ((it.tax ? Number(it.tax) : 0) / 100),
          schoolId: source.schoolId,
          invoiceId: savedParent.id,
        }),
      );
      await queryRunner.manager.save(clonedItems);
    }

    // Copy many-to-many links (students + parents) so the cron has full context when it
    // spawns future children from this template.
    if ((source.students && source.students.length > 0) || (source.parents && source.parents.length > 0)) {
      const parentWithRelations = await queryRunner.manager.findOne(Invoice, {
        where: { id: savedParent.id },
        relations: ["students", "parents"],
      });
      if (parentWithRelations) {
        parentWithRelations.students = source.students || [];
        parentWithRelations.parents = source.parents || [];
        await queryRunner.manager.save(parentWithRelations);
      }
    }

    // Flip the source row into a ONE_TIME child of the new template.
    await queryRunner.manager.update(
      Invoice,
      { id: source.id },
      {
        invoiceType: InvoiceType.ONE_TIME,
        parentInvoiceId: savedParent.id,
        // Cast through unknown: column is nullable but TS type narrows BillingPeriod | undefined.
        billingPeriod: null as unknown as undefined,
      },
    );

    const activities = [
      queryRunner.manager.create(InvoiceActivity, {
        invoiceId: source.id,
        activityType: InvoiceActivityType.RECURRING_CONVERTED,
        title: "Invoice linked as child of recurring template (backfill)",
        description: `Backfill linked invoice ${source.invoiceNumber} as a child of new recurring template ${savedParent.invoiceNumber}.`,
        oldValues: {
          invoiceType: source.invoiceType,
          billingPeriod: source.billingPeriod ?? null,
          parentInvoiceId: null,
        },
        newValues: {
          invoiceType: InvoiceType.ONE_TIME,
          billingPeriod: null,
          parentInvoiceId: savedParent.id,
        },
        changedField: "parentInvoiceId",
      }),
      queryRunner.manager.create(InvoiceActivity, {
        invoiceId: savedParent.id,
        activityType: InvoiceActivityType.RECURRING_CONVERTED,
        title: "Recurring template created (backfill)",
        description: `Recurring template ${savedParent.invoiceNumber} (${source.billingPeriod}) created by backfill from invoice ${source.invoiceNumber}.`,
        oldValues: {},
        newValues: {
          billingPeriod: source.billingPeriod,
          invoiceType: InvoiceType.RECURRING,
          sourceInvoiceId: source.id,
        },
      }),
    ];
    await queryRunner.manager.save(activities);

    await queryRunner.commitTransaction();

    return {
      invoiceId: source.id,
      invoiceNumber: source.invoiceNumber,
      schoolId: source.schoolId,
      parentId: savedParent.id,
      parentInvoiceNumber: savedParent.invoiceNumber,
      status: "converted",
    };
  } catch (err: unknown) {
    try {
      await queryRunner.rollbackTransaction();
    } catch {
      // Ignore secondary rollback failure.
    }
    const reason = err instanceof Error ? err.message : String(err);
    return {
      invoiceId,
      invoiceNumber: "",
      schoolId: 0,
      parentId: null,
      parentInvoiceNumber: null,
      status: "failed",
      reason,
    };
  } finally {
    await queryRunner.release();
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log("[backfill-recurring] Initializing data source...");
  await AppDataSource.initialize();

  try {
    const repo = AppDataSource.getRepository(Invoice);
    const where: Record<string, unknown> = {
      invoiceType: InvoiceType.RECURRING,
      parentInvoiceId: IsNull(),
    };
    if (args.schoolId !== undefined) {
      where["schoolId"] = args.schoolId;
    }

    const candidates = await repo.find({
      where,
      select: ["id", "invoiceNumber", "schoolId", "billingPeriod"],
      order: { id: "ASC" },
      take: args.limit,
    });

    console.log(
      `[backfill-recurring] Found ${candidates.length} legacy recurring invoice(s) to process` +
        (args.schoolId !== undefined ? ` (schoolId=${args.schoolId})` : "") +
        (args.limit !== undefined ? ` (capped at --limit ${args.limit})` : "") +
        (args.dryRun ? " [DRY RUN — no writes]" : ""),
    );

    if (candidates.length === 0) {
      console.log("[backfill-recurring] Nothing to do.");
      return;
    }

    let converted = 0;
    let skipped = 0;
    let failed = 0;
    const failures: BackfillResult[] = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c) continue;
      const result = await backfillOne(c.id, args.dryRun);

      const prefix = `[${i + 1}/${candidates.length}]`;
      if (result.status === "converted") {
        converted++;
        if (args.dryRun) {
          console.log(
            `${prefix} WOULD convert invoice ${result.invoiceNumber} (id=${result.invoiceId}, school=${result.schoolId})`,
          );
        } else {
          console.log(
            `${prefix} Converted invoice ${result.invoiceNumber} (id=${result.invoiceId}, school=${result.schoolId}) -> new parent ${result.parentInvoiceNumber} (id=${result.parentId})`,
          );
        }
      } else if (result.status === "skipped") {
        skipped++;
        console.log(
          `${prefix} Skipped invoice id=${result.invoiceId}: ${result.reason ?? "unknown reason"}`,
        );
      } else {
        failed++;
        failures.push(result);
        console.error(
          `${prefix} FAILED invoice id=${result.invoiceId}: ${result.reason ?? "unknown error"}`,
        );
      }
    }

    console.log("---");
    console.log(
      `[backfill-recurring] Summary: candidates=${candidates.length} converted=${converted} skipped=${skipped} failed=${failed}${args.dryRun ? " [DRY RUN]" : ""}`,
    );

    if (failures.length > 0) {
      console.log("[backfill-recurring] Failed rows:");
      for (const f of failures) {
        console.log(`  - id=${f.invoiceId}: ${f.reason ?? "unknown"}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main()
  .then(() => {
    if (process.exitCode === undefined || process.exitCode === 0) {
      process.exit(0);
    } else {
      process.exit(process.exitCode);
    }
  })
  .catch((err) => {
    console.error("[backfill-recurring] Fatal error:", err);
    process.exit(1);
  });
