// Blog article parsing: a small front-matter reader and a strict Markdown subset.
// Supported: ## / ### headings, paragraphs, **bold**, *italic*, [text](url), "- " and "1. " lists,
// "> " quotes. Anything else throws, so unsupported syntax fails the test/build instead of
// rendering raw. No HTML is ever produced from the text: React escapes every string.

export const STATUSES = ["draft", "published"] as const;
export type Status = (typeof STATUSES)[number];

export type Meta = {
  title: string;
  description: string;
  slug: string;
  published: string;
  updated: string;
  status: Status;
  topic: string;
};

export type Inline =
  | { t: "text"; text: string }
  | { t: "strong"; text: string }
  | { t: "em"; text: string }
  | { t: "link"; text: string; href: string };

export type Block =
  | { t: "h2" | "h3"; inline: Inline[] }
  | { t: "p"; inline: Inline[] }
  | { t: "quote"; inline: Inline[] }
  | { t: "ul" | "ol"; items: Inline[][] };

export type Article = Meta & { body: string; blocks: Block[]; words: number };

const KEYS = [
  "title",
  "description",
  "slug",
  "published",
  "updated",
  "status",
  "topic",
] as const;
export const MAX_DESCRIPTION = 160;

function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function isSafeHref(href: string): boolean {
  if (href.startsWith("/"))
    return !href.startsWith("//") && !href.includes("\\");
  return /^https:\/\/[^\s]+$/.test(href);
}

export function parseFrontMatter(raw: string, file: string) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`${file}: missing front matter`);
  const found: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!kv) throw new Error(`${file}: bad front-matter line "${line}"`);
    const [, key, rawValue] = kv;
    if (!(KEYS as readonly string[]).includes(key))
      throw new Error(`${file}: unknown front-matter key "${key}"`);
    if (key in found) throw new Error(`${file}: duplicate key "${key}"`);
    found[key] = rawValue.trim().replace(/^"(.*)"$/, "$1");
  }
  for (const k of KEYS)
    if (!found[k]) throw new Error(`${file}: missing front-matter key "${k}"`);
  if (found.description.length > MAX_DESCRIPTION)
    throw new Error(`${file}: description over ${MAX_DESCRIPTION} characters`);
  if (!isIsoDate(found.published) || !isIsoDate(found.updated))
    throw new Error(
      `${file}: published/updated must be valid YYYY-MM-DD dates`,
    );
  if (!(STATUSES as readonly string[]).includes(found.status))
    throw new Error(`${file}: status must be draft or published`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(found.slug))
    throw new Error(
      `${file}: slug must be lowercase letters, digits and dashes`,
    );
  return { meta: found as unknown as Meta, body: m[2] };
}

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]*)\)/g;

export function parseInline(text: string, file: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  const plain = (s: string) => {
    if (/[*]|\]\(|\[|\]/.test(s))
      throw new Error(
        `${file}: unsupported inline syntax in "${s.slice(0, 60)}"`,
      );
    if (s) out.push({ t: "text", text: s });
  };
  for (const m of text.matchAll(INLINE)) {
    plain(text.slice(last, m.index));
    if (m[1] !== undefined) out.push({ t: "strong", text: m[1] });
    else if (m[2] !== undefined) out.push({ t: "em", text: m[2] });
    else {
      if (!isSafeHref(m[4]))
        throw new Error(
          `${file}: link not allowed: "${m[4]}" (relative or https only)`,
        );
      out.push({ t: "link", text: m[3], href: m[4] });
    }
    last = (m.index ?? 0) + m[0].length;
  }
  plain(text.slice(last));
  return out;
}

export function parseBlocks(body: string, file: string): Block[] {
  const blocks: Block[] = [];
  const lines = body.split(/\r?\n/);
  let i = 0;
  const startsBlock = (l: string) => /^(#|>|- |\d+\. )/.test(l);
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (/^(```|~~~|\||!\[|\s{4}|\t|---|\*\*\*|___|<!--)/.test(line))
      throw new Error(
        `${file}: unsupported syntax on line "${line.slice(0, 40)}"`,
      );
    const h = /^(#{1,6}) (.+)$/.exec(line);
    if (h) {
      if (h[1] !== "##" && h[1] !== "###")
        throw new Error(
          `${file}: only ## and ### headings are supported ("${line}")`,
        );
      blocks.push({
        t: h[1] === "##" ? "h2" : "h3",
        inline: parseInline(h[2], file),
      });
      i++;
      continue;
    }
    if (line.startsWith("#"))
      throw new Error(`${file}: heading needs a space after # ("${line}")`);
    if (line.startsWith("> ")) {
      const parts: string[] = [];
      while (i < lines.length && lines[i].startsWith("> "))
        parts.push(lines[i++].slice(2));
      blocks.push({ t: "quote", inline: parseInline(parts.join(" "), file) });
      continue;
    }
    const ordered = /^\d+\. /.test(line);
    if (ordered || line.startsWith("- ")) {
      const re = ordered ? /^\d+\. (.*)$/ : /^- (.*)$/;
      const items: Inline[][] = [];
      while (i < lines.length && re.test(lines[i]))
        items.push(parseInline(re.exec(lines[i++])![1], file));
      blocks.push({ t: ordered ? "ol" : "ul", items });
      continue;
    }
    const parts: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !startsBlock(lines[i]))
      parts.push(lines[i++].trim());
    blocks.push({ t: "p", inline: parseInline(parts.join(" "), file) });
  }
  return blocks;
}

function inlineText(inl: Inline[]): string {
  return inl.map((x) => x.text).join("");
}

export function wordCount(blocks: Block[]): number {
  const text = blocks
    .map((b) =>
      "items" in b ? b.items.map(inlineText).join(" ") : inlineText(b.inline),
    )
    .join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

export function parseArticle(raw: string, file: string): Article {
  const { meta, body } = parseFrontMatter(raw, file);
  const blocks = parseBlocks(body, file);
  return { ...meta, body, blocks, words: wordCount(blocks) };
}

/** words / 200, rounded up, at least 1 */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}
