import type { Db } from "@/lib/db/client";
import { runBinderJob, type JobHooks } from "@/lib/binder/jobs";
import {
  type BinderOptions,
  acknowledgments,
  binders,
  disclosures,
  documents,
  employees,
  trainingCompletions,
  vendorResponses,
  vendorScreenings,
  vendors,
  whistleblowerEvidence,
  whistleblowerNotes,
  whistleblowerReports,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { DISCLOSURE_TYPE } from "@/lib/employee/constants";
import { MODULE_ID } from "@/lib/training/content";
import { seedPortalCompany } from "./employee";
import { uid } from "./db";

/** Unique strings planted in every field the dossier must NOT contain. */
export const MARKERS = {
  email: "marker-email",
  ip: "203.0.113.77",
  disclosure: "MARKERDISCLOSURECONTENT",
  reportDescription: "MARKERREPORTDESCRIPTION",
  reportContact: "MARKERREPORTCONTACT",
  trackingCode: "MARKERTRACKINGCODE",
  evidenceFile: "MARKEREVIDENCEFILE",
  vendorRespondent: "MARKERVENDORRESPONDENT",
  vendorOwnership: "MARKERVENDOROWNERSHIP",
  vendorPep: "MARKERVENDORPEP",
  vendorContactEmail: "marker-vendor-contact",
  reportNote: "MARKERREPORTNOTE",
  ciphertext: "binder:v1:MARKERCIPHERTEXT",
} as const;

const chunks = <T>(a: T[], n = 400) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) =>
    a.slice(i * n, (i + 1) * n),
  );

export type SeedOpts = {
  employees?: number;
  vendors?: number;
  /** plant the marker values in every excluded field */
  markers?: boolean;
  reports?: number;
  label?: string;
  namePrefix?: string;
};

/**
 * A BR company with its six documents, `employees` active employees (mixed acknowledgment /
 * training / disclosure states), `vendors` vendors (some questionnaires and screenings) and
 * `reports` whistleblower reports. With `markers`, every field the dossier must exclude carries
 * a unique string from MARKERS.
 */
