// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { generateDocument, serializeDocument } from "@/lib/documents/generate";
import { loadLogo, pdfFilename, renderDocumentPdf } from "@/lib/documents/pdf";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { getT } from "@/lib/i18n";
import { extractPdf } from "./helpers/pdf";

const fixture = (n: string) =>
  readFileSync(path.join(__dirname, "fixtures", n));
const NAME = "Construções Ação & João Ltda";
const content = (type: (typeof DOCUMENT_TYPES)[number] = "code_of_conduct") =>
  serializeDocument(
    generateDocument({
      type,
      locale: "pt-BR",
      country: "br",
      company: { name: NAME, industry: "construction" },
    }),
  );
const meta = { version: 3, generatedAt: new Date("2026-10-14T15:00:00Z") };
const hasImage = (b: Buffer) => b.includes("/Subtype /Image");

describe("PDF rendering", () => {
  it("is a real PDF containing the company name and accented text, with page numbers, version, date and the fixed disclaimers", async () => {
    const buf = await renderDocumentPdf(content(), meta);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const { text, numPages, pages } = await extractPdf(buf);
    expect(numPages).toBeGreaterThan(1);
    expect(text).toContain(NAME);
    for (const w of [
      "ç",
      "ã",
      "é",
      "õ",
      "Código de Conduta",
      "Comprometimento da alta direção",
      "Relacionamento com agentes públicos",
    ])
      expect(text).toContain(w);
    for (let i = 1; i <= numPages; i++)
      expect(pages[i - 1]).toContain(`Página ${i} de ${numPages}`);
    expect(text).toContain("Versão 3");
    expect(text).toContain("Gerado em 14/10/2026");
    expect(text.replace(/\s+/g, " ")).toContain(
      getT("pt-BR")("footer.disclaimer"),
    );
    expect(text).toContain("RASCUNHO — pendente de revisão");
    expect(text).toContain(
      "Isto é informação geral, não aconselhamento jurídico.",
    );
    // the fixed header repeats on later pages
    expect(pages[numPages - 1]).toContain(NAME);
  });

  it("renders every document type", async () => {
    for (const type of DOCUMENT_TYPES) {
      const { text } = await extractPdf(
        await renderDocumentPdf(content(type), meta),
      );
      expect(text, type).toContain(NAME);
      expect(text, type).toContain("A legislação aplicável inclui");
    }
  });

  it("without a logo: no image in the PDF", async () => {
    expect(hasImage(await renderDocumentPdf(content(), meta))).toBe(false);
  });

  it("with a PNG or JPEG logo: the image is embedded", async () => {
    for (const [file, format] of [
      ["logo.png", "png"],
      ["logo.jpg", "jpg"],
    ] as const) {
      const buf = await renderDocumentPdf(content(), {
        ...meta,
        logo: { data: fixture(file), format },
      });
      expect(hasImage(buf), file).toBe(true);
      expect((await extractPdf(buf)).text).toContain(NAME);
    }
  });

  it("an undecodable logo never fails the PDF: loadLogo rejects it (logging once) and the PDF renders without it", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pdf-logo-"));
    vi.stubEnv("UPLOADS_DIR", dir);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const png = fixture("logo.png");
    const cases: Record<string, Buffer> = {
      "truncated.png": png.subarray(0, 40),
      "stub.png": Buffer.from("\x89PNG\r\n\x1a\n\0\0\0\rIHDR"),
      "truncated.jpg": fixture("logo.jpg").subarray(0, 100),
      "webp.png": Buffer.from("RIFF\x01\0\0\0WEBPVP8 "),
    };
    for (const [name, bytes] of Object.entries(cases)) {
      const file =
        name.charCodeAt(0).toString(16).padStart(2, "0").repeat(16) +
        name.slice(name.indexOf("."));
      writeFileSync(path.join(dir, file), bytes);
      err.mockClear();
      expect(await loadLogo(file), name).toBeUndefined();
      expect(err, name).toHaveBeenCalledTimes(1);
    }
    err.mockClear();
    expect(await loadLogo("c".repeat(32) + ".png")).toBeUndefined(); // missing file
    expect(await loadLogo(null)).toBeUndefined();
    expect(err).toHaveBeenCalledTimes(1);

    const buf = await renderDocumentPdf(content(), meta); // meta has no logo
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    // belt and braces: even if a bad image reaches the renderer the PDF is still produced
    const bad = await renderDocumentPdf(content(), {
      ...meta,
      logo: { data: Buffer.from(png.subarray(0, 40)), format: "png" },
    });
    expect(bad.subarray(0, 5).toString()).toBe("%PDF-");
    expect(hasImage(bad)).toBe(false);
    err.mockRestore();
  });

  it("loadLogo accepts well-formed PNG and JPEG", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pdf-logo-"));
    vi.stubEnv("UPLOADS_DIR", dir);
    writeFileSync(path.join(dir, "a".repeat(32) + ".png"), fixture("logo.png"));
    writeFileSync(path.join(dir, "b".repeat(32) + ".jpg"), fixture("logo.jpg"));
    expect((await loadLogo("a".repeat(32) + ".png"))?.format).toBe("png");
    expect((await loadLogo("b".repeat(32) + ".jpg"))?.format).toBe("jpg");
  });

  it("special characters in the company name are plain text, not markup", async () => {
    const c = serializeDocument(
      generateDocument({
        type: "code_of_conduct",
        locale: "pt-BR",
        country: "br",
        company: { name: "<b>X</b> & {{y}} Ltda", industry: "other" },
      }),
    );
    expect((await extractPdf(await renderDocumentPdf(c, meta))).text).toContain(
      "<b>X</b> & {{y}} Ltda",
    );
  });

  it("filenames are ASCII-safe", () => {
    expect(pdfFilename("code_of_conduct", 2)).toBe("code-of-conduct-v2.pdf");
    expect(pdfFilename("policy:anti_bribery", 1)).toBe(
      "politica-anti-bribery-v1.pdf",
    );
    for (const t of DOCUMENT_TYPES)
      expect(pdfFilename(t, 1)).toMatch(/^[a-z0-9-]+-v1\.pdf$/);
  });
});
