CREATE TABLE "binders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"requested_by_user_id" uuid,
	"options" jsonb NOT NULL,
	"as_of" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error_code" text,
	"size_bytes" integer,
	"page_count" integer,
	"sha256" text,
	"pdf" "bytea",
	CONSTRAINT "binders_status_check" CHECK ("binders"."status" in ('queued', 'running', 'ready', 'failed')),
	CONSTRAINT "binders_ready_complete" CHECK ("binders"."status" <> 'ready' or ("binders"."pdf" is not null and "binders"."sha256" is not null and "binders"."size_bytes" is not null and "binders"."page_count" is not null and "binders"."as_of" is not null))
);
--> statement-breakpoint
ALTER TABLE "binders" ADD CONSTRAINT "binders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binders" ADD CONSTRAINT "binders_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "binders_company_created" ON "binders" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "binders_one_active_per_company" ON "binders" USING btree ("company_id") WHERE "binders"."status" in ('queued', 'running');--> statement-breakpoint
-- A READY binder is a record handed to an auditor: it is immutable and never deleted. Status
-- transitions before ready (queued -> running -> ready | failed) are allowed; a ready row is not
-- touched again, and TRUNCATE is refused outright. Same family as 0002/0004/0005. Any future
-- erasure must be a deliberate migration that drops these triggers first (CLAUDE.md §0 rule 3).
CREATE FUNCTION binders_immutable() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'binders is immutable: TRUNCATE is not allowed'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF OLD.status = 'ready' THEN
    RAISE EXCEPTION 'binders is immutable once ready: % is not allowed', TG_OP
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER binders_no_update_delete_when_ready
  BEFORE UPDATE OR DELETE ON "binders"
  FOR EACH ROW EXECUTE FUNCTION binders_immutable();--> statement-breakpoint
CREATE TRIGGER binders_no_truncate
  BEFORE TRUNCATE ON "binders"
  FOR EACH STATEMENT EXECUTE FUNCTION binders_immutable();
