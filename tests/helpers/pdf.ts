/** Dev-only PDF text extraction (pdfjs-dist) so tests can prove what is actually inside a PDF. */
export async function extractPdf(buf: Buffer | Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
        .join("")
        .replace(/[ \t]+/g, " "),
    );
  }
  return { numPages: doc.numPages, pages, text: pages.join("\n") };
}
