import type { ReactNode } from "react";
import {
  Document,
  Image,
  Link,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  bodyStyles,
  DocumentSections,
  type LoadedLogo,
} from "@/lib/documents/pdf";
import type { DocumentType } from "@/lib/documents/types";
import { TYPE_KEY } from "@/lib/employee/labels";
import { getT, type T } from "@/lib/i18n";
import { questionnaireState } from "@/lib/vendors/queries";
import { BINDER_TZ } from "./constants";
import type { BinderSnapshot, StepView } from "./snapshot";

// The dossier layout (phase 8). One react-pdf Document, A4 portrait, built-in Helvetica (no font
// fetch, WinAnsi covers the Portuguese accents), greyscale-safe: the only colour is the amber of
// the draft notice, which also carries a border and bold text so it survives a black-and-white
// print. Every statement in here is fixed text from messages (binder.pdf.*), data from the
// snapshot, or the existing document content — never a conclusion about the company.
//
// Page numbers: "Página X de Y" is a render callback (two-pass by react-pdf itself). The contents
// page shows the REAL start page of each section, so the document is rendered twice: pass one
// records where each section landed (the collector), pass two prints those numbers. If the second
// layout moved anything (it cannot while the contents page keeps the same number of pages) a third
// pass runs, and an unstable layout fails the job rather than print wrong numbers.

const INK = "#0f172a";
const MUTED = "#475569";
const RULE = "#cbd5e1";
const HEAD_BG = "#f1f5f9";
const AMBER = "#b45309";

const st = StyleSheet.create({
  page: {
    paddingTop: 86,
    paddingBottom: 86,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
  },
  header: {
    position: "absolute",
    top: 30,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: RULE,
    paddingBottom: 7,
  },
  headerCompany: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  headerTitle: { fontSize: 9, color: MUTED },
  footer: {
    position: "absolute",
    bottom: 22,
    left: 56,
    right: 56,
    height: 52,
    borderTopWidth: 0.75,
    borderTopColor: RULE,
    paddingTop: 6,
    fontSize: 7.5,
    color: MUTED,
    // no lineHeight on the container: it makes react-pdf drop render-prop text
  },
  footerText: { fontSize: 7.5, lineHeight: 1.35 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  pageNumber: { width: 90, textAlign: "right" },
  logo: { width: 72, height: 72, objectFit: "contain", marginBottom: 26 },
  coverKicker: { fontSize: 10, color: MUTED, marginBottom: 6 },
  coverTitle: { fontSize: 30, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverCompany: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginTop: 30,
    marginBottom: 12,
  },
  coverRule: {
    borderTopWidth: 1.5,
    borderTopColor: INK,
    marginTop: 14,
    marginBottom: 4,
  },
  kv: { flexDirection: "row", marginBottom: 5 },
  kvLabel: { width: 150, fontSize: 9.5, color: MUTED },
  kvValue: { flex: 1, fontSize: 10.5 },
  draftBox: {
    marginTop: 22,
    borderWidth: 1.25,
    borderColor: AMBER,
    padding: 10,
  },
  draftHead: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: AMBER,
    marginBottom: 4,
  },
  draftText: { fontSize: 9.5, lineHeight: 1.4, color: INK },
  howHeading: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 26,
    marginBottom: 6,
  },
  p: { fontSize: 10, lineHeight: 1.45, marginBottom: 6 },
  pSmall: { fontSize: 8.5, lineHeight: 1.4, color: MUTED, marginBottom: 5 },
  secNum: { fontSize: 10, color: MUTED, marginBottom: 2 },
  secTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  secRule: {
    borderTopWidth: 1.5,
    borderTopColor: INK,
    marginTop: 6,
    marginBottom: 14,
  },
  sub: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 5,
  },
  bullet: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 12, fontSize: 10, lineHeight: 1.45 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.45 },
  tocRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 6,
  },
  tocNum: { width: 34, fontSize: 10.5, color: MUTED },
  tocTitle: { flex: 1, fontSize: 10.5 },
  tocPage: { width: 40, fontSize: 10.5, textAlign: "right" },
  tocLink: { color: INK, textDecoration: "none" },
  tHead: {
    flexDirection: "row",
    backgroundColor: HEAD_BG,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: MUTED,
    paddingVertical: 4,
    paddingHorizontal: 3,
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 3.5,
    paddingHorizontal: 3,
  },
  tHeadCell: { fontSize: 7.5, fontFamily: "Helvetica-Bold", paddingRight: 4 },
  tCell: { fontSize: 8.5, paddingRight: 4, lineHeight: 1.3 },
  tCellMuted: { fontSize: 8, color: MUTED, paddingRight: 4, lineHeight: 1.3 },
  docMeta: { fontSize: 9, color: MUTED, marginBottom: 12 },
  docDraft: {
    fontSize: 8.5,
    color: AMBER,
    fontFamily: "Helvetica-Bold",
    marginBottom: 12,
  },
  stat: { flexDirection: "row", marginBottom: 3 },
  statLabel: { width: 110, fontSize: 10 },
  statValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  url: { fontSize: 10.5, fontFamily: "Courier", marginBottom: 8 },
});

