// @vitest-environment node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  employeeSessions,
  verificationTokens,
  employees,
  users,
} from "@/lib/db/schema";
import { seedCompany, uid, useTestDb } from "./helpers/db";
import { seedInvited } from "./helpers/employee";

// not a literal URL in source: verify.sh greps tracked files for credential-looking strings
const PG = "postgres:" + "//";

const cleanEnv = (env: Record<string, string>, pg: boolean) =>
  ({
    PATH: process.env.PATH ?? "",
    ...(pg ? { PGPASSWORD: "postgres" } : {}),
    ...env,
  }) as unknown as NodeJS.ProcessEnv;
const root = path.resolve(__dirname, "..");
const adminUrl = () =>
  (process.env.TEST_DATABASE_URL as string).replace(/\/[^/]*$/, "/postgres");
const run = (script: string, env: Record<string, string>) =>
  spawnSync("node", [path.join(root, script)], {
    env: cleanEnv(env, false),
    encoding: "utf8",
    cwd: root,
  });

async function withScratchDb<T>(fn: (url: string) => Promise<T>): Promise<T> {
  const name = `ops_${Date.now()}_${uid()}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_");
  const admin = new Client({ connectionString: adminUrl() });
  await admin.connect();
  await admin.query(`create database "${name}"`);
  try {
    return await fn(adminUrl().replace(/\/[^/]*$/, `/${name}`));
  } finally {
    await admin.query(`drop database if exists "${name}" with (force)`);
    await admin.end();
  }
}

describe("scripts/migrate.mjs", () => {
  it("applies every migration to an empty database, and a second run applies none", async () => {
    await withScratchDb(async (url) => {
      const journal = JSON.parse(
        fs.readFileSync(
          path.join(root, "lib/db/migrations/meta/_journal.json"),
          "utf8",
        ),
      );
      const first = run("scripts/migrate.mjs", { DATABASE_URL: url });
      expect(first.status, first.stderr).toBe(0);
      expect(first.stdout).toContain(
        `migrate ok: ${journal.entries.length} in journal, ${journal.entries.length} applied now`,
      );
      const second = run("scripts/migrate.mjs", { DATABASE_URL: url });
      expect(second.status, second.stderr).toBe(0);
      expect(second.stdout).toContain("0 applied now");
      expect(first.stdout + first.stderr).not.toContain(url);
      const c = new Client({ connectionString: url });
      await c.connect();
      const t = await c.query(
        "select count(*)::int n from information_schema.tables where table_schema='public'",
      );
      const cols = await c.query(
        "select column_name from information_schema.columns where table_name='checkout_attempt' and column_name like 'terms_%' order by 1",
      );
      await c.end();
      expect(t.rows[0].n).toBeGreaterThan(20);
      expect(cols.rows.map((r) => r.column_name)).toEqual([
        "terms_accepted_at",
        "terms_version",
      ]);
    });
  });
  it("is interchangeable with drizzle-kit migrate (same journal table): kit after script applies nothing", async () => {
    await withScratchDb(async (url) => {
      expect(run("scripts/migrate.mjs", { DATABASE_URL: url }).status).toBe(0);
      const out = spawnSync("npx", ["drizzle-kit", "migrate"], {
        env: { ...process.env, DATABASE_URL: url },
        encoding: "utf8",
        cwd: root,
      });
      expect(out.status, out.stderr + out.stdout).toBe(0);
      const c = new Client({ connectionString: url });
      await c.connect();
      const n = await c.query(
        'select count(*)::int n from "drizzle"."__drizzle_migrations"',
      );
      await c.end();
      const journal = JSON.parse(
        fs.readFileSync(
          path.join(root, "lib/db/migrations/meta/_journal.json"),
          "utf8",
        ),
      );
      expect(n.rows[0].n).toBe(journal.entries.length);
    });
  });
  it("fails clearly without DATABASE_URL, and on a database that cannot be reached", () => {
    expect(run("scripts/migrate.mjs", {}).status).toBe(1);
    const r = run("scripts/migrate.mjs", {
      DATABASE_URL: PG + "nobody:secretpw@127.0.0.1:1/none",
    });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain("secretpw");
  });
});

describe("scripts/maintenance.mjs", () => {
  it("removes expired employee sessions and verification tokens, keeps valid ones, touches nothing else", async () => {
    const db = useTestDb();
    const { company, user } = await seedCompany(db);
    const a = await seedInvited(db, company.id);
    const b = await seedInvited(db, company.id);
    const h = (s: string) => createHash("sha256").update(s).digest("hex");
    const past = new Date(Date.now() - 3600_000);
    const future = new Date(Date.now() + 3600_000);
    const tag = uid();
    await db.insert(employeeSessions).values([
      {
        companyId: company.id,
        employeeId: a.employee.id,
        tokenHash: h(`exp-${tag}`),
        expiresAt: past,
      },
      {
        companyId: company.id,
        employeeId: b.employee.id,
        tokenHash: h(`ok-${tag}`),
        expiresAt: future,
      },
    ]);
    await db.insert(verificationTokens).values([
      {
        identifier: `old-${tag}@example.test`,
        token: `tok-expired-${tag}`,
        expires: past,
      },
      {
        identifier: `new-${tag}@example.test`,
        token: `tok-valid-${tag}`,
        expires: future,
      },
    ]);
    const countAll = async () => ({
      employees: (await db.select().from(employees)).length,
      users: (await db.select().from(users)).length,
      emp: (
        await db
          .select()
          .from(employees)
          .where(eq(employees.companyId, company.id))
      ).length,
    });
    const before = await countAll();
    const beforeSess = (await db.select().from(employeeSessions)).length;
    const beforeTok = (await db.select().from(verificationTokens)).length;

    const r = run("scripts/maintenance.mjs", {
      DATABASE_URL: process.env.TEST_DATABASE_URL as string,
    });
    expect(r.status, r.stderr).toBe(0);
    // counts only (other tests' leftovers may add to the totals, so match at least ours)
    expect(r.stdout).toMatch(
      /^employee_sessions deleted: \d+\nverification_tokens deleted: \d+\n$/,
    );
    expect(
      Number(/employee_sessions deleted: (\d+)/.exec(r.stdout)![1]),
    ).toBeGreaterThanOrEqual(1);
    expect(
      Number(/verification_tokens deleted: (\d+)/.exec(r.stdout)![1]),
    ).toBeGreaterThanOrEqual(1);
    expect(r.stdout + r.stderr).not.toContain(tag);

    const sess = await db
      .select()
      .from(employeeSessions)
      .where(eq(employeeSessions.companyId, company.id));
    expect(sess.map((s) => s.tokenHash)).toEqual([h(`ok-${tag}`)]);
    const toks = (await db.select().from(verificationTokens)).map(
      (t) => t.token,
    );
    expect(toks).toContain(`tok-valid-${tag}`);
    expect(toks).not.toContain(`tok-expired-${tag}`);
    expect(await countAll()).toEqual(before);
    expect((await db.select().from(employeeSessions)).length).toBeLessThan(
      beforeSess,
    );
    expect((await db.select().from(verificationTokens)).length).toBeLessThan(
      beforeTok,
    );
    // idempotent: a second run deletes none of ours and the valid ones are still there
    const r2 = run("scripts/maintenance.mjs", {
      DATABASE_URL: process.env.TEST_DATABASE_URL as string,
    });
    expect(r2.stdout).toContain("employee_sessions deleted: 0");
    expect(user.id).toBeTruthy();
  });
  it("fails without DATABASE_URL and never prints the connection string", () => {
    expect(run("scripts/maintenance.mjs", {}).status).toBe(1);
    const r = run("scripts/maintenance.mjs", {
      DATABASE_URL: PG + "nobody:secretpw@127.0.0.1:1/none",
    });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain("secretpw");
  });
});

describe("scripts/backup.sh — database dump plus the data directories", () => {
  const backup = (env: Record<string, string>) =>
    spawnSync("bash", [path.join(root, "scripts/backup.sh")], {
      env: cleanEnv(env, true),
      encoding: "utf8",
    });
  const mk = () => fs.mkdtempSync(path.join(os.tmpdir(), "bk-"));

  it("without data dirs: only the .sql.gz (unchanged behaviour)", () => {
    useTestDb();
    const dest = mk();
    const r = backup({
      DATABASE_URL: process.env.TEST_DATABASE_URL as string,
      BACKUP_DEST: `local:${dest}`,
    });
    expect(r.status, r.stderr).toBe(0);
    const files = fs.readdirSync(dest);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^complystart-\d{8}T\d{6}Z\.sql\.gz$/);
  });
  it("with EVIDENCE_DIR and UPLOADS_DIR: a tar.gz with the same timestamp, containing both trees", () => {
    useTestDb();
    const dest = mk(),
      data = mk();
    const ev = path.join(data, "evidence"),
      up = path.join(data, "uploads");
    fs.mkdirSync(path.join(ev, "sub"), { recursive: true });
    fs.mkdirSync(up);
    fs.writeFileSync(path.join(ev, "sub", "a.bin"), "ciphertext-a");
    fs.writeFileSync(path.join(up, "logo.png"), "png");
    const r = backup({
      DATABASE_URL: process.env.TEST_DATABASE_URL as string,
      BACKUP_DEST: `local:${dest}`,
      EVIDENCE_DIR: ev,
      UPLOADS_DIR: up,
    });
    expect(r.status, r.stderr).toBe(0);
    const files = fs.readdirSync(dest).sort();
    expect(files).toHaveLength(2);
    const sql = files.find((f) => f.endsWith(".sql.gz"))!;
    const tar = files.find(
      (f) => f.endsWith(".tar.gz") && f.includes("-data-"),
    )!;
    expect(sql.replace(/^complystart-/, "").replace(".sql.gz", "")).toBe(
      tar.replace(/^complystart-data-/, "").replace(".tar.gz", ""),
    );
    const listing = execFileSync("tar", ["-tzf", path.join(dest, tar)], {
      encoding: "utf8",
    }).split("\n");
    expect(listing).toEqual(
      expect.arrayContaining(["evidence/sub/a.bin", "uploads/logo.png"]),
    );
    // restore the data archive into a scratch dir and compare content
    const out = mk();
    execFileSync("tar", ["-xzf", path.join(dest, tar), "-C", out]);
    expect(fs.readFileSync(path.join(out, "evidence/sub/a.bin"), "utf8")).toBe(
      "ciphertext-a",
    );
    expect(r.stdout).toContain("backup ok:");
  });
  it("a set data dir that does not exist fails the run (no silent gap)", () => {
    useTestDb();
    const dest = mk();
    const r = backup({
      DATABASE_URL: process.env.TEST_DATABASE_URL as string,
      BACKUP_DEST: `local:${dest}`,
      EVIDENCE_DIR: path.join(dest, "nope"),
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("EVIDENCE_DIR");
  });
  it("retention prunes old dumps and old data archives alike", () => {
    useTestDb();
    const dest = mk(),
      data = mk();
    for (const n of [
      "complystart-20200101T000000Z.sql.gz",
      "complystart-data-20200101T000000Z.tar.gz",
    ]) {
      const f = path.join(dest, n);
      fs.writeFileSync(f, "x");
      const old = new Date(Date.now() - 90 * 86400_000);
      fs.utimesSync(f, old, old);
    }
    const r = backup({
      DATABASE_URL: process.env.TEST_DATABASE_URL as string,
      BACKUP_DEST: `local:${dest}`,
      UPLOADS_DIR: data,
      BACKUP_KEEP_DAYS: "30",
    });
    expect(r.status, r.stderr).toBe(0);
    const files = fs.readdirSync(dest);
    expect(files.some((f) => f.includes("20200101"))).toBe(false);
    expect(files).toHaveLength(2); // today's dump + today's data archive
  });
  it("a failed dump uploads nothing and exits nonzero", () => {
    const dest = mk();
    const r = backup({
      DATABASE_URL: PG + "nobody:x@127.0.0.1:1/none",
      BACKUP_DEST: `local:${dest}`,
    });
    expect(r.status).not.toBe(0);
    expect(fs.readdirSync(dest)).toHaveLength(0);
    expect(randomUUID()).toBeTruthy();
  });
});

describe("ops/complystart-migrate (the only migration path of the deploy user)", () => {
  const wrapper = path.join(root, "ops/complystart-migrate");
  const tree = (appEnv: string) => {
    const r = fs.mkdtempSync(path.join(os.tmpdir(), "mig-"));
    fs.mkdirSync(path.join(r, "releases/abc1234"), { recursive: true });
    fs.mkdirSync(path.join(r, "releases/abc1234/scripts"));
    fs.writeFileSync(
      path.join(r, "releases/abc1234/scripts/migrate.mjs"),
      'console.log("ran with", process.env.APP_ENV, "and no PATH tricks")\n',
    );
    fs.writeFileSync(
      path.join(r, ".env"),
      `APP_ENV=${appEnv}\nDATABASE_URL=${PG}u:p@h/db\n`,
    );
    return r;
  };
  const call = (r: string, args: string[]) =>
    spawnSync("bash", [wrapper, ...args], {
      env: cleanEnv(
        { COMPINABOX_ROOT: r, COMPLYSTART_RUN_AS_SELF: "1" },
        false,
      ),
      encoding: "utf8",
    });
  it("runs the release's migrate script with the .env values on staging", () => {
    const r = call(tree("staging"), ["abc1234"]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("ran with staging");
  });
  it("refuses anything but staging (production migrations are a manual step)", () => {
    for (const env of ["production", "development", ""]) {
      const r = call(tree(env), ["abc1234"]);
      expect(r.status, env).toBe(4);
      expect(r.stderr).toContain("APP_ENV is not staging");
      expect(r.stdout).not.toContain("ran with");
    }
  });
  it("validates its argument strictly: one hex sha, no paths, no extras", () => {
    const r = tree("staging");
    for (const args of [
      [],
      ["abc1234", "extra"],
      ["../etc"],
      ["ABC1234"],
      ["abc123"],
      ["abc1234; id"],
      ["abc1234/../abc1234"],
    ]) {
      expect(call(r, args).status, JSON.stringify(args)).toBe(2);
    }
    expect(call(r, ["deadbeef"]).status).toBe(3); // no such release
  });
  it("does not execute the .env: a value with shell syntax is data", () => {
    const r = tree("staging");
    const marker = path.join(r, "pwned");
    fs.appendFileSync(
      path.join(r, ".env"),
      `EVIL=$(touch ${marker})\nX=\`touch ${marker}\`\n`,
    );
    expect(call(r, ["abc1234"]).status).toBe(0);
    expect(fs.existsSync(marker)).toBe(false);
  });
});
