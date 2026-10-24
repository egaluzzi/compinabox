import {
  Document,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { getT, type Locale } from "@/lib/i18n";
import type { LoadedLogo } from "@/lib/documents/pdf";
import { exportRows, headerLabels, type Cell } from "./export";
import type { Roster } from "./roster";

// Roster status PDF in the style of the phase 3 documents: company logo, title, generated date,
// A4 (landscape: a ten-column table), "Página X de Y", disclaimer footer. Built-in Helvetica only.
const styles = StyleSheet.create({
  page: {
    paddingTop: 84,
    paddingBottom: 80,
    paddingHorizontal: 36,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#0f172a",
  },
  header: {
    position: "absolute",
    top: 24,
    left: 36,
    right: 36,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 8,
  },
  logo: { width: 40, height: 40, objectFit: "contain", marginRight: 10 },
  headerText: { flex: 1 },
  company: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  headerTitle: { fontSize: 9.5, color: "#475569" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    height: 48,
    borderTopWidth: 0.75,
    borderTopColor: "#cbd5e1",
    paddingTop: 5,
    fontSize: 7,
    color: "#475569",
  },
  footerText: { fontSize: 7, lineHeight: 1.3 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  pageNumber: { width: 90, textAlign: "right" },
  summary: { fontSize: 9, marginBottom: 8 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 3,
  },
  head: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#475569",
    paddingVertical: 3,
    backgroundColor: "#f1f5f9",
    fontFamily: "Helvetica-Bold",
  },
  cell: { paddingRight: 4, fontSize: 7.5 },
});

const W = [96, 150, 50, 48, 48, 48, 48, 48, 48, 52, 52]; // sums to 688 of 770 usable points

export type RosterPdfMeta = {
  companyName: string;
  generatedAt: Date;
  logo?: LoadedLogo;
  summary: string;
};

function Doc({
  roster,
  locale,
  meta,
}: {
  roster: Roster;
  locale: Locale;
  meta: RosterPdfMeta;
}) {
  const t = getT(locale);
  const date = (d: Date) =>
    d.toLocaleDateString(locale, {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  const cell = (c: Cell) =>
    c.kind === "done"
      ? date(c.at!)
      : c.kind === "outdated"
        ? t("dashboard.employees.markOutdated")
        : c.kind === "unavailable"
          ? "n/a"
          : "—";
  const rows = exportRows(roster);
  const title = t("employee.pdf.title");
  const head = headerLabels(locale);
  return (
    <Document
      title={`${title} - ${meta.companyName}`}
      author={meta.companyName}
      language={locale}
    >
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header} fixed>
          {meta.logo && (
            <Image
              style={styles.logo}
              src={{ data: meta.logo.data, format: meta.logo.format }}
            />
          )}
          <View style={styles.headerText}>
            <Text style={styles.company}>{meta.companyName}</Text>
            <Text style={styles.headerTitle}>
              {title} ·{" "}
              {t("employee.pdf.generatedOn", { date: date(meta.generatedAt) })}
            </Text>
          </View>
        </View>
        <Text style={styles.summary}>{meta.summary}</Text>
        <View style={styles.head} fixed>
          {head.map((h, i) => (
            <Text key={i} style={[styles.cell, { width: W[i] }]}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.id} style={styles.row} wrap={false}>
            <Text style={[styles.cell, { width: W[0] }]}>{r.name}</Text>
            <Text style={[styles.cell, { width: W[1] }]}>{r.email}</Text>
            <Text style={[styles.cell, { width: W[2] }]}>
              {r.deactivated
                ? t("dashboard.employees.deactivated")
                : t(`dashboard.employees.invite.${r.invite}`)}
            </Text>
            {r.docs.map((c, i) => (
              <Text key={i} style={[styles.cell, { width: W[3 + i] }]}>
                {cell(c)}
              </Text>
            ))}
            <Text style={[styles.cell, { width: W[9] }]}>
              {cell(r.training)}
            </Text>
            <Text style={[styles.cell, { width: W[10] }]}>
              {cell(r.disclosure)}
            </Text>
          </View>
        ))}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>{title}</Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) =>
                t("documents.pageOf", {
                  page: pageNumber ?? 1,
                  total: totalPages ?? pageNumber ?? 1,
                })
              }
            />
          </View>
          <Text style={styles.footerText}>{t("footer.disclaimer")}</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Same logo fallback as the document PDFs: a logo that cannot be embedded never fails the export. */
export async function renderRosterPdf(
  roster: Roster,
  locale: Locale,
  meta: RosterPdfMeta,
): Promise<Buffer> {
  try {
    return await renderToBuffer(
      <Doc roster={roster} locale={locale} meta={meta} />,
    );
  } catch (err) {
    if (!meta.logo) throw err;
    return renderToBuffer(
      <Doc
        roster={roster}
        locale={locale}
        meta={{ ...meta, logo: undefined }}
      />,
    );
  }
}
