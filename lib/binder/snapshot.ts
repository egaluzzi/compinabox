import { and, count, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  companies,
  documents,
  trainingCompletions,
  whistleblowerReports,
  type BinderOptions,
} from "@/lib/db/schema";
import { isCountry, type Country } from "@/lib/countries";
import { getLegalContent, type CountryLegalContent } from "@/lib/content";
import { parseDocument } from "@/lib/documents/generate";
import {
  DOCUMENT_TYPES,
  type DocumentType,
  type StructuredDocument,
} from "@/lib/documents/types";
import { disclosureYear } from "@/lib/employee/constants";
import { getRoster } from "@/lib/employee/roster";
import { COUNTRY_LOCALE, type Locale } from "@/lib/i18n";
import {
  LESSONS,
  MODULE_ID,
  PASS_FRACTION,
  QUESTIONS,
} from "@/lib/training/content";
import { trainingAvailable } from "@/lib/training/grading";
import { summarizeVendors, type VendorSummary } from "@/lib/vendors/summary";

// The data the dossier is made of, read ONCE inside a single REPEATABLE READ transaction and
// then rendered from memory: nothing that changes while the PDF is being drawn can appear in it.
//
// PRIVACY (CLAUDE.md §8, scripts/check-binder-privacy.sh): this file selects NAMES, DATES, STATES,
// SCORES and COUNTS only. It never reads employee e-mail addresses (the roster loader returns
// them; they are dropped in `toNames` below and never stored in the snapshot), acknowledgment IP
// addresses, disclosure contents, whistleblower report text / contact / tracking codes /
// evidence, or vendor questionnaire answers.

export type StepView = { state: "done" | "outdated" | "pending"; at?: Date };

export type BinderSnapshot = {
  binderId: string;
  asOf: Date;
  locale: Locale;
  options: BinderOptions;
  company: {
    name: string;
    taxId: string;
    country: Country;
    slug: string;
    logoFile: string | null;
    createdAt: Date;
  };
  /** Legal-basis content for the company's country (draft status included). */
  legal: CountryLegalContent | null;
  /** The company's CURRENT version of each document, in DOCUMENT_TYPES order; null = none exists. */
  documents: {
    type: DocumentType;
    entry: {
      version: number;
      generatedAt: Date;
      doc: StructuredDocument;
    } | null;
  }[];
  /** True while any included document, the legal content or the training module is a draft. */
  draft: boolean;
  activeEmployees: number;
  training: {
    available: boolean;
    moduleId: string;
    lessons: number;
    questions: number;
    passPercent: number;
    invited: number;
    completed: number;
    rows: {
      name: string;
      state: "done" | "pending";
      at?: Date;
      score?: number;
    }[];
  };
  acknowledgments: {
    currentDocs: { type: DocumentType; version: number }[];
    rows: { name: string; docs: Partial<Record<DocumentType, StepView>> }[];
  };
  disclosures: {
    year: number;
    submitted: number;
    rows: { name: string; at?: Date }[];
  };
  channel: {
    url: string;
    availableSince: Date;
    stats: null | { total: number; byStatus: Record<string, number> };
  };
  vendors: VendorSummary[];
};

export type SnapshotHooks = {
  /** Test seam: runs after the first read, so a test can change data mid-snapshot. */
  afterFirstRead?: () => Promise<void>;
};

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** The loaders below only call select(); a transaction offers the same query builder as Db. */
const asDb = (tx: Tx) => tx as unknown as Db;

export const channelUrl = (slug: string) =>
  `${new URL(process.env.APP_URL || "http://localhost:3000").origin}/report/${slug}`;

