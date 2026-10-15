CREATE TABLE "employee_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
-- period_year: added nullable, backfilled from submitted_at (UTC year), then NOT NULL, so the
-- migration is safe on a database that already holds rows (none exist before phase 6).
ALTER TABLE "disclosures" ADD COLUMN "period_year" integer;--> statement-breakpoint
UPDATE "disclosures" SET "period_year" = EXTRACT(YEAR FROM "submitted_at" AT TIME ZONE 'UTC')::integer;--> statement-breakpoint
ALTER TABLE "disclosures" ALTER COLUMN "period_year" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
-- Emails are stored lower-cased from now on; normalise any existing rows before the unique key.
UPDATE "employees" SET "email" = lower("email");--> statement-breakpoint
ALTER TABLE "employee_sessions" ADD CONSTRAINT "employee_sessions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_sessions" ADD CONSTRAINT "employee_sessions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgments" ADD CONSTRAINT "acknowledgments_employee_document" UNIQUE("employee_id","document_id");--> statement-breakpoint
ALTER TABLE "disclosures" ADD CONSTRAINT "disclosures_employee_type_year" UNIQUE("employee_id","type","period_year");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_email" UNIQUE("company_id","email");--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_employee_module" UNIQUE("employee_id","module_id");--> statement-breakpoint
-- acknowledgments, training_completions and disclosures are append-only (audit evidence), same
-- pattern as documents (0002) and whistleblower_notes (0004). Any future erasure must be a
-- deliberate migration that drops these triggers first (CLAUDE.md §0 rule 3 — goes to Esteban).
-- The one sanctioned exception is key rotation of disclosures.content (lib/whistleblower/rotate.ts),
-- which disables the UPDATE trigger inside its own transaction.
CREATE FUNCTION acknowledgments_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'acknowledgments is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER acknowledgments_no_update_delete
  BEFORE UPDATE OR DELETE ON "acknowledgments"
  FOR EACH ROW EXECUTE FUNCTION acknowledgments_append_only();--> statement-breakpoint
CREATE TRIGGER acknowledgments_no_truncate
  BEFORE TRUNCATE ON "acknowledgments"
  FOR EACH STATEMENT EXECUTE FUNCTION acknowledgments_append_only();--> statement-breakpoint
CREATE FUNCTION training_completions_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'training_completions is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER training_completions_no_update_delete
  BEFORE UPDATE OR DELETE ON "training_completions"
  FOR EACH ROW EXECUTE FUNCTION training_completions_append_only();--> statement-breakpoint
CREATE TRIGGER training_completions_no_truncate
  BEFORE TRUNCATE ON "training_completions"
  FOR EACH STATEMENT EXECUTE FUNCTION training_completions_append_only();--> statement-breakpoint
CREATE FUNCTION disclosures_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'disclosures is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER disclosures_no_update_delete
  BEFORE UPDATE OR DELETE ON "disclosures"
  FOR EACH ROW EXECUTE FUNCTION disclosures_append_only();--> statement-breakpoint
CREATE TRIGGER disclosures_no_truncate
  BEFORE TRUNCATE ON "disclosures"
  FOR EACH STATEMENT EXECUTE FUNCTION disclosures_append_only();
