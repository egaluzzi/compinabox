// Re-encrypts all whistleblower data under the first key in REPORT_ENCRYPTION_KEYS.
//   npm run rotate-report-key             dry run: counts only
//   npm run rotate-report-key -- --apply  write
// Needs DATABASE_URL, REPORT_ENCRYPTION_KEYS (new key FIRST, old key(s) after it) and
// EVIDENCE_DIR. Prints counts only, never content. README: "Report encryption key".
import pg from "pg";
import { rotate } from "../lib/whistleblower/rotate.ts";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write("DATABASE_URL is not set\n");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const c = await rotate(client, { apply });
  process.stdout.write(
    `${apply ? "APPLIED" : "DRY RUN (nothing written; pass --apply)"}\n` +
      `seen: reports=${c.seen.reports} notes=${c.seen.notes} disclosures=${c.seen.disclosures} evidence=${c.seen.evidence}\n` +
      `already under the current key: ${c.current}\n` +
      `${apply ? "re-encrypted" : "would re-encrypt"}: ${c.rewritten}\n` +
      `could not decrypt (left untouched): ${c.failed}\n`,
  );
  if (c.failed > 0) process.exitCode = 2;
} finally {
  await client.end();
}
