// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n";

const root = path.resolve(__dirname, "..");
const load = (l: string) =>
  JSON.parse(fs.readFileSync(path.join(root, "messages", `${l}.json`), "utf8"));

function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}

const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(load(l))]));

describe("message files", () => {
  it("have identical key sets in all four locales", () => {
    const all = new Set(LOCALES.flatMap((l) => Object.keys(flat[l])));
    for (const l of LOCALES) {
      const missing = [...all].filter((k) => !(k in flat[l]));
      expect({ locale: l, missing }).toEqual({ locale: l, missing: [] });
    }
  });

  it("have no empty strings", () => {
    for (const l of LOCALES) {
      const empty = Object.entries(flat[l])
        .filter(([, v]) => v.trim() === "")
        .map(([k]) => k);
      expect({ locale: l, empty }).toEqual({ locale: l, empty: [] });
    }
  });
});

// Every string is either verbatim CONTENT.md copy or listed in messages/DRAFTS.md.
const norm = (s: string) =>
  s
    .replace(/<\/?b>/g, "")
    .replace(/[*\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const content = norm(fs.readFileSync(path.join(root, "CONTENT.md"), "utf8"));
const drafts = new Set(
  fs
    .readFileSync(path.join(root, "messages", "DRAFTS.md"), "utf8")
    .split("\n")
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter(
      (cells) =>
        cells.length >= 4 && (LOCALES as readonly string[]).includes(cells[1]),
    )
    .map((cells) => `${cells[1]}:${cells[2]}`),
);

describe("copy provenance", () => {
  it("every DRAFTS.md row points at an existing key", () => {
    for (const row of drafts) {
      const [l, key] = [
        row.slice(0, row.indexOf(":")),
        row.slice(row.indexOf(":") + 1),
      ];
      expect(flat[l], row).toHaveProperty([key]);
    }
  });

  for (const l of LOCALES) {
    it(`${l}: every string not in DRAFTS.md appears verbatim in CONTENT.md`, () => {
      const bad = Object.entries(flat[l])
        .filter(([key]) => !drafts.has(`${l}:${key}`))
        .filter(([, text]) => !content.includes(norm(text)))
        .map(([key]) => key);
      expect(bad).toEqual([]);
    });
  }
});

describe("forbidden claims (CLAUDE.md §8)", () => {
  it("no ISO 37301/37002 mention in any locale", () => {
    for (const l of LOCALES) {
      expect(Object.values(flat[l]).join("\n")).not.toMatch(/ISO ?3730[12]/);
    }
  });
});
