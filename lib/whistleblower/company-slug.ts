import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/lib/documents/store";
import { companies } from "@/lib/db/schema";
import { slugify, withSuffix } from "./slug";

/**
 * A slug that no company has yet. Called inside the provisioning transaction; the unique index
 * is the real guard (a lost race fails the transaction and the processor retries the webhook).
 */
export async function uniqueCompanySlug(
  db: DbOrTx,
  name: string,
): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  for (let i = 0; i < 10; i++) {
    const [taken] = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.slug, candidate));
    if (!taken) return candidate;
    candidate = withSuffix(base);
  }
  throw new Error("could not find a free company slug");
}

export async function findCompanyBySlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, slug));
  return row ?? null;
}
