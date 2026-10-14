// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getLegalContent, isNotYetEnabled } from "@/lib/content";
import { br } from "@/lib/content/br";
import { DocumentGenerationError } from "@/lib/documents/errors";
import { generateDocument, serializeDocument } from "@/lib/documents/generate";
import { interpolate, MergeError } from "@/lib/documents/merge";
import { TEMPLATES } from "@/lib/documents/templates";
import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { INDUSTRIES } from "@/lib/industries";

const gen = (
  type: (typeof DOCUMENT_TYPES)[number],
  industry: (typeof INDUSTRIES)[number] = "technology",
  name = "Acme Ltda",
) =>
  generateDocument({
    type,
    locale: "pt-BR",
    country: "br",
    company: { name, industry },
  });

describe("merge fields", () => {
  const v = { companyName: "Acme", industry: "Saúde", country: "Brasil" };
  it("fills known fields", () => {
    expect(interpolate("{{companyName}} em {{ country }}", v)).toBe(
      "Acme em Brasil",
    );
  });
  it("throws on an unknown field", () => {
    expect(() => interpolate("Olá {{nope}}", v)).toThrow(MergeError);
    expect(() => interpolate("Olá {{nope}}", v)).toThrow(/Unknown merge field/);
  });
  it("throws on a missing/empty value", () => {
    expect(() => interpolate("{{companyName}}", { companyName: "  " })).toThrow(
      /Missing value/,
    );
  });
  it("throws on malformed braces", () => {
    expect(() => interpolate("{{companyName", v)).toThrow(MergeError);
    expect(() => interpolate("x }} y", v)).toThrow(MergeError);
  });
  it("does not interpret values: no re-interpolation, no eval", () => {
    expect(
      interpolate("{{companyName}}", {
        companyName: "{{industry}} ${1+1} <b>x</b>",
      }),
    ).toBe("{{industry}} ${1+1} <b>x</b>");
  });
  it("does not resolve inherited properties as fields", () => {
    expect(() => interpolate("{{constructor}}", v)).toThrow(/Unknown/);
  });
});

