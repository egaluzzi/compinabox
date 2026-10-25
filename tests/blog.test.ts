// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BLOG_ROOT, loadDir } from "@/lib/blog";
import {
  parseArticle,
  parseBlocks,
  parseInline,
  readingMinutes,
} from "@/lib/blog/parse";

const FM = (extra = "") =>
  `---\ntitle: T\ndescription: D\nslug: s\npublished: 2026-10-25\nupdated: 2026-10-25\nstatus: draft\ntopic: x\n${extra}---\n`;

const dirs = {
  "pt-BR": path.join(BLOG_ROOT, "pt-BR"),
  en: path.join(BLOG_ROOT, "en"),
};
const files = Object.entries(dirs).flatMap(([lang, d]) =>
  fs
    .readdirSync(d)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      lang,
      file: f,
      raw: fs.readFileSync(path.join(d, f), "utf8"),
    })),
);

describe("blog files", () => {
  it("seeds 4 pt-BR and 3 English articles", () => {
    expect(files.filter((f) => f.lang === "pt-BR")).toHaveLength(4);
    expect(files.filter((f) => f.lang === "en")).toHaveLength(3);
  });

  it("every file parses; slugs equal filenames and are unique", () => {
    for (const d of Object.values(dirs)) loadDir(d); // throws on any problem
    const slugs = files.map((f) => parseArticle(f.raw, f.file).slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const f of files)
      expect(parseArticle(f.raw, f.file).slug + ".md").toBe(f.file);
  });

  it("all seven are drafts, description <= 160, word count 450-900", () => {
    for (const f of files) {
      const a = parseArticle(f.raw, f.file);
      expect(a.status, f.file).toBe("draft");
      expect(a.description.length, f.file).toBeLessThanOrEqual(160);
      expect(a.words, f.file).toBeGreaterThanOrEqual(450);
      expect(a.words, f.file).toBeLessThanOrEqual(900);
    }
  });

  it("every article ends with the standard disclaimer line", () => {
    for (const f of files) {
      const last = f.raw.trim().split("\n").pop();
      expect(last, f.file).toBe(
        f.lang === "pt-BR"
          ? "Isto é informação geral, não aconselhamento jurídico."
          : "This is general information, not legal advice.",
      );
    }
  });
});

describe("guardrails over all articles", () => {
  const text = files.map((f) => f.raw).join("\n");

  it("legal references stay inside the allowed set (Lei 12.846/2013, Lei 14.133/2021, LGPD, DOJ)", () => {
    const refs = [
      ...text.matchAll(
        /\b(Lei|Law|Act|Decreto|Resolução|Portaria|Medida Provisória|Instrução Normativa)\b\s*(n[ºo.]?\s*)?[\d.,/]*\d/g,
      ),
    ].map((m) => m[0].replace(/\s+/g, " "));
    const allowed = /^Lei (12\.846|14\.133)(\/(2013|2021))?$/;
    for (const r of refs) expect(r, r).toMatch(allowed);
    for (const m of text.matchAll(/Lei (12\.846|14\.133)\/(\d{4})/g))
      expect(m[1] === "12.846" ? "2013" : "2021").toBe(m[2]);
    expect(text).not.toMatch(
      /\bArt(igo|\.|icle)\s*\d|§|\bISO\b|Decreto|Resolução|Portaria|\bFCPA\b|\bCGU\b/,
    );
    // every capitalised "Lei NNN" in the text is one of the two permitted laws
    for (const m of text.matchAll(/\bLei\s+([\d.]+)/g))
      expect(["12.846", "14.133"]).toContain(m[1].replace(/\.$/, ""));
  });

  it("DOJ appears only as 'DOJ' / 'Department of Justice' in the DOJ article", () => {
    for (const f of files) {
      const mentions = /\bDOJ\b|Department of Justice/.test(f.raw);
      expect(mentions, f.file).toBe(f.file.startsWith("doj-"));
    }
  });

  it("no forbidden or compliance-claiming phrases", () => {
    const banned = [
      /guarantee/i,
      /garant[ei]/i,
      /garantia/i,
      /certif/i,
      /100\s?%/,
      /ISO ?3730[12]/,
      /em conformidade/i,
      /conformidade com a lei/i,
      /atende (integralmente )?(a|às) exigências/i,
      /deixa (a )?sua empresa/i,
      /fully compliant/i,
      /compliant with/i,
      /ensures? compliance/i,
      /(é|esta) (garantido|assegurado)/i,
    ];
    for (const f of files)
      for (const re of banned) expect(f.raw, `${f.file} ${re}`).not.toMatch(re);
  });

  it("links are relative or https; no raw HTML tags", () => {
    for (const f of files) {
      expect(f.raw, f.file).not.toMatch(/<\/?[a-z]/i);
      for (const m of f.raw.matchAll(/\]\(([^)]*)\)/g))
        expect(m[1], f.file).toMatch(/^\/([^/]|$)/);
    }
  });

  it("the Lei 14.133 statement keeps its caveat: every article mentioning it says the edital/context decides", () => {
    for (const f of files.filter((x) => /Lei 14\.133/.test(x.raw))) {
      expect(f.raw, f.file).toMatch(/edital/i);
    }
  });
});