export async function takeSnapshot(
  db: Db,
  input: { binderId: string; companyId: string; options: BinderOptions },
  hooks: SnapshotHooks = {},
): Promise<BinderSnapshot> {
  return db.transaction(
    async (tx) => {
      const q = asDb(tx);
      // The first statement fixes the snapshot; now() is the transaction start, so it IS the as-of.
      const asOfRes = await tx.execute<{ t: Date }>(sql`select now() as t`);
      const asOf = new Date(asOfRes.rows[0].t);

      const [company] = await q
        .select()
        .from(companies)
        .where(eq(companies.id, input.companyId));
      if (!company) throw new Error("company not found");
      if (!isCountry(company.country)) throw new Error("unknown country");
      const country = company.country;
      const locale = COUNTRY_LOCALE[country];
      if (hooks.afterFirstRead) await hooks.afterFirstRead();

      const docRows = await q
        .selectDistinctOn([documents.type])
        .from(documents)
        .where(eq(documents.companyId, input.companyId))
        .orderBy(documents.type, desc(documents.version));
      const roster = await getRoster(q, input.companyId, locale, { now: asOf });
      const passes = await q
        .select({
          employeeId: trainingCompletions.employeeId,
          completedAt: trainingCompletions.completedAt,
          score: trainingCompletions.score,
        })
        .from(trainingCompletions)
        .where(
          and(
            eq(trainingCompletions.companyId, input.companyId),
            eq(trainingCompletions.moduleId, MODULE_ID),
          ),
        );
      const reportRows = input.options.includeChannelStats
        ? await q
            .select({ status: whistleblowerReports.status, n: count() })
            .from(whistleblowerReports)
            .where(eq(whistleblowerReports.companyId, input.companyId))
            .groupBy(whistleblowerReports.status)
        : null;
      const vendors = await summarizeVendors(q, input.companyId, asOf);

      const byType = new Map(docRows.map((r) => [r.type, r]));
      const docs = DOCUMENT_TYPES.map((type) => {
        const r = byType.get(type);
        return {
          type,
          entry: r
            ? {
                version: r.version,
                generatedAt: r.generatedAt,
                doc: parseDocument(r.content),
              }
            : null,
        };
      });
      const legal = getLegalContent(country);
      const legalContent = "reviewStatus" in legal ? legal : null;
      const available = trainingAvailable(locale);
      const draft =
        available ||
        docs.some((d) => d.entry?.doc.reviewStatus === "draft") ||
        legalContent?.reviewStatus === "draft";

      const passBy = new Map(passes.map((p) => [p.employeeId, p]));
      // `roster.rows` carries e-mail addresses; only the name leaves this function.
      const rows = roster.rows;
      const stats = reportRows
        ? {
            total: reportRows.reduce((s, r) => s + r.n, 0),
            byStatus: Object.fromEntries(
              reportRows.map((r) => [r.status, r.n]),
            ),
          }
        : null;

      return {
        binderId: input.binderId,
        asOf,
        locale,
        options: input.options,
        company: {
          name: company.name,
          taxId: company.taxId,
          country,
          slug: company.slug,
          logoFile: company.logoFile,
          createdAt: company.createdAt,
        },
        legal: legalContent,
        documents: docs,
        draft,
        activeEmployees: rows.length,
        training: {
          available,
          moduleId: MODULE_ID,
          lessons: LESSONS.length,
          questions: QUESTIONS.length,
          passPercent: Math.round(PASS_FRACTION * 100),
          invited: rows.filter((r) => r.invitedAt !== null).length,
          completed: rows.filter((r) => passBy.has(r.id)).length,
          rows: rows.map((r) => {
            const p = passBy.get(r.id);
            return p
              ? {
                  name: r.name,
                  state: "done" as const,
                  at: p.completedAt,
                  score: p.score ?? undefined,
                }
              : { name: r.name, state: "pending" as const };
          }),
        },
        acknowledgments: {
          currentDocs: roster.currentDocs.map((d) => ({
            type: d.type,
            version: d.version,
          })),
          rows: rows.map((r) => ({
            name: r.name,
            docs: Object.fromEntries(
              DOCUMENT_TYPES.map((t) => [
                t,
                {
                  state: r.docs[t].state,
                  at: "at" in r.docs[t] ? r.docs[t].at : undefined,
                },
              ]),
            ),
          })),
        },
        disclosures: {
          year: disclosureYear(asOf),
          submitted: rows.filter((r) => r.disclosure.state === "done").length,
          rows: rows.map((r) => ({
            name: r.name,
            at: r.disclosure.state === "done" ? r.disclosure.at : undefined,
          })),
        },
        channel: {
          url: channelUrl(company.slug),
          // the slug is generated when the account is provisioned, so the channel exists from then
          availableSince: company.createdAt,
          stats,
        },
        vendors,
      } satisfies BinderSnapshot;
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
