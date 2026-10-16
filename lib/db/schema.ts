import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
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
  // Public whistleblower URL segment (/report/<slug>). Immutable: printed in documents and
  // handed to employees. Generated at provisioning (lib/whistleblower/slug.ts).
  slug: text("slug").notNull().unique(),
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

// Roster (phase 6). Emails are stored lower-cased; deactivation is an action, never a delete.
// `invite_token_hash` is sha256 of the emailed token; it is NULLed when the link is used (the
// Start button) and replaced on every re-issue, which kills the previous link.
export const employees = pgTable(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    inviteTokenHash: text("invite_token_hash"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("employees_company_email").on(t.companyId, t.email)],
);

// Portal sessions (phase 6): DB-backed and revocable; only the hash of the cookie value is stored.
export const employeeSessions = pgTable("employee_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
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

// APPEND-ONLY (migration 0005 trigger). One acceptance per employee per document version.
export const acknowledgments = pgTable(
  "acknowledgments",
  {
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
  },
  (t) => [
    unique("acknowledgments_employee_document").on(t.employeeId, t.documentId),
  ],
);

// APPEND-ONLY (migration 0005 trigger). Rows exist only for passes.
export const trainingCompletions = pgTable(
  "training_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    moduleId: text("module_id").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    score: integer("score"), // integer percent
  },
  (t) => [
    unique("training_completions_employee_module").on(t.employeeId, t.moduleId),
  ],
);

// APPEND-ONLY (migration 0005 trigger). `content` is ciphertext (lib/whistleblower/crypto.ts,
// AAD disclosures:<company_id>:content). One per employee, type and calendar (UTC) year.
export const disclosures = pgTable(
  "disclosures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    type: text("type").notNull(),
    periodYear: integer("period_year").notNull(),
    content: text("content").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("disclosures_employee_type_year").on(
      t.employeeId,
      t.type,
      t.periodYear,
    ),
  ],
);

// description and reporter_contact hold AES-256-GCM ciphertext (lib/whistleblower/crypto.ts).
// No IP / user-agent column on purpose (CLAUDE.md §8).
export const whistleblowerReports = pgTable(
  "whistleblower_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    trackingCode: text("tracking_code").notNull().unique(),
    category: text("category").notNull(),
    description: text("description").notNull(), // ciphertext
    isAnonymous: boolean("is_anonymous").notNull().default(true),
    reporterContact: text("reporter_contact"), // ciphertext; NULL unless the reporter opted in
    status: text("status").notNull().default("new"), // new | under_review | closed
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }), // set on close, cleared on reopen
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    check(
      "whistleblower_reports_status_check",
      sql`status in ('new', 'under_review', 'closed')`,
    ),
  ],
);

// Evidence images: metadata stripped, then stored ENCRYPTED under EVIDENCE_DIR (not UPLOADS_DIR).
// Nothing from the client's filename or content type is kept.
export const whistleblowerEvidence = pgTable("whistleblower_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => whistleblowerReports.id),
  fileName: text("file_name").notNull(), // server-chosen random name on disk
  contentType: text("content_type").notNull(), // sniffed: image/png | image/jpeg
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// APPEND-ONLY: a database trigger (migration 0004) rejects UPDATE, DELETE and TRUNCATE. The log
// is itself audit evidence (SPEC §5.3). `body` is ciphertext for notes, NULL for status changes.
export const whistleblowerNotes = pgTable(
  "whistleblower_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => whistleblowerReports.id),
    kind: text("kind").notNull(), // note | status_change
    body: text("body"),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [
    check(
      "whistleblower_notes_kind_check",
      sql`kind in ('note', 'status_change')`,
    ),
  ],
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    name: text("name").notNull(),
    country: text("country"), // free 2-letter code, only if given
    taxId: text("tax_id"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"), // lower-cased
    // not_sent | sent | submitted ("expired" is derived from invite_expires_at in code)
    questionnaireStatus: text("questionnaire_status")
      .notNull()
      .default("not_sent"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    inviteTokenHash: text("invite_token_hash"), // sha256 only, NULL once used or never sent
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    // Cache of the latest vendor_screenings row: no_match | possible_match | error
    screeningResult: text("screening_result"),
    screenedAt: timestamp("screened_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "vendors_questionnaire_status_check",
      sql`${t.questionnaireStatus} in ('not_sent', 'sent', 'submitted')`,
    ),
  ],
);

// Append-only (DB trigger, migration 0006). The five free-text fields are encrypted with the
// REPORT_ENCRYPTION_KEYS ring (AAD vendor_responses:<company_id>:<field>); booleans are plain.
export const vendorResponses = pgTable("vendor_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: companyId(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  respondentName: text("respondent_name").notNull(), // encrypted
  respondentRole: text("respondent_role").notNull(), // encrypted
  ownershipText: text("ownership_text").notNull(), // encrypted
  pepExposure: boolean("pep_exposure").notNull(),
  pepDetails: text("pep_details"), // encrypted
  priorSanctions: boolean("prior_sanctions").notNull(),
  sanctionsDetails: text("sanctions_details"), // encrypted
  antibriberyPolicy: boolean("antibribery_policy").notNull(),
});

export type ScreeningMatch = {
  id: string;
  caption: string;
  score: number;
  datasets: string[];
  topics: string[];
};

// Append-only (DB trigger, migration 0006). Only the five match fields are ever stored.
export const vendorScreenings = pgTable(
  "vendor_screenings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: companyId(),
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id),
    screenedAt: timestamp("screened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    provider: text("provider").notNull(),
    dataset: text("dataset").notNull(),
    nameScreened: text("name_screened").notNull(),
    status: text("status").notNull(), // no_match | possible_match | error
    matchCount: integer("match_count").notNull().default(0),
    matches: jsonb("matches").$type<ScreeningMatch[]>().notNull().default([]),
    errorCode: text("error_code"), // fixed short code, never a message
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id),
  },
  (t) => [
    check(
      "vendor_screenings_status_check",
      sql`${t.status} in ('no_match', 'possible_match', 'error')`,
    ),
  ],
);

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
