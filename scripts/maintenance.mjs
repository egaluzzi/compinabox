// maintenance.mjs — the daily clean-up (systemd timer complystart-maintenance.timer).
//
// Deletes ONLY: employee portal sessions past their expiry, and expired verification tokens
// (sign-in / welcome links). Prints counts and nothing else — no ids, e-mails or token values.
// Needs only `pg` (present in the standalone build) and DATABASE_URL.
//
//   node scripts/maintenance.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url || url === "changeme") {
  console.error("maintenance: DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
try {
  await client.connect();
  const sessions = await client.query(
    "delete from employee_sessions where expires_at < now()",
  );
  const tokens = await client.query(
    "delete from verification_tokens where expires < now()",
  );
  console.log(`employee_sessions deleted: ${sessions.rowCount ?? 0}`);
  console.log(`verification_tokens deleted: ${tokens.rowCount ?? 0}`);
} catch (err) {
  // The message of a pg error can quote SQL or connection details: print only the error code.
  console.error(`maintenance failed (${err && err.code ? err.code : "error"})`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
