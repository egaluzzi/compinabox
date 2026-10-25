import fs from "node:fs";
import path from "node:path";
import { getEnabledCountries, type Country } from "@/lib/countries";
import { parseArticle, type Article } from "./parse";

/** "generic" is the English blog at /blog; countries use their own folder (pt-BR for /br/blog). */
export type BlogScope = Country | "generic";

const DIRS: Record<BlogScope, string | null> = {
  br: "pt-BR",
  generic: "en",
  ar: null, // no articles yet: /ar/blog is a 404 until they exist
  mx: null,
};

export const BLOG_ROOT = path.join(process.cwd(), "content", "blog");

export function blogDir(scope: BlogScope): string | null {
  const d = DIRS[scope];
  return d ? path.join(BLOG_ROOT, d) : null;
}

/** Newest first. Throws on any malformed file or a slug that differs from its filename. */
export function loadDir(dir: string): Article[] {
  if (!fs.existsSync(dir)) return [];
  const out = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const article = parseArticle(
        fs.readFileSync(path.join(dir, f), "utf8"),
        f,
      );
      if (article.slug !== f.slice(0, -3))
        throw new Error(`${f}: slug "${article.slug}" must equal the filename`);
      return article;
    });
  return out.sort((a, b) => b.published.localeCompare(a.published));
}

export function listArticles(scope: BlogScope): Article[] {
  const dir = blogDir(scope);
  return dir ? loadDir(dir) : [];
}

export function getArticle(
  scope: BlogScope,
  slug: string,
): Article | undefined {
  if (!/^[a-z0-9-]+$/.test(slug)) return undefined;
  return listArticles(scope).find((a) => a.slug === slug);
}

/** A country blog exists only if the country is enabled (request time) and has articles. */
export function blogAvailable(scope: BlogScope): boolean {
  if (scope !== "generic" && !getEnabledCountries().includes(scope))
    return false;
  return listArticles(scope).length > 0;
}

export function blogPath(scope: BlogScope): string {
  return scope === "generic" ? "/blog" : `/${scope}/blog`;
}