export type PageCollector = {
  /** section id -> page it started on, recorded while laying out */
  starts: Record<string, number>;
  total: number;
};

type Ctx = {
  snap: BinderSnapshot;
  t: T;
  logo?: LoadedLogo;
  /** page numbers from the previous pass; null on the first pass */
  pages: Record<string, number> | null;
  collector: PageCollector;
};

const fmtDate = (d: Date, locale: string) =>
  d.toLocaleDateString(locale, {
    timeZone: BINDER_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const fmtDateTime = (d: Date, locale: string) =>
  `${fmtDate(d, locale)} ${d.toLocaleTimeString(locale, {
    timeZone: BINDER_TZ,
    hour: "2-digit",
    minute: "2-digit",
  })}`;

/** 11222333000181 -> 11.222.333/0001-81 (only when it is 14 digits; anything else is shown as stored). */
const fmtTaxId = (raw: string) =>
  /^\d{14}$/.test(raw)
    ? raw.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : raw;

const docTitle = (t: T, type: DocumentType) =>
  t(`documents.types.${TYPE_KEY[type]}`);
const sectionTitle = (t: T, id: SectionId) => t(`binder.pdf.section.${id}`);

type SectionId =
  | "legal"
  | "documents"
  | "training"
  | "acknowledgments"
  | "disclosures"
  | "channel"
  | "vendors"
  | "notes";
const SECTION_IDS: SectionId[] = [
  "legal",
  "documents",
  "training",
  "acknowledgments",
  "disclosures",
  "channel",
  "vendors",
  "notes",
];
const destOf = (id: string) => `dest-${id}`;
const docSectionId = (type: DocumentType) => `doc-${TYPE_KEY[type]}`;

// --- furniture ------------------------------------------------------------------------------

function RunningHeader({ c }: { c: Ctx }) {
  return (
    <View style={st.header} fixed>
      <Text style={st.headerCompany}>{c.snap.company.name}</Text>
      <Text style={st.headerTitle}>{c.t("binder.pdf.headerTitle")}</Text>
    </View>
  );
}

function Footer({ c }: { c: Ctx }) {
  const { snap, t, collector } = c;
  return (
    <View style={st.footer} fixed>
      <View style={st.footerRow}>
        <Text style={st.footerText}>
          {t("binder.pdf.footerId", { id: snap.binderId.slice(0, 8) })} ·{" "}
          {fmtDate(snap.asOf, snap.locale)}
        </Text>
        <Text
          style={st.pageNumber}
          render={({ pageNumber, totalPages }) => {
            // react-pdf calls this once before the total is known; ICU would throw on undefined
            if (totalPages) collector.total = totalPages;
            return t("documents.pageOf", {
              page: pageNumber ?? 1,
              total: totalPages ?? pageNumber ?? 1,
            });
          }}
        />
      </View>
      <Text style={st.footerText}>{t("footer.disclaimer")}</Text>
    </View>
  );
}

/**
 * A page of the dossier: running header (not on the cover), content, footer. `id` makes the page
 * a link target and an entry in the PDF outline; its real page number is recorded for the contents.
 */
function DossierPage({
  c,
  id,
  title,
  cover,
  children,
}: {
  c: Ctx;
  id?: string;
  title?: string;
  cover?: boolean;
  children: ReactNode;
}) {
  return (
    <Page
      size="A4"
      style={st.page}
      bookmark={title ? { title, fit: true } : undefined}
    >
      {!cover && <RunningHeader c={c} />}
      {id && (
        <View id={destOf(id)}>
          <Text
            // zero-height probe: records the page this section really starts on
            style={{ height: 0, fontSize: 1 }}
            render={({ pageNumber }) => {
              if (pageNumber) c.collector.starts[id] = pageNumber;
              return " ";
            }}
          />
        </View>
      )}
      {children}
      <Footer c={c} />
    </Page>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <View wrap={false}>
      <Text style={st.secNum}>{num}</Text>
      <Text style={st.secTitle}>{title}</Text>
      <View style={st.secRule} />
    </View>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <View>
    {items.map((it, i) => (
      <View key={i} style={st.bullet} wrap={false}>
        <Text style={st.bulletDot}>•</Text>
        <Text style={st.bulletText}>{it}</Text>
      </View>
    ))}
  </View>
);

/** Sub-heading kept together with the first item that follows it (no orphan headings). */
const Sub = ({ title, first }: { title: string; first: ReactNode }) => (
  <View wrap={false}>
    <Text style={st.sub}>{title}</Text>
    {first}
  </View>
);

type Col = { width?: number; flex?: number; align?: "left" | "right" };
const colStyle = (col: Col) =>
  col.flex ? { flex: col.flex } : { width: col.width };

/**
 * A table that breaks across pages: the header row repeats on every page (`fixed`) and a row is
 * never split. Cells are strings or [text, muted second line].
 */
function Table({
  cols,
  head,
  rows,
}: {
  cols: Col[];
  head: string[];
  rows: (string | [string, string])[][];
}) {
  return (
    <View>
      <View style={st.tHead} fixed>
        {head.map((h, i) => (
          <Text
            key={i}
            style={[
              st.tHeadCell,
              colStyle(cols[i]),
              { textAlign: cols[i].align ?? "left" },
            ]}
          >
            {h}
          </Text>
        ))}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={st.tRow} wrap={false}>
          {r.map((cell, i) => (
            <View key={i} style={colStyle(cols[i])}>
              {typeof cell === "string" ? (
                <Text
                  style={[st.tCell, { textAlign: cols[i].align ?? "left" }]}
                >
                  {cell}
                </Text>
              ) : (
                <>
                  <Text style={st.tCell}>{cell[0]}</Text>
                  <Text style={st.tCellMuted}>{cell[1]}</Text>
                </>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// --- pages ----------------------------------------------------------------------------------

function Cover({ c }: { c: Ctx }) {
  const { snap, t, logo } = c;
  return (
    <DossierPage c={c} cover>
      {logo && (
        <Image style={st.logo} src={{ data: logo.data, format: logo.format }} />
      )}
      <Text style={st.coverKicker}>{t("binder.pdf.coverSubtitle")}</Text>
      <Text style={st.coverTitle}>{t("binder.pdf.title")}</Text>
      <View style={st.coverRule} />
      <Text style={st.coverCompany}>{snap.company.name}</Text>
      <View style={st.kv}>
        <Text style={st.kvLabel}>{t("binder.pdf.taxId")}</Text>
        <Text style={st.kvValue}>{fmtTaxId(snap.company.taxId)}</Text>
      </View>
      <View style={st.kv}>
        <Text style={st.kvLabel}>{t("binder.pdf.asOf")}</Text>
        <Text style={st.kvValue}>{fmtDateTime(snap.asOf, snap.locale)}</Text>
      </View>
      <View style={st.kv}>
        <Text style={st.kvLabel}>{t("binder.pdf.binderId")}</Text>
        <Text style={st.kvValue}>{snap.binderId}</Text>
      </View>
      <Text style={[st.pSmall, { marginTop: 4 }]}>
        {t("binder.pdf.timezoneNote")}
      </Text>
      {snap.draft && (
        <View style={st.draftBox} wrap={false}>
          <Text style={st.draftHead}>{t("legal.draft")}</Text>
          <Text style={st.draftText}>{t("binder.pdf.draftNote")}</Text>
        </View>
      )}
      <Text style={st.howHeading}>{t("binder.pdf.howTitle")}</Text>
      <Text style={st.p}>{t("binder.pdf.how1")}</Text>
      <Text style={st.p}>{t("binder.pdf.how2")}</Text>
      <Text style={st.p}>{t("binder.pdf.how3")}</Text>
    </DossierPage>
  );
}

type TocEntry = { id: string; num: string; title: string; sub?: boolean };

function tocEntries(c: Ctx): TocEntry[] {
  const { t } = c;
  const out: TocEntry[] = [];
  SECTION_IDS.forEach((id, i) => {
    out.push({ id, num: String(i + 1), title: sectionTitle(t, id) });
    if (id === "documents")
      c.snap.documents.forEach((d, j) =>
        out.push({
          id: docSectionId(d.type),
          num: `${i + 1}.${j + 1}`,
          title: docTitle(t, d.type),
          sub: true,
        }),
      );
  });
  return out;
}

function Contents({ c }: { c: Ctx }) {
  const { t, pages } = c;
  return (
    <DossierPage c={c} id="contents" title={t("binder.pdf.contents")}>
      <SectionHead num=" " title={t("binder.pdf.contents")} />
      {tocEntries(c).map((e) => (
        <View key={e.id} style={st.tocRow} wrap={false}>
          <Text style={[st.tocNum, e.sub ? { paddingLeft: 14 } : {}]}>
            {e.num}
          </Text>
          <Link src={`#${destOf(e.id)}`} style={[st.tocTitle, st.tocLink]}>
            {e.title}
          </Link>
          <Text style={st.tocPage}>{pages?.[e.id] ?? "…"}</Text>
        </View>
      ))}
    </DossierPage>
  );
}

function Legal({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const legal = snap.legal;
  const title = sectionTitle(t, "legal");
  return (
    <DossierPage c={c} id="legal" title={`1 ${title}`}>
      <SectionHead num="1" title={title} />
      <Text style={st.p}>{t("binder.pdf.legal.intro")}</Text>
      {legal?.reviewStatus === "draft" && (
        <Text style={st.docDraft}>
          {t("legal.draft")} — {t("binder.pdf.legal.draftNote")}
        </Text>
      )}
      {legal && (
        <>
          <Text style={st.p}>{legal.explainer}</Text>
          <Sub
            title={t("binder.pdf.legal.references")}
            first={
              <View style={{ marginBottom: 6 }} wrap={false}>
                <Text
                  style={[
                    st.p,
                    { fontFamily: "Helvetica-Bold", marginBottom: 2 },
                  ]}
                >
                  {legal.laws[0]?.officialName}
                </Text>
                <Text style={st.p}>{legal.laws[0]?.summary}</Text>
              </View>
            }
          />
          {legal.laws.slice(1).map((l) => (
            <View key={l.id} style={{ marginBottom: 6 }} wrap={false}>
              <Text
                style={[
                  st.p,
                  { fontFamily: "Helvetica-Bold", marginBottom: 2 },
                ]}
              >
                {l.officialName}
              </Text>
              <Text style={st.p}>{l.summary}</Text>
            </View>
          ))}
          <Sub
            title={t("binder.pdf.legal.required")}
            first={
              <Bullets items={legal.requiredElements.map((e) => e.text)} />
            }
          />
          <Sub
            title={t("binder.pdf.legal.recommended")}
            first={
              <Bullets items={legal.recommendedElements.map((e) => e.text)} />
            }
          />
          <Text style={[st.pSmall, { marginTop: 10 }]}>{legal.disclaimer}</Text>
        </>
      )}
    </DossierPage>
  );
}

function DocumentsIndex({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const title = sectionTitle(t, "documents");
  return (
    <DossierPage c={c} id="documents" title={`2 ${title}`}>
      <SectionHead num="2" title={title} />
      <Text style={st.p}>{t("binder.pdf.documents.intro")}</Text>
      <Table
        cols={[{ flex: 1 }, { width: 70 }, { width: 80, align: "right" }]}
        head={[
          t("binder.pdf.col.document"),
          t("binder.pdf.col.version"),
          t("binder.pdf.col.date"),
        ]}
        rows={snap.documents.map((d) => [
          docTitle(t, d.type),
          d.entry ? String(d.entry.version) : "—",
          d.entry ? fmtDate(d.entry.generatedAt, snap.locale) : "—",
        ])}
      />
    </DossierPage>
  );
}

function DocumentPage({ c, index }: { c: Ctx; index: number }) {
  const { snap, t } = c;
  const d = snap.documents[index];
  const id = docSectionId(d.type);
  const name = docTitle(t, d.type);
  return (
    <DossierPage c={c} id={id} title={`2.${index + 1} ${name}`}>
      {d.entry ? (
        <>
          <Text style={bodyStyles.title}>{d.entry.doc.title}</Text>
          <Text style={st.docMeta}>
            {t("binder.pdf.documents.meta", {
              version: d.entry.version,
              date: fmtDate(d.entry.generatedAt, snap.locale),
            })}
          </Text>
          {d.entry.doc.reviewStatus === "draft" && (
            <Text style={st.docDraft}>{t("legal.draft")}</Text>
          )}
          <DocumentSections doc={d.entry.doc} />
        </>
      ) : (
        <>
          <Text style={bodyStyles.title}>{name}</Text>
          <Text style={st.p}>{t("binder.pdf.documents.missing")}</Text>
        </>
      )}
    </DossierPage>
  );
}

function Training({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const tr = snap.training;
  const title = sectionTitle(t, "training");
  return (
    <DossierPage c={c} id="training" title={`3 ${title}`}>
      <SectionHead num="3" title={title} />
      {!tr.available ? (
        <Text style={st.p}>{t("binder.pdf.training.unavailable")}</Text>
      ) : (
        <>
          <Text style={st.p}>{t("binder.pdf.training.intro")}</Text>
          <Text style={st.p}>
            {t("binder.pdf.training.module", {
              id: tr.moduleId,
              lessons: tr.lessons,
              questions: tr.questions,
              pass: tr.passPercent,
            })}
          </Text>
          <Text style={st.docDraft}>{t("binder.pdf.training.draft")}</Text>
          <Text style={[st.p, { fontFamily: "Helvetica-Bold" }]}>
            {t("binder.pdf.training.counts", {
              invited: tr.invited,
              completed: tr.completed,
              active: snap.activeEmployees,
            })}
          </Text>
          <Text style={st.pSmall}>{t("binder.pdf.training.note")}</Text>
          {tr.rows.length === 0 ? (
            <Text style={st.p}>{t("binder.pdf.empty.employees")}</Text>
          ) : (
            <Table
              cols={[
                { flex: 1 },
                { width: 90 },
                { width: 80 },
                { width: 50, align: "right" },
              ]}
              head={[
                t("binder.pdf.col.name"),
                t("binder.pdf.col.status"),
                t("binder.pdf.col.date"),
                t("binder.pdf.col.score"),
              ]}
              rows={tr.rows.map((r) => [
                r.name,
                r.state === "done"
                  ? t("binder.pdf.state.done")
                  : t("binder.pdf.state.pending"),
                r.at ? fmtDate(r.at, snap.locale) : "—",
                r.score !== undefined ? `${r.score}%` : "—",
              ])}
            />
          )}
        </>
      )}
    </DossierPage>
  );
}

function Acknowledgments({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const a = snap.acknowledgments;
  const title = sectionTitle(t, "acknowledgments");
  const cell = (s: StepView | undefined) =>
    !s || s.state === "pending"
      ? t("binder.pdf.state.pending")
      : s.state === "outdated"
        ? t("binder.pdf.state.outdated")
        : fmtDate(s.at!, snap.locale);
  const types = a.currentDocs.map((d) => d.type);
  return (
    <DossierPage c={c} id="acknowledgments" title={`4 ${title}`}>
      <SectionHead num="4" title={title} />
      <Text style={st.p}>{t("binder.pdf.acks.intro")}</Text>
      <Text style={st.pSmall}>
        {t("binder.pdf.acks.versions")}:{" "}
        {a.currentDocs
          .map((d) => `${docTitle(t, d.type)} v${d.version}`)
          .join(" · ")}
      </Text>
      <Text style={st.pSmall}>{t("binder.pdf.acks.legend")}</Text>
      <Text style={[st.p, { fontFamily: "Helvetica-Bold" }]}>
        {t("binder.pdf.counts.active", { count: snap.activeEmployees })}
      </Text>
      {a.rows.length === 0 ? (
        <Text style={st.p}>{t("binder.pdf.empty.employees")}</Text>
      ) : (
        <Table
          cols={[{ flex: 1 }, ...types.map(() => ({ width: 54 }))]}
          head={[
            t("binder.pdf.col.name"),
            ...types.map((ty) =>
              t(`dashboard.employees.docShort.${TYPE_KEY[ty]}`),
            ),
          ]}
          rows={a.rows.map((r) => [
            r.name,
            ...types.map((ty) => cell(r.docs[ty])),
          ])}
        />
      )}
    </DossierPage>
  );
}

function Disclosures({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const d = snap.disclosures;
  const title = sectionTitle(t, "disclosures");
  return (
    <DossierPage c={c} id="disclosures" title={`5 ${title}`}>
      <SectionHead num="5" title={title} />
      <Text style={st.p}>
        {t("binder.pdf.disclosures.intro", { year: d.year })}
      </Text>
      <Text style={[st.p, { fontFamily: "Helvetica-Bold" }]}>
        {t("binder.pdf.disclosures.counts", {
          submitted: d.submitted,
          total: snap.activeEmployees,
        })}
      </Text>
      {d.rows.length === 0 ? (
        <Text style={st.p}>{t("binder.pdf.empty.employees")}</Text>
      ) : (
        <Table
          cols={[{ flex: 1 }, { width: 100 }, { width: 90 }]}
          head={[
            t("binder.pdf.col.name"),
            t("binder.pdf.col.status"),
            t("binder.pdf.col.date"),
          ]}
          rows={d.rows.map((r) => [
            r.name,
            r.at
              ? t("binder.pdf.disclosures.submitted")
              : t("binder.pdf.state.pending"),
            r.at ? fmtDate(r.at, snap.locale) : "—",
          ])}
        />
      )}
    </DossierPage>
  );
}

function Channel({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const ch = snap.channel;
  const title = sectionTitle(t, "channel");
  const how = [
    t("binder.pdf.channel.how1"),
    t("binder.pdf.channel.how2"),
    t("binder.pdf.channel.how3"),
    t("binder.pdf.channel.how4"),
    t("binder.pdf.channel.how5"),
    t("binder.pdf.channel.how6"),
  ];
  return (
    <DossierPage c={c} id="channel" title={`6 ${title}`}>
      <SectionHead num="6" title={title} />
      <Text style={st.p}>{t("binder.pdf.channel.intro")}</Text>
      <Text style={st.pSmall}>{t("binder.pdf.channel.url")}</Text>
      <Text style={st.url}>{ch.url}</Text>
      <View style={st.kv}>
        <Text style={[st.kvLabel, { width: 110 }]}>
          {t("binder.pdf.channel.since")}
        </Text>
        <Text style={st.kvValue}>
          {fmtDate(ch.availableSince, snap.locale)}
        </Text>
      </View>
      <Sub
        title={t("binder.pdf.channel.how")}
        first={<Bullets items={how.slice(0, 1)} />}
      />
      <Bullets items={how.slice(1)} />
      <Text style={[st.p, { marginTop: 6 }]}>
        {t("binder.pdf.channel.limits")}
      </Text>
      {ch.stats && (
        <Sub
          title={t("binder.pdf.channel.stats")}
          first={
            <View>
              <Text style={[st.p, { fontFamily: "Helvetica-Bold" }]}>
                {t("binder.pdf.channel.statsTotal", { count: ch.stats.total })}
              </Text>
              {(["new", "under_review", "closed"] as const).map((k) => (
                <View key={k} style={st.stat}>
                  <Text style={st.statLabel}>
                    {t(`binder.pdf.channel.status.${k}`)}
                  </Text>
                  <Text style={st.statValue}>{ch.stats!.byStatus[k] ?? 0}</Text>
                </View>
              ))}
              <Text style={[st.pSmall, { marginTop: 4 }]}>
                {t("binder.pdf.channel.statsNote")}
              </Text>
            </View>
          }
        />
      )}
    </DossierPage>
  );
}

function Vendors({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const title = sectionTitle(t, "vendors");
  const date = (d: Date) => fmtDate(d, snap.locale);
  const onDate = (d: Date) => t("dashboard.vendors.onDate", { date: date(d) });
  return (
    <DossierPage c={c} id="vendors" title={`7 ${title}`}>
      <SectionHead num="7" title={title} />
      <Text style={st.p}>{t("binder.pdf.vendors.intro")}</Text>
      <Text style={st.pSmall}>
        {t("dashboard.vendors.disclaimer", { dataset: vendorDatasets(snap) })}
      </Text>
      <Text style={st.pSmall}>{t("binder.pdf.vendors.noAnswers")}</Text>
      <Text style={[st.p, { fontFamily: "Helvetica-Bold" }]}>
        {t("binder.pdf.vendors.count", { count: snap.vendors.length })}
      </Text>
      {snap.vendors.length === 0 ? (
        <Text style={st.p}>{t("binder.pdf.vendors.empty")}</Text>
      ) : (
        <Table
          cols={[{ width: 128 }, { width: 34 }, { width: 112 }, { flex: 1 }]}
          head={[
            t("binder.pdf.vendors.colVendor"),
            t("binder.pdf.vendors.colCountry"),
            t("binder.pdf.vendors.colQuestionnaire"),
            t("binder.pdf.vendors.colScreening"),
          ]}
          rows={snap.vendors.map((v) => {
            const q = v.questionnaire;
            const qText = t(`dashboard.vendors.qState.${q}`, {
              date: v.questionnaireDate ? date(v.questionnaireDate) : "",
            });
            const qLine: string | [string, string] =
              q !== "submitted" && q !== "not_sent" && v.questionnaireDate
                ? [qText, onDate(v.questionnaireDate)]
                : qText;
            const s = v.screening;
            const sLine: string | [string, string] = !s
              ? t("dashboard.vendors.screenState.never")
              : [
                  t(`dashboard.vendors.screenState.${s.status}`, {
                    date: date(s.at),
                  }),
                  [
                    onDate(s.at),
                    t("binder.pdf.vendors.lists", { dataset: s.dataset }),
                    s.status === "possible_match"
                      ? t("binder.pdf.vendors.matches", {
                          count: s.possibleMatchCount,
                        })
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                ];
            return [v.name, v.country ?? "—", qLine, sLine];
          })}
        />
      )}
    </DossierPage>
  );
}

const vendorDatasets = (snap: BinderSnapshot) =>
  [
    ...new Set(
      snap.vendors.flatMap((v) => (v.screening ? [v.screening.dataset] : [])),
    ),
  ]
    .sort()
    .join(", ") || "—";

function Notes({ c }: { c: Ctx }) {
  const { snap, t } = c;
  const title = sectionTitle(t, "notes");
  const items = [
    t("binder.pdf.notes.asOf", { date: fmtDateTime(snap.asOf, snap.locale) }),
    t("binder.pdf.notes.employees"),
    t("binder.pdf.notes.excluded"),
    t("binder.pdf.notes.documents"),
    t("binder.pdf.notes.vendors"),
    snap.options.includeChannelStats
      ? t("binder.pdf.notes.statsOn")
      : t("binder.pdf.notes.statsOff"),
    t("binder.pdf.notes.personalData"),
    t("binder.pdf.notes.integrity"),
    t("binder.pdf.timezoneNote"),
  ];
  return (
    <DossierPage c={c} id="notes" title={`8 ${title}`}>
      <SectionHead num="8" title={title} />
      <Bullets items={items} />
    </DossierPage>
  );
}

function BinderDocument({ c }: { c: Ctx }) {
  const { snap, t } = c;
  return (
    <Document
      title={`${t("binder.pdf.title")} - ${snap.company.name}`}
      author={snap.company.name}
      subject={t("binder.pdf.coverSubtitle")}
      language={snap.locale}
    >
      <Cover c={c} />
      <Contents c={c} />
      <Legal c={c} />
      <DocumentsIndex c={c} />
      {snap.documents.map((_, i) => (
        <DocumentPage key={i} c={c} index={i} />
      ))}
      <Training c={c} />
      <Acknowledgments c={c} />
      <Disclosures c={c} />
      <Channel c={c} />
      <Vendors c={c} />
      <Notes c={c} />
    </Document>
  );
}

const sameStarts = (a: Record<string, number>, b: Record<string, number>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

async function renderPasses(
  snap: BinderSnapshot,
  logo: LoadedLogo | undefined,
): Promise<{ buffer: Buffer; pageCount: number }> {
  const t = getT(snap.locale);
  let pages: Record<string, number> | null = null;
  for (let pass = 0; pass < 3; pass++) {
    const collector: PageCollector = { starts: {}, total: 0 };
    const buffer = await renderToBuffer(
      <BinderDocument c={{ snap, t, logo, pages, collector }} />,
    );
    if (pages && sameStarts(pages, collector.starts))
      return { buffer, pageCount: collector.total };
    pages = collector.starts;
  }
  throw new Error("binder page numbers did not settle");
}

/**
 * Renders the dossier from an in-memory snapshot. Like the other PDFs, a logo that cannot be
 * embedded never fails the file: it is rendered again without it.
 */
export async function renderBinderPdf(
  snap: BinderSnapshot,
  logo?: LoadedLogo,
): Promise<{ buffer: Buffer; pageCount: number }> {
  try {
    return await renderPasses(snap, logo);
  } catch (err) {
    if (!logo) throw err;
    return renderPasses(snap, undefined);
  }
}