describe("parser", () => {
  it("rejects missing keys, bad dates, bad status, long description, unknown keys", () => {
    expect(() => parseArticle("no front matter", "f")).toThrow();
    expect(() =>
      parseArticle(FM().replace("topic: x\n", "") + "\nx", "f"),
    ).toThrow(/topic/);
    expect(() =>
      parseArticle(FM().replace("2026-10-25", "2026-13-40") + "x", "f"),
    ).toThrow(/date/);
    expect(() =>
      parseArticle(FM().replace("draft", "live") + "x", "f"),
    ).toThrow(/status/);
    expect(() =>
      parseArticle(FM().replace("D\n", `${"x".repeat(161)}\n`) + "x", "f"),
    ).toThrow(/160/);
    expect(() => parseArticle(FM("extra: 1\n") + "x", "f")).toThrow(/unknown/);
  });

  it("rejects unsupported syntax", () => {
    for (const bad of [
      "# H1",
      "#### H4",
      "```\ncode\n```",
      "| a | b |",
      "![i](/x.png)",
      "---",
      "    indented",
      "<!-- c -->",
      "a *b",
    ]) {
      expect(() => parseBlocks(bad, "f"), bad).toThrow();
    }
  });

  it("rejects http: and other link schemes, protocol-relative links", () => {
    for (const href of [
      "http://x.com",
      "javascript:alert(1)",
      "//evil.com",
      "data:text/html,x",
    ])
      expect(() => parseInline(`[a](${href})`, "f"), href).toThrow(
        /link not allowed/,
      );
    expect(
      parseInline("[a](/br/pricing) [b](https://x.com)", "f"),
    ).toHaveLength(3);
  });

  it("keeps HTML/script as plain text (React escapes it on render)", () => {
    const b = parseBlocks("<script>alert(1)</script> & <b>x</b>", "f");
    expect(b).toEqual([
      {
        t: "p",
        inline: [{ t: "text", text: "<script>alert(1)</script> & <b>x</b>" }],
      },
    ]);
  });

  it("parses the supported subset", () => {
    const b = parseBlocks(
      "## H\n\ntext **b** *i*\nmore\n\n- a\n- b\n\n1. x\n2. y\n\n> q\n\n### h3",
      "f",
    );
    expect(b.map((x) => x.t)).toEqual(["h2", "p", "ul", "ol", "quote", "h3"]);
  });

  it("reading time is words / 200 rounded up", () => {
    expect([
      readingMinutes(1),
      readingMinutes(200),
      readingMinutes(201),
      readingMinutes(650),
    ]).toEqual([1, 1, 2, 4]);
  });
});
