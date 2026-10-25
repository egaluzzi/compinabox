// migrate.mjs — applies the committed Drizzle migrations at deploy time, without drizzle-kit.
//
// Uses drizzle-orm's own runtime migrator, so it reads exactly the same journal and writes the same
// `drizzle.__drizzle_migrations` table as `npm run db:migrate` (the two can be mixed freely). The
// release tarball ships node_modules/drizzle-orm next to the standalone output for this script.
//
//   DATABASE_URL        required
//   MIGRATIONS_DIR      default: ../lib/db/migrations relative to this file
//
// Forward-only: there is no "down". Prints the number of migrations in the journal and the number
// that were applied; never prints the URL.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url || url === "changeme") {
  console.error("migrate: DATABASE_URL is not set");
  process.exit(1);
}
const folder =
  process.env.MIGRATIONS_DIR ||
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../lib/db/migrations",
  );
const journal = JSON.parse(
  readFileSync(path.join(folder, "meta/_journal.json"), "utf8"),
);

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const count = async () => {
    try {
      const r = await pool.query(
        'select count(*)::int as n from "drizzle"."__drizzle_migrations"',
      );
      return r.rows[0].n;
    } catch {
      return 0; // table not created yet
    }
  };
  const before = await count();
  await migrate(drizzle(pool), { migrationsFolder: folder });
  const after = await count();
  console.log(
    `migrate ok: ${journal.entries.length} in journal, ${after - before} applied now`,
  );
} catch (err) {
  console.error(
    `migrate failed (${err && err.code ? err.code : "error"}): ${err && err.message ? String(err.message).split("\n")[0] : ""}`,
  );
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
