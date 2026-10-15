CREATE TABLE "whistleblower_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whistleblower_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"report_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"body" text,
	"from_status" text,
	"to_status" text,
	"author_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "whistleblower_notes_kind_check" CHECK (kind in ('note', 'status_change'))
);
--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ALTER COLUMN "status" SET DEFAULT 'new';--> statement-breakpoint
-- Phase 5 lifecycle: new -> under_review -> closed. The old default 'received' becomes 'new'.
UPDATE "whistleblower_reports" SET "status" = 'new' WHERE "status" = 'received';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "slug" text;--> statement-breakpoint
-- Backfill the public whistleblower slug by the same rule as lib/whistleblower/slug.ts:
-- strip accents, lowercase, [a-z0-9-], ~40 chars, 'empresa' if empty; a duplicate (oldest keeps
-- the plain slug) gets '-' + 4 chars. Done before NOT NULL / UNIQUE so existing rows migrate.
UPDATE "companies" SET "slug" = COALESCE(NULLIF(
  trim(both '-' from left(trim(both '-' from regexp_replace(
    lower(translate("name", 'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäåéèêëíìîïóòôõöúùûüçñ', 'AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g')), 40)), ''), 'empresa');--> statement-breakpoint
UPDATE "companies" c SET "slug" = c."slug" || '-' || substr(md5(c."id"::text), 1, 4)
  FROM (SELECT "id", row_number() OVER (PARTITION BY "slug" ORDER BY "created_at", "id") AS rn FROM "companies") d
  WHERE c."id" = d."id" AND d.rn > 1;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "whistleblower_evidence" ADD CONSTRAINT "whistleblower_evidence_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whistleblower_evidence" ADD CONSTRAINT "whistleblower_evidence_report_id_whistleblower_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."whistleblower_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whistleblower_notes" ADD CONSTRAINT "whistleblower_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whistleblower_notes" ADD CONSTRAINT "whistleblower_notes_report_id_whistleblower_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."whistleblower_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whistleblower_notes" ADD CONSTRAINT "whistleblower_notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "whistleblower_reports" ADD CONSTRAINT "whistleblower_reports_status_check" CHECK (status in ('new', 'under_review', 'closed'));--> statement-breakpoint
-- whistleblower_notes is append-only (SPEC §5.3: the case log is itself audit evidence).
-- Same pattern as documents (0002): nothing edits or removes a row; any future erasure must be
-- a deliberate migration that drops these triggers first (CLAUDE.md §0 rule 3 — goes to Esteban).
CREATE FUNCTION whistleblower_notes_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'whistleblower_notes is append-only: % is not allowed', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER whistleblower_notes_no_update_delete
  BEFORE UPDATE OR DELETE ON "whistleblower_notes"
  FOR EACH ROW EXECUTE FUNCTION whistleblower_notes_append_only();--> statement-breakpoint
CREATE TRIGGER whistleblower_notes_no_truncate
  BEFORE TRUNCATE ON "whistleblower_notes"
  FOR EACH STATEMENT EXECUTE FUNCTION whistleblower_notes_append_only();
