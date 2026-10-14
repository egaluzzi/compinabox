import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __pool?: Pool; __db?: Db };

/** Lazy singleton so importing this module (e.g. at build time) never needs a database. */
export function getDb(): Db {
  if (!g.__db) {
    const url = process.env.DATABASE_URL;
    if (!url || url === "changeme") throw new Error("DATABASE_URL is not set");
    g.__pool = new Pool({ connectionString: url, max: 10 });
    g.__db = drizzle(g.__pool, { schema });
  }
  return g.__db;
}

export { schema };
