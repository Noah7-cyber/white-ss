-- Self-referencing parent invoice column on `invoices`.
--
-- Recurring invoices are now parent templates (parentInvoiceId IS NULL,
-- invoiceType = 'recurring'). Each billable instance (spawned by the cron job
-- or written alongside a recurring POST) is a ONE_TIME row whose
-- parentInvoiceId points back to the template.
--
-- Run this against environments where TypeORM `synchronize` is OFF
-- (i.e. DB_SYNC is not "true"). When DB_SYNC=true, the entity column is
-- created automatically and you do NOT need to run this file.
--
-- Postgres-only. Idempotent (safe to re-run).

-- ---------------------------------------------------------------------------
-- Step 1 — schema additions (transactional)
-- ---------------------------------------------------------------------------
BEGIN;

-- 1a) Column.
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS "parentInvoiceId" INTEGER;

-- 1b) Foreign key (ON DELETE SET NULL so deleting a parent template doesn't
--     cascade-delete the already-billed children).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_parent_invoice'
    ) THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT fk_invoices_parent_invoice
            FOREIGN KEY ("parentInvoiceId") REFERENCES public.invoices(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 1c) Index for the common parent->children lookup and the EXISTS clause used
--     by GET /invoices?invoiceFilter=parentsOnly.
CREATE INDEX IF NOT EXISTS idx_invoices_parentInvoiceId
    ON public.invoices ("parentInvoiceId");

COMMIT;

-- ---------------------------------------------------------------------------
-- Step 2 — extend the InvoiceActivity enum with `recurring_converted`.
--
-- `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on
-- Postgres < 12, and even on 12+ the new value can't be used in the same
-- transaction. We therefore run it outside BEGIN/COMMIT, guarded by a check
-- against pg_enum so the script stays idempotent.
--
-- The enum type for invoice_activities.activityType is auto-named by TypeORM
-- as `invoice_activities_activitytype_enum`.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    enum_type_oid OID;
BEGIN
    SELECT t.oid INTO enum_type_oid
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'invoice_activities_activitytype_enum'
      AND n.nspname = 'public';

    IF enum_type_oid IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = enum_type_oid
              AND enumlabel = 'recurring_converted'
        ) THEN
            ALTER TYPE public.invoice_activities_activitytype_enum
                ADD VALUE 'recurring_converted';
        END IF;
    END IF;
END $$;
