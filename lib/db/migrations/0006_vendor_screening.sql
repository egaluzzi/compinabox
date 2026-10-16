CREATE TABLE "vendor_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"respondent_name" text NOT NULL,
	"respondent_role" text NOT NULL,
	"ownership_text" text NOT NULL,
	"pep_exposure" boolean NOT NULL,
	"pep_details" text,
	"prior_sanctions" boolean NOT NULL,
	"sanctions_details" text,
	"antibribery_policy" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_screenings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"screened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider" text NOT NULL,
	"dataset" text NOT NULL,
	"name_screened" text NOT NULL,
	"status" text NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"matches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error_code" text,
	"requested_by_user_id" uuid,
	CONSTRAINT "vendor_screenings_status_check" CHECK ("vendor_screenings"."status" in ('no_match', 'possible_match', 'error'))
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "tax_id" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "contact_email" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "invited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "invite_token_hash" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_responses" ADD CONSTRAINT "vendor_responses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_screenings" ADD CONSTRAINT "vendor_screenings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_screenings" ADD CONSTRAINT "vendor_screenings_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_screenings" ADD CONSTRAINT "vendor_screenings_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_questionnaire_status_check" CHECK ("vendors"."questionnaire_status" in ('not_sent', 'sent', 'submitted'));--> statement-breakpoint
-- vendor_responses and vendor_screenings are append-only (audit evidence), same pattern as
-- documents (0002), whistleblower_notes (0004) and acknowledgments/disclosures (0005). A re-sent
-- questionnaire inserts a NEW response row; the newest is "the" answer. The one sanctioned
-- exception is key rotation of the encrypted vendor_responses columns (lib/whistleblower/rotate.ts),
-- which disables the UPDATE trigger inside its own transaction. Any other erasure must be a
-- deliberate migration that drops these triggers first (CLAUDE.md §0 rule 3 — goes to Esteban).
CREATE FUNCTION vendor_responses_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'vendor_responses is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER vendor_responses_no_update_delete
  BEFORE UPDATE OR DELETE ON "vendor_responses"
  FOR EACH ROW EXECUTE FUNCTION vendor_responses_append_only();--> statement-breakpoint
CREATE TRIGGER vendor_responses_no_truncate
  BEFORE TRUNCATE ON "vendor_responses"
  FOR EACH STATEMENT EXECUTE FUNCTION vendor_responses_append_only();--> statement-breakpoint
CREATE FUNCTION vendor_screenings_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'vendor_screenings is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER vendor_screenings_no_update_delete
  BEFORE UPDATE OR DELETE ON "vendor_screenings"
  FOR EACH ROW EXECUTE FUNCTION vendor_screenings_append_only();--> statement-breakpoint
CREATE TRIGGER vendor_screenings_no_truncate
  BEFORE TRUNCATE ON "vendor_screenings"
  FOR EACH STATEMENT EXECUTE FUNCTION vendor_screenings_append_only();
