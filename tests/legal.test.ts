// @vitest-environment node
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRIVACY_DOC } from "@/lib/legal/privacy";
import { TERMS_DOC } from "@/lib/legal/terms";
import { PLACEHOLDER_RE, type LegalDoc } from "@/lib/legal/types";
import { PRIVACY_TEXT_SHA256, TERMS_TEXT_SHA256 } from "@/lib/legal/version";

const root = path.resolve(__dirname, "..");
const sha = (d: LegalDoc) =>
  createHash("sha256").update(JSON.stringify(d)).digest("hex");
const flat = (d: LegalDoc) =>
  [
    d.title,
    ...d.intro,
    ...d.sections.flatMap((s) => [
      s.heading,
      ...(s.paragraphs ?? []),
      ...(s.bullets ?? []),
    ]),
  ].join("\n");

describe("the legal drafts are versioned with their text", () => {
  it("terms: the recorded hash matches the text (edit the text -> bump TERMS_VERSION and this hash)", () => {
    expect(sha(TERMS_DOC)).toBe(TERMS_TEXT_SHA256);
  });
  it("privacy: the recorded hash matches the text (edit the text -> bump PRIVACY_VERSION and this hash)", () => {
    expect(sha(PRIVACY_DOC)).toBe(PRIVACY_TEXT_SHA256);
  });
});

describe("what the drafts must not contain", () => {
  const texts = { terms: flat(TERMS_DOC), privacy: flat(PRIVACY_DOC) };
  for (const [name, text] of Object.entries(texts)) {
    it(`${name}: no article numbers, decrees, other statutes, ISO or Marco Civil`, () => {
      for (const re of [
        /\bart(igo)?s?\.?\s*\d/i,
        /\binciso\b/i,
        /\bdecreto\b/i,
        /\blei\s+(n[ºo.°]?\s*)?\d/i,
        /\b\d{1,2}\.\d{3}\/\d{2,4}\b/,
        /\bISO\b/,
        /marco civil/i,
        /\bGDPR\b|\bRGPD\b/i,
        /\bANPD\b/,
      ]) {
        expect(text, String(re)).not.toMatch(re);
      }
    });
    it(`${name}: no compliance / adequacy / certification claim`, () => {
      expect(text).not.toMatch(
        /em conformidade|plena conformidade|garante (a )?conformidade|garantimos (a )?conformidade|certificad[oa] |adequad[oa] à/i,
      );
    });
  }
  it("LGPD is named (and is the only statute named)", () => {
    expect(texts.privacy).toContain("LGPD");
  });
  it("the terms state the scope: not legal advice, no guarantee, no certification, customer remains responsible", () => {
    expect(texts.terms).toMatch(/Não é aconselhamento jurídico/);
    expect(texts.terms).toMatch(/Não garante que a empresa cliente cumpra/);
    expect(texts.terms).toMatch(/Não é certificação/);
    expect(texts.terms).toMatch(/A empresa cliente responde/);
  });
  it("privacy states retention as it is today, flagged as undefined", () => {
    expect(texts.privacy).toMatch(/não há exclusão automática/i);
    expect(texts.privacy).toMatch(/PRAZOS DE RETENÇÃO — a definir/);
  });
});

describe("placeholders", () => {
  const review = fs.readFileSync(
    path.join(root, "lib/legal/REVIEW.md"),
    "utf8",
  );
  const all = new Set<string>();
  for (const d of [TERMS_DOC, PRIVACY_DOC])
    for (const m of flat(d).matchAll(PLACEHOLDER_RE)) all.add(m[0]);
  it("exist (the drafts have open inputs)", () => {
    expect(all.size).toBeGreaterThanOrEqual(8);
  });
  it("every placeholder is listed in lib/legal/REVIEW.md", () => {
    const missing = [...all].filter((p) => !review.includes(p));
    expect(missing).toEqual([]);
  });
  it("no bare bracket placeholder escapes the highlighter", () => {
    const text = flat(TERMS_DOC) + flat(PRIVACY_DOC);
    const brackets = [...text.matchAll(/\[[^\]\n]*\]/g)].map((m) => m[0]);
    expect(brackets.filter((b) => !all.has(b))).toEqual([]);
  });
});
