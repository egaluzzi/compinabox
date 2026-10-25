ALTER TABLE "checkout_attempt" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checkout_attempt" ADD COLUMN "terms_version" text;