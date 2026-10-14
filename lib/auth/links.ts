import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies, users, verificationTokens } from "@/lib/db/schema";
import { COUNTRY_LOCALE, type Locale } from "@/lib/i18n";
import type { Country } from "@/lib/countries";

export const WELCOME_TTL_MS = 24 * 60 * 60 * 1000;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const WELCOME_PREFIX = "welcome:";

/** Welcome-email link token. Only a hash is stored; consumed by consumeWelcomeToken (single-use). */
export async function createWelcomeToken(
  db: Db,
  email: string,
  now = new Date(),
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(verificationTokens).values({
    identifier: WELCOME_PREFIX + email.toLowerCase(),
    token: sha256(token),
    expires: new Date(now.getTime() + WELCOME_TTL_MS),
  });
  return token;
}

/** Atomic delete-and-return: a second use, an unknown token or an expired one all yield null. */
export async function consumeWelcomeToken(
  db: Db,
  token: string,
  now = new Date(),
): Promise<{ id: string; email: string; companyId: string } | null> {
  const rows = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, sha256(token)),
        gt(verificationTokens.expires, now),
      ),
    )
    .returning();
  const row = rows[0];
  if (!row || !row.identifier.startsWith(WELCOME_PREFIX)) return null;
  const email = row.identifier.slice(WELCOME_PREFIX.length);
  const [user] = await db.select().from(users).where(eq(users.email, email));
  return user
    ? { id: user.id, email: user.email, companyId: user.companyId }
    : null;
}

/** Locale for emails to an existing user: their company's country; English if unknown. */
export async function localeForEmail(
  db: Db,
  email: string,
): Promise<Locale | null> {
  const [row] = await db
    .select({ country: companies.country })
    .from(users)
    .innerJoin(companies, eq(companies.id, users.companyId))
    .where(eq(users.email, email.toLowerCase()));
  if (!row) return null;
  return COUNTRY_LOCALE[row.country as Country] ?? "en";
}
