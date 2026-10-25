import { randomUUID } from "node:crypto";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { getDb, schema, type Db } from "@/lib/db/client";
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
    .values({
      name: `Co ${label}`,
      slug: `co-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      taxId: "11222333000181",
      country: "br",
    })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ companyId: company.id, email: `admin-${label}@example.test` })
    .returning();
  return { company, user };
}

/**
 * A throwaway, fully migrated database for tests whose subject is "every row in the database"
 * (key rotation). TEST_DATABASE_URL's server must allow CREATE DATABASE (verify.sh requires it).
 */
export async function scratchDb() {
  const base = process.env.TEST_DATABASE_URL;
  if (!base) throw new Error("TEST_DATABASE_URL is not set");
  const name = `scratch_${uid()}_${Date.now()}`;
  const adminUrl = new URL(base);
  adminUrl.pathname = "/postgres";
  const admin = new Pool({ connectionString: adminUrl.toString(), max: 1 });
  await admin.query(`CREATE DATABASE "${name}"`);
  const url = new URL(base);
  url.pathname = `/${name}`;
  const pool = new Pool({ connectionString: url.toString(), max: 4 });
  // DROP DATABASE ... WITH (FORCE) at teardown kills any connection still closing; that is expected
  pool.on("error", () => {});
  const db = drizzle(pool, { schema }) as Db;
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, "../../lib/db/migrations"),
  });
  const client = new Client({ connectionString: url.toString() });
  client.on("error", () => {});
  await client.connect();
  return {
    db,
    client,
    url: url.toString(),
    async drop() {
      await client.end();
      await pool.end();
      await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.end();
    },
  };
}

/**
 * For test files that create a lot of tenant data (the binder tests seed hundreds of employees,
 * acknowledgments, reports): a throwaway migrated database that IS "the database" for this file
 * (DATABASE_URL + getDb()), so it neither pollutes the shared verify database — scripts/smoke.sh and
 * the whole-database anonymity scan in the whistleblower test read that one — nor is polluted by it.
 * Call before anything calls getDb(); call `drop()` in afterAll.
 */
export async function useScratchTestDb() {
  const scratch = await scratchDb();
  process.env.DATABASE_URL = scratch.url;
  const db = getDb();
  (globalThis as unknown as { __pool?: Pool }).__pool?.on("error", () => {});
  return {
    db,
    async drop() {
      await (globalThis as unknown as { __pool?: Pool }).__pool?.end();
      (globalThis as unknown as { __pool?: Pool; __db?: Db }).__db = undefined;
      (globalThis as unknown as { __pool?: Pool }).__pool = undefined;
      await scratch.drop();
    },
  };
}
