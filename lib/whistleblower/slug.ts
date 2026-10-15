import { randomInt } from "node:crypto";

const ACCENTED = /\p{M}/gu;
const SUFFIX_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
export const MAX_SLUG_BASE = 40;

/** Company name -> URL slug: ASCII, lowercase, [a-z0-9-], at most ~40 chars, never empty. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(ACCENTED, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_BASE)
    .replace(/-+$/g, "");
  return base || "empresa";
}

/** On collision: append "-" + 4 random chars from [a-z0-9]. */
export function withSuffix(base: string): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += SUFFIX_CHARS[randomInt(SUFFIX_CHARS.length)];
  return `${base}-${s}`;
}
