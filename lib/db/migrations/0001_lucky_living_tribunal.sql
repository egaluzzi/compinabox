ALTER TABLE "documents" ADD COLUMN "locale" text DEFAULT 'pt-BR' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "template_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "generated_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_company_type_version" UNIQUE("company_id","type","version");