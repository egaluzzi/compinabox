import {
  Document,
  Font,
  Image,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { getT } from "@/lib/i18n";
import { readUpload, sniffImage } from "@/lib/uploads";
import { parseDocument } from "./generate";
import type { StructuredDocument } from "./types";

// react-pdf hyphenates with English patterns, which splits Portuguese words wrongly ("re-sposta").
// Break lines at spaces only. Registered here because every PDF (documents, roster, binder) imports
// this module, so they all behave the same.
Font.registerHyphenationCallback((word) => [word]);

// Built-in Helvetica only: no network font fetch, and its WinAnsi set covers ç ã é õ.
const styles = StyleSheet.create({
  page: {
    paddingTop: 96,
    paddingBottom: 90,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
    fontSize: 10.5,
    // lineHeight is set on the body text styles, not here: inherited by the footer it makes
    // react-pdf drop the page-number render text
    color: "#0f172a",
  },
  header: {
    position: "absolute",
    top: 28,
    left: 56,
    right: 56,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 8,
  },
  logo: { width: 48, height: 48, objectFit: "contain", marginRight: 12 },
  headerText: { flex: 1 },
  company: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  headerTitle: { fontSize: 9.5, color: "#475569" },
  draft: { fontSize: 8, color: "#b45309", fontFamily: "Helvetica-Bold" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 56,
    right: 56,
    height: 52,
    borderTopWidth: 0.75,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    fontSize: 7.5,
    color: "#475569",
    // NB: no lineHeight here — on the container it makes react-pdf drop the page-number render text
  },
  // lineHeight is a multiple of the node's own fontSize, so each node sets both explicitly
  footerText: { fontSize: 7.5, lineHeight: 1.35 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
  },
  // render-prop text has no intrinsic width in a flex row, so it gets an explicit one
  pageNumber: { width: 90, textAlign: "right" },
});

// Text styles of a document's body, shared with the phase 8 binder so a policy looks the same in
// its own PDF and inside the dossier.
export const bodyStyles = StyleSheet.create({
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 14 },
  heading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 14,
    marginBottom: 5,
  },
  p: { marginBottom: 6, fontSize: 10.5, lineHeight: 1.45 },
});

/** The sections of a document, without page furniture (title excluded). */
export function DocumentSections({ doc }: { doc: StructuredDocument }) {
  return (
    <>
      {doc.sections.map((s) => (
        <View key={s.id}>
          {/* heading + first paragraph never split from each other across a page break */}
          <View wrap={false}>
            <Text style={bodyStyles.heading}>{s.heading}</Text>
            <Text style={bodyStyles.p}>{s.paragraphs[0]}</Text>
          </View>
          {s.paragraphs.slice(1).map((p, i) => (
            <Text key={i} style={bodyStyles.p}>
              {p}
            </Text>
          ))}
        </View>
      ))}
    </>
  );
}

export type PdfMeta = { version: number; generatedAt: Date; logo?: LoadedLogo };
export type LoadedLogo = { data: Buffer; format: "png" | "jpg" };

function formatDate(d: Date, locale: string) {
  return d.toLocaleDateString(locale, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DocumentPdf({
  doc,
  meta,
}: {
  doc: StructuredDocument;
  meta: PdfMeta;
}) {
  const t = getT(doc.locale);
  const draft = doc.reviewStatus === "draft";
  return (
    <Document
      title={`${doc.title} - ${doc.mergeSnapshot.companyName}`}
      author={doc.mergeSnapshot.companyName}
      language={doc.locale}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          {meta.logo && (
            <Image
              style={styles.logo}
              src={{ data: meta.logo.data, format: meta.logo.format }}
            />
          )}
          <View style={styles.headerText}>
            <Text style={styles.company}>{doc.mergeSnapshot.companyName}</Text>
            <Text style={styles.headerTitle}>{doc.title}</Text>
            {draft && <Text style={styles.draft}>{t("legal.draft")}</Text>}
          </View>
        </View>

        <Text style={bodyStyles.title}>{doc.title}</Text>
        <DocumentSections doc={doc} />

        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              {t("documents.version", { n: meta.version })} ·{" "}
              {t("documents.generatedOn", {
                date: formatDate(meta.generatedAt, doc.locale),
              })}
            </Text>
            <Text
              style={styles.pageNumber}
              render={({ pageNumber, totalPages }) =>
                // react-pdf calls this once before the total is known; ICU would throw on undefined
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

/** Structural check so a truncated/corrupt file is rejected before react-pdf trips over it. */
export function isWellFormedImage(buf: Uint8Array, format: "png" | "jpg") {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (format === "jpg")
    return b.length > 4 && b.subarray(-16).includes(Buffer.from([0xff, 0xd9])); // EOI marker (tolerates trailing padding)
  // PNG: signature, then chunks (IHDR first) until a complete IEND.
  let pos = 8;
  if (b.length < 33 || b.toString("latin1", 12, 16) !== "IHDR") return false;
  while (pos + 12 <= b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.toString("latin1", pos + 4, pos + 8);
    pos += 12 + len;
    if (pos > b.length) return false;
    if (type === "IEND") return true;
  }
  return false;
}

/**
 * Loads the stored logo for embedding. Anything missing, unreadable, corrupt or not PNG/JPEG
 * means "no logo": a PDF must never fail because of a logo. Logs once per call when a stored
 * logo exists but cannot be used.
 */
export async function loadLogo(
  logoFile: string | null | undefined,
): Promise<LoadedLogo | undefined> {
  if (!logoFile) return undefined;
  const data = await readUpload(logoFile);
  const format = data ? sniffImage(data) : null;
  if (data && format && isWellFormedImage(data, format))
    return { data, format };
  console.error(
    `documents/pdf: logo ${logoFile} is missing or unreadable, rendering without it`,
  );
  return undefined;
}

/**
 * Renders the PDF. A logo that cannot be decoded must never fail the document: we retry
 * without it and log once.
 */
export async function renderDocumentPdf(
  contentJson: string,
  meta: PdfMeta,
): Promise<Buffer> {
  const doc = parseDocument(contentJson);
  try {
    return await renderToBuffer(<DocumentPdf doc={doc} meta={meta} />);
  } catch (err) {
    if (!meta.logo) throw err;
    console.error(
      "documents/pdf: logo could not be embedded, rendering without it:",
      err instanceof Error ? err.message : err,
    );
    return renderToBuffer(
      <DocumentPdf doc={doc} meta={{ ...meta, logo: undefined }} />,
    );
  }
}

/** ASCII-safe download name, e.g. "politica-anticorrupcao-v2.pdf". */
export function pdfFilename(type: string, version: number) {
  return `${type.replace(/^policy:/, "politica-").replace(/[^a-z0-9]+/g, "-")}-v${version}.pdf`;
}