export async function seedBinderCompany(db: Db, o: SeedOpts = {}) {
  const label = o.label ?? uid();
  const nEmp = o.employees ?? 6;
  const nVen = o.vendors ?? 3;
  const nRep = o.reports ?? 0;
  const prefix = o.namePrefix ?? "Colaborador";
  const s = await seedPortalCompany(db, label);
  const companyId = s.company.id;
  const docs = await db
    .select({ id: documents.id, type: documents.type })
    .from(documents)
    .where(eq(documents.companyId, companyId));

  const emps =
    nEmp === 0
      ? []
      : await db
          .insert(employees)
          .values(
            Array.from({ length: nEmp }, (_, i) => ({
              companyId,
              name: `${prefix} ${String(i + 1).padStart(3, "0")} José Antônio Çavalcanti`,
              email:
                `${MARKERS.email}-${label}-${i}@example.test`.toLowerCase(),
              invitedAt: i % 5 === 4 ? null : new Date(Date.now() - 86400_000),
            })),
          )
          .returning();

  const acks = emps.flatMap((e, i) =>
    docs
      .filter((_, j) => (i + j) % 3 !== 0)
      .map((d) => ({
        companyId,
        employeeId: e.id,
        documentId: d.id,
        acceptedAt: new Date(Date.UTC(2026, 9, 1 + (i % 20), 12, 0, 0)),
        ipAddress: o.markers ? MARKERS.ip : null,
      })),
  );
  for (const c of chunks(acks)) await db.insert(acknowledgments).values(c);

  const trained = emps.filter((_, i) => i % 2 === 0);
  for (const c of chunks(trained))
    await db.insert(trainingCompletions).values(
      c.map((e, i) => ({
        companyId,
        employeeId: e.id,
        moduleId: MODULE_ID,
        score: 80 + (i % 21),
        completedAt: new Date(Date.UTC(2026, 9, 5, 12, 0, 0)),
      })),
    );

  const discl = emps.filter((_, i) => i % 3 === 1);
  for (const c of chunks(discl))
    await db.insert(disclosures).values(
      c.map((e) => ({
        companyId,
        employeeId: e.id,
        type: DISCLOSURE_TYPE,
        periodYear: new Date().getUTCFullYear(),
        content: o.markers ? MARKERS.disclosure : MARKERS.ciphertext,
        submittedAt: new Date(Date.UTC(2026, 9, 8, 12, 0, 0)),
      })),
    );

  const vens = nVen
    ? await db
        .insert(vendors)
        .values(
          Array.from({ length: nVen }, (_, i) => ({
            companyId,
            name: `Fornecedor ${String(i + 1).padStart(2, "0")} Ltda ${label}`,
            country: i % 2 === 0 ? "BR" : "AR",
            contactEmail: o.markers
              ? `${MARKERS.vendorContactEmail}-${i}@example.test`
              : null,
            questionnaireStatus:
              i % 3 === 0 ? "submitted" : i % 3 === 1 ? "sent" : "not_sent",
            invitedAt: i % 3 === 2 ? null : new Date(Date.UTC(2026, 9, 2, 12)),
            submittedAt:
              i % 3 === 0 ? new Date(Date.UTC(2026, 9, 3, 12)) : null,
          })),
        )
        .returning()
    : [];
  for (const [i, v] of vens.entries()) {
    if (i % 3 === 0)
      await db.insert(vendorResponses).values({
        companyId,
        vendorId: v.id,
        respondentName: o.markers
          ? MARKERS.vendorRespondent
          : MARKERS.ciphertext,
        respondentRole: o.markers
          ? MARKERS.vendorRespondent
          : MARKERS.ciphertext,
        ownershipText: o.markers ? MARKERS.vendorOwnership : MARKERS.ciphertext,
        pepExposure: true,
        pepDetails: o.markers ? MARKERS.vendorPep : MARKERS.ciphertext,
        priorSanctions: false,
        antibriberyPolicy: true,
      });
    if (i % 2 === 0)
      await db.insert(vendorScreenings).values({
        companyId,
        vendorId: v.id,
        provider: "opensanctions",
        dataset: "default",
        nameScreened: v.name,
        status: i % 4 === 0 ? "possible_match" : "no_match",
        matchCount: i % 4 === 0 ? 2 : 0,
        screenedAt: new Date(Date.UTC(2026, 9, 6, 12)),
      });
  }

  for (let i = 0; i < nRep; i++) {
    const [r] = await db
      .insert(whistleblowerReports)
      .values({
        companyId,
        trackingCode: o.markers
          ? `${MARKERS.trackingCode}${label}${i}`
          : `TRK-${label}-${i}`,
        category: "fraud",
        description: o.markers ? MARKERS.reportDescription : MARKERS.ciphertext,
        reporterContact: o.markers ? MARKERS.reportContact : null,
        isAnonymous: !o.markers,
        status: i % 3 === 0 ? "new" : i % 3 === 1 ? "under_review" : "closed",
      })
      .returning();
    if (o.markers) {
      await db.insert(whistleblowerEvidence).values({
        companyId,
        reportId: r.id,
        fileName: `${MARKERS.evidenceFile}.bin`,
        contentType: "image/png",
        sizeBytes: 10,
      });
      await db.insert(whistleblowerNotes).values({
        companyId,
        reportId: r.id,
        kind: "note",
        body: MARKERS.reportNote,
        authorUserId: s.user.id,
      });
    }
  }

  return { ...s, employees: emps, vendors: vens, docs, types: DOCUMENT_TYPES };
}

/** Inserts a queued job and runs it to completion in-process (the code path the server uses). */
export async function makeBinder(
  db: Db,
  s: { company: { id: string }; user: { id: string } },
  options: BinderOptions = { includeChannelStats: false },
  hooks?: JobHooks,
) {
  const [row] = await db
    .insert(binders)
    .values({
      companyId: s.company.id,
      requestedByUserId: s.user.id,
      options,
    })
    .returning({ id: binders.id });
  await runBinderJob(db, row.id, hooks);
  const [done] = await db.select().from(binders).where(eq(binders.id, row.id));
  return done;
}

/** What is inside a PDF: text per page, the outline (title -> page number) and link targets. */
export async function inspectPdf(buf: Buffer | Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const pageOfDest = async (dest: unknown) => {
    const d = typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(d)) return null;
    return (await doc.getPageIndex(d[0])) + 1;
  };
  const outline: { title: string; page: number | null }[] = [];
  for (const o of (await doc.getOutline()) ?? [])
    outline.push({ title: o.title, page: await pageOfDest(o.dest) });
  const pages: string[] = [];
  const links: { page: number; target: number | null }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+/g, " "),
    );
    for (const a of await page.getAnnotations())
      if (a.subtype === "Link" && a.dest)
        links.push({ page: i, target: await pageOfDest(a.dest) });
  }
  return {
    numPages: doc.numPages,
    pages,
    text: pages.join("\n"),
    outline,
    links,
  };
}
