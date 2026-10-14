import { randomUUID } from "node:crypto";
import { getDb, type Db } from "@/lib/db/client";
import { companies, users } from "@/lib/db/schema";

/**
 * DB-backed tests run against a real Postgres (TEST_DATABASE_URL, migrated from scratch by
 * verify.sh / CI). Unset = the test FAILS, never skips: a mock-only run is unverified.
 */
export function useTestDb(): Db {
  const url = process.env.TEST_DATABASE_URL;
  if (!url)
    throw new Error(
      "TEST_DATABASE_URL is not set — DB-backed tests must fail, not skip",
    );
  process.env.DATABASE_URL = url;
  return getDb();
}

export const uid = () => randomUUID().slice(0, 8);

export async function seedCompany(db: Db, label = uid()) {
  const [company] = await db
    .insert(companies)
    .values({ name: `Co ${label}`, taxId: "11222333000181", country: "br" })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ companyId: company.id, email: `admin-${label}@example.test` })
    .returning();
  return { company, user };
}
