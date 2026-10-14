import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// Conventions: snake_case columns, uuid ids, every tenant table carries company_id
// (verify.sh 4b). Pre-tenant tables (companies, users, auth tables, waitlist_leads,
// checkout_attempt, payment_event) are the allowlist in verify.sh.

// --- Tenant root ---------------------------------------------------------------
export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  taxId: text("tax_id").notNull(),
  country: text("country").notNull(), // ar | br | mx
  industry: text("industry"),
  logoFile: text("logo_file"), // server-chosen filename under UPLOADS_DIR
  subscriptionStatus: text("subscription_status").notNull().default("active"),
  onboardingCompletedAt: timestamp("onboarding_completed_at", {
    withTimezone: true,
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Auth.js tables (users doubles as SPEC §13 User) ------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id),
  role: text("role").notNull().default("admin"),
  email: text("email").notNull().unique(), // stored lower-cased
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  name: text("name"),
  image: text("image"),
  // Sessions issued before this instant are void (set to now() on sign-out). See getTenant().
  sessionsValidAfter: timestamp("sessions_valid_after", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable("accounts", {
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  // property names follow the Auth.js adapter's expected shape
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

// Unused with JWT sessions; the adapter's types want it.
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

// Single-use link tokens: Auth.js sign-in links and our own welcome links (hashed).
export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

// --- Pre-tenant: checkout ----------------------------------------------------------
export const checkoutAttempt = pgTable("checkout_attempt", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref"),
  status: text("status").notNull().default("pending"), // pending|paid|failed|expired
  failureReason: text("failure_reason"),
  country: text("country").notNull(),
  companyName: text("company_name").notNull(),
  taxId: text("tax_id").notNull(),
  billingEmail: text("billing_email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  // Browser binding for the post-payment sign-in (hash only; the token is in an httpOnly cookie).
  returnTokenHash: text("return_token_hash").notNull(),
  returnTokenExpiresAt: timestamp("return_token_expires_at", {
    withTimezone: true,
  }),
  returnTokenUsedAt: timestamp("return_token_used_at", { withTimezone: true }),
  userId: uuid("user_id"), // set at provisioning
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Idempotency ledger: event_key = "<provider>:<event id>"; a conflict = replay.
export const paymentEvent = pgTable("payment_event", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  provider: text("provider").notNull(),
  paymentRef: text("payment_ref").notNull(),
  attemptId: uuid("attempt_id").references(() => checkoutAttempt.id),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const waitlistLeads = pgTable("waitlist_leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(), // lower-cased
  country: text("country").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Tenant tables (SPEC §13) — shape known now, used by later phases -----------------
const companyId = () =>
  uuid("company_id")
    .notNull()
    .references(() => companies.id);

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  inviteTokenHash: text("invite_token_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// APPEND-ONLY: a database trigger (migration 0002) rejects UPDATE, DELETE and TRUNCATE.
// A regeneration inserts the next version; erasure would be a deliberate migration.
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    type: text("type").notNull(), // code_of_conduct | policy:*
    version: integer("version").notNull().default(1),
    locale: text("locale").notNull().default("pt-BR"),
    templateVersion: integer("template_version").notNull().default(1),
    content: text("content").notNull(), // StructuredDocument as JSON (lib/documents/types.ts)
    generatedByUserId: uuid("generated_by_user_id").references(() => users.id),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("documents_company_type_version").on(t.companyId, t.type, t.version),
  ],
);

export const acknowledgments = pgTable("acknowledgments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id),
  acceptedAt: timestamp("accepted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text("ip_address"), // audit trail (SPEC §5.5) — NOT for whistleblower reports
});

export const trainingCompletions = pgTable("training_completions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  moduleId: text("module_id").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  score: integer("score"),
});

export const disclosures = pgTable("disclosures", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  type: text("type").notNull(),
  content: text("content").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// NB: description/reporter_contact must be encrypted at rest (SPEC §11) — done in phase 5
// when the intake exists. No IP / user-agent column on purpose (CLAUDE.md §8).
export const whistleblowerReports = pgTable("whistleblower_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  trackingCode: text("tracking_code").notNull().unique(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  isAnonymous: boolean("is_anonymous").notNull().default(true),
  reporterContact: text("reporter_contact"),
  status: text("status").notNull().default("received"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  name: text("name").notNull(),
  questionnaireStatus: text("questionnaire_status")
    .notNull()
    .default("not_sent"),
  screeningResult: text("screening_result"),
  screenedAt: timestamp("screened_at", { withTimezone: true }),
});

export const billingRecords = pgTable("billing_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
});