describe("generateDocument", () => {
  it("is deterministic: identical input -> identical serialisation", () => {
    for (const type of DOCUMENT_TYPES)
      expect(serializeDocument(gen(type))).toBe(serializeDocument(gen(type)));
  });
  it("contains no timestamps or randomness (content has no date/uuid-looking strings)", () => {
    const s = serializeDocument(gen("code_of_conduct"));
    expect(s).not.toMatch(
      /\d{4}-\d{2}-\d{2}T|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/,
    );
  });
  it("different company name or industry -> different content", () => {
    const a = serializeDocument(gen("code_of_conduct"));
    expect(
      serializeDocument(gen("code_of_conduct", "technology", "Beta")),
    ).not.toBe(a);
    expect(serializeDocument(gen("code_of_conduct", "construction"))).not.toBe(
      a,
    );
  });
  it("merges company name, industry label and country", () => {
    const d = gen("code_of_conduct", "construction", "Obras & Cia");
    expect(d.mergeSnapshot).toEqual({
      companyName: "Obras & Cia",
      industry: "Construção e engenharia",
      country: "Brasil",
    });
    expect(JSON.stringify(d)).toContain("Obras & Cia");
    expect(JSON.stringify(d)).not.toMatch(/\{\{|\}\}/);
  });
  it("code of conduct has the SPEC §5.1 clauses + leadership commitment + generic reporting section", () => {
    const ids = gen("code_of_conduct").sections.map((s) => s.id);
    for (const id of [
      "anti-bribery",
      "gifts-hospitality",
      "conflicts",
      "public-officials",
      "confidentiality",
      "leadership-commitment",
      "raise-concern",
    ])
      expect(ids).toContain(id);
  });
  it("per-industry notes appear only for industries that have them", () => {
    const has = (i: (typeof INDUSTRIES)[number]) =>
      gen("code_of_conduct", i).sections.some((s) => s.id === "industry-notes");
    expect(has("construction")).toBe(true);
    expect(has("health")).toBe(true);
    expect(has("finance")).toBe(true);
    expect(has("retail")).toBe(false);
    expect(has("other")).toBe(false);
  });
  it("injects legal references from br.ts and snapshots them in the document", () => {
    const d = gen("policy:anti_bribery");
    expect(d.legalReferences).toEqual(br.laws);
    const legal = d.sections.find((s) => s.id === "legal-context")!;
    const text = legal.paragraphs.join("\n");
    for (const law of br.laws) expect(text).toContain(law.citation);
    expect(text).toContain(br.explainer);
    expect(text).toContain(br.disclaimer);
    expect(text).toMatch(/^A legislação aplicável inclui/);
    expect(d.reviewStatus).toBe("draft");
  });
  it("every template has a legal-context section (the only place citations appear)", () => {
    for (const type of DOCUMENT_TYPES)
      expect(gen(type).sections.map((s) => s.id)).toContain("legal-context");
  });
  it("citations occur only in the legal-context section", () => {
    for (const type of DOCUMENT_TYPES) {
      const d = gen(type, "construction");
      for (const s of d.sections.filter((s) => s.id !== "legal-context"))
        for (const law of br.laws)
          expect(s.paragraphs.join(" "), `${type}/${s.id}`).not.toContain(
            law.citation,
          );
    }
  });
  it("returns typed errors for countries/locales without content or templates", () => {
    for (const country of ["ar", "mx"] as const) {
      expect(isNotYetEnabled(getLegalContent(country))).toBe(true);
      try {
        generateDocument({
          type: "code_of_conduct",
          locale: "pt-BR",
          country,
          company: { name: "X Ltda", industry: "other" },
        });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(DocumentGenerationError);
        expect((e as DocumentGenerationError).code).toBe("not_yet_enabled");
      }
    }
    expect(() =>
      generateDocument({
        type: "code_of_conduct",
        locale: "es-AR",
        country: "br",
        company: { name: "X Ltda", industry: "other" },
      }),
    ).toThrow(DocumentGenerationError);
  });
  it("an empty company name throws instead of producing a hole", () => {
    expect(() => gen("code_of_conduct", "technology", "   ")).toThrow(
      MergeError,
    );
  });
});

describe("templates carry no legal citations and no compliance claims", () => {
  const raw = JSON.stringify(TEMPLATES["pt-BR"]);
  it("no statute names/numbers/articles in template data", () => {
    expect(raw).not.toMatch(
      /Lei\s*(n[ºo°.]?\s*)?\d|\d{1,2}\.\d{3}\/\d{4}|Art\.|Artigo|Decreto|LGPD|LGRA|Medida Provisória|Constituição/i,
    );
  });
  it("no compliance/adequacy/certification claims, no ISO 37301/37002 (every doc, every industry)", () => {
    const claim =
      /em conformidade com a lei|atende (integralmente )?(a|às) exigências|ISO ?3730[12]|certificad[oa]|garante (a )?conformidade|garante o cumprimento|totalmente (em )?conforme/i;
    for (const type of DOCUMENT_TYPES)
      for (const industry of INDUSTRIES)
        expect(
          serializeDocument(gen(type, industry)),
          `${type}/${industry}`,
        ).not.toMatch(claim);
  });
  it("every document says it does not substitute for a lawyer / is general information", () => {
    for (const type of DOCUMENT_TYPES) {
      const text = serializeDocument(gen(type));
      expect(text).toContain("não aconselhamento jurídico");
      expect(text).toContain("não garante, por si só, o cumprimento");
    }
  });
});

describe("snapshots: every document x every industry", () => {
  for (const type of DOCUMENT_TYPES)
    for (const industry of INDUSTRIES)
      it(`${type} / ${industry}`, () => {
        expect(gen(type, industry, "Empresa Exemplo Ltda")).toMatchSnapshot();
      });
});
