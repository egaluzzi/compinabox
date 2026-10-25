// @vitest-environment node
//
// ops/bootstrap-server.sh against a FAKE server: BOOTSTRAP_ROOT redirects every path it writes into a
// temp dir, and shims on PATH stand in for apt, systemd, ufw, useradd, PostgreSQL and friends (each
// keeps a little state in a directory, so "installed" things stay installed between runs).
// It proves the script's decisions — what it refuses, and that a second run changes nothing — not
// that apt/systemd behave as the shims do. That part only the real server can show.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const script = path.resolve(__dirname, "../ops/bootstrap-server.sh");
let root: string, bin: string, state: string;

const shim = (name: string, body: string) => {
  const f = path.join(bin, name);
  fs.writeFileSync(f, `#!/usr/bin/env bash\nS="${state}"\n${body}\n`, {
    mode: 0o755,
  });
};

function makeShims() {
  fs.mkdirSync(path.join(state, "pkg"), { recursive: true });
  fs.mkdirSync(path.join(state, "users"), { recursive: true });
  fs.mkdirSync(path.join(state, "units"), { recursive: true });
  fs.mkdirSync(path.join(state, "pg"), { recursive: true });
  shim("dpkg", '[ "$1" = "-s" ] && [ -e "$S/pkg/$2" ]');
  shim("apt-cache", 'echo "  Candidate: 1.0"');
  shim(
    "apt-get",
    `[ "$1" = update ] && exit 0
shift; for a in "$@"; do case "$a" in -*) ;; *) touch "$S/pkg/$a"
  if [ "$a" = nodejs ]; then printf '#!/bin/sh\\ncase \"$1\" in -p) echo 22;; *) echo v22.22.0;; esac\\n' > "${bin}/node"; chmod +x "${bin}/node"; fi
  if [ "$a" = caddy ]; then printf '#!/bin/sh\\nexit 0\\n' > "${bin}/caddy"; chmod +x "${bin}/caddy"; fi ;; esac; done`,
  );
  shim("curl", "echo FAKE-KEY");
  shim("pg_lsclusters", "true"); // no clusters unless a test says so
  shim(
    "gpg",
    'while [ $# -gt 0 ]; do [ "$1" = -o ] && { shift; cat > "$1"; }; shift; done',
  );
  shim("ss", 'cat "$S/ss.txt" 2>/dev/null; true');
  shim(
    "systemctl",
    `cmd=$1; shift
case "$cmd" in
  enable) [ "$1" = --now ] && shift; for u in "$@"; do touch "$S/units/$u.enabled"; done ;;
  is-enabled) [ -e "$S/units/$1.enabled" ] ;;
  is-active) [ -e "$S/units/$1.active" ] ;;
  start|restart) touch "$S/units/$1.active" ;;
  *) true ;;
esac`,
  );
  shim(
    "ufw",
    `case "$1" in
  status) if [ -e "$S/ufw.on" ]; then echo "Status: active"; cat "$S/ufw.rules" 2>/dev/null; else echo "Status: inactive"; fi ;;
  allow) echo "$2 ALLOW Anywhere" | sed 's#^#\\0#' >> "$S/ufw.rules" ;;
  --force) touch "$S/ufw.on" ;;
esac`,
  );
  shim("useradd", 'for a in "$@"; do last=$a; done; touch "$S/users/$last"');
  shim("passwd", "true");
  shim("chown", "true");
  shim("id", `if [ "$1" = -u ]; then echo 0; exit 0; fi; [ -e "$S/users/$1" ]`);
  shim("caddy", "exit 0");
  // postgres: role / database existence kept in state; SQL arrives as -c "..." or on stdin
  shim(
    "runuser",
    `shift 3   # -u postgres --
sql=""; while [ $# -gt 0 ]; do [ "$1" = -c ] && { sql=$2; shift; }; shift; done
[ -z "$sql" ] && sql=$(cat)
case "$sql" in
  *"from pg_roles"*) [ -e "$S/pg/role" ] && echo 1 ;;
  *"from pg_database"*) [ -e "$S/pg/db" ] && echo 1 ;;
  *"server_version_num"*) cat "$S/pg/version" 2>/dev/null || echo 160002 ;;
  "show port"*) echo 5432 ;;
  *"information_schema.tables"*) echo 0 ;;
  "create role"*) touch "$S/pg/role" ;;
  "alter role"*) true ;;
  "create database"*) touch "$S/pg/db" ;;
esac
exit 0`,
  );
}

const osRelease = (id = "ubuntu", ver = "24.04", codename = "noble") =>
  fs.writeFileSync(
    path.join(root, "etc/os-release"),
    `ID=${id}\nVERSION_ID="${ver}"\nVERSION_CODENAME=${codename}\nPRETTY_NAME="${id} ${ver}"\n`,
  );

const run = (args: string[], env: Record<string, string> = {}) =>
  spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    env: {
      PATH: `${bin}:/usr/sbin:/usr/bin:/sbin:/bin`,
      BOOTSTRAP_ROOT: root,
      BS_RAM_MB: "4096",
      BS_SKIP_PG_LOGIN_CHECK: "1",
      ...env,
    } as unknown as NodeJS.ProcessEnv,
  });

beforeEach(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-"));
  root = path.join(base, "root");
  bin = path.join(base, "bin");
  state = path.join(base, "state");
  for (const d of [path.join(root, "etc"), bin, state])
    fs.mkdirSync(d, { recursive: true });
  makeShims();
  osRelease();
});

const tree = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .map((e) => path.join(e.parentPath ?? "", e.name))
    : [];

describe("preflight: refuses what it does not understand, and changes nothing", () => {
  const before = () => tree(root).sort();
  it("an address is required and must look like one", () => {
    expect(run([]).status).toBe(2);
    expect(run(["a b; rm -rf /"]).status).toBe(2);
  });
  it("another OS", () => {
    osRelease("ubuntu", "20.04", "focal");
    const b = before();
    const r = run(["203.0.113.5"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("Ubuntu 22.04 and 24.04 only");
    expect(r.stdout).toContain("Nothing was changed");
    expect(before()).toEqual(b);
  });
  it("a different distribution", () => {
    osRelease("debian", "12", "bookworm");
    expect(run(["203.0.113.5"]).status).toBe(1);
  });
  it("port 80 held by something that is not Caddy", () => {
    fs.writeFileSync(
      path.join(state, "ss.txt"),
      'LISTEN 0 511 0.0.0.0:80 0.0.0.0:* users:(("nginx",pid=812,fd=6))\n',
    );
    const b = before();
    const r = run(["203.0.113.5"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(
      /port 80 is already in use by nginx.*not our Caddy/,
    );
    expect(before()).toEqual(b);
    expect(fs.existsSync(path.join(root, "opt/compinabox"))).toBe(false);
  });
  it("port 443 held by something else", () => {
    fs.writeFileSync(
      path.join(state, "ss.txt"),
      'LISTEN 0 511 *:443 *:* users:(("apache2",pid=9,fd=4))\n',
    );
    expect(run(["203.0.113.5"]).stdout).toContain("port 443 is already in use");
  });
  it("ports held by our own Caddy are fine", () => {
    fs.writeFileSync(
      path.join(state, "ss.txt"),
      'LISTEN 0 4096 *:80 *:* users:(("caddy",pid=1,fd=7))\nLISTEN 0 4096 *:443 *:* users:(("caddy",pid=1,fd=8))\n',
    );
    const r = run(["203.0.113.5", "--check"]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("ready: nothing found");
  });
  it("another Node major", () => {
    fs.writeFileSync(
      path.join(bin, "node"),
      '#!/bin/sh\ncase "$1" in -p) echo 18;; *) echo v18.19.0;; esac\n',
      {
        mode: 0o755,
      },
    );
    const r = run(["203.0.113.5"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Node\.js 18[.\d]* is installed/);
  });
  it("another PostgreSQL cluster", () => {
    fs.writeFileSync(
      path.join(bin, "pg_lsclusters"),
      "#!/bin/sh\necho '14 main 5432 online postgres /var/lib/postgresql/14/main /var/log/x.log'\n",
      { mode: 0o755 },
    );
    const r = run(["203.0.113.5"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("found an existing PostgreSQL");
  });
  it("a non-empty /opt/compinabox that is not ours", () => {
    fs.mkdirSync(path.join(root, "opt/compinabox"), { recursive: true });
    fs.writeFileSync(path.join(root, "opt/compinabox/something"), "x");
    const r = run(["203.0.113.5"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("was not created by this script");
  });
  it("--check on a clean fake server passes and writes nothing", () => {
    const b = before();
    const r = run(["203.0.113.5", "--check"]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("RAM / swap:    4096 MB");
    expect(before()).toEqual(b);
  });
  it("prints the RAM found and warns under 2 GB, with the heap limit bounded", () => {
    const small = run(["203.0.113.5", "--check"], { BS_RAM_MB: "1024" });
    expect(small.stdout).toContain("RAM / swap:    1024 MB");
    expect(small.stdout).toContain("Node heap limit chosen: 409 MB");
    expect(small.stdout).toContain("under 2 GB");
    const tiny = run(["203.0.113.5", "--check"], { BS_RAM_MB: "512" });
    expect(tiny.stdout).toContain("Node heap limit chosen: 384 MB");
  });
});

describe("a full run, then a second run", () => {
  const KEY =
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKeyForTestsOnly deploy@test";
  const env = { DEPLOY_PUBLIC_KEY: KEY };

  it("first run sets everything up; the second run changes nothing and says so", () => {
    const first = run(["203.0.113.5", "--yes"], env);
    expect(first.status, first.stdout + first.stderr).toBe(0);
    expect(first.stdout).toMatch(/\d+ change\(s\) made/);
    const p = (f: string) => path.join(root, f);
    for (const f of [
      "opt/compinabox/.env",
      "opt/compinabox/releases",
      "opt/compinabox/incoming",
      "opt/compinabox/data/uploads",
      "opt/compinabox/data/evidence",
      "opt/compinabox/backups",
      "etc/systemd/system/complystart.service",
      "etc/systemd/system/complystart.service.d/10-memory.conf",
      "etc/systemd/system/complystart-backup.timer",
      "etc/systemd/system/complystart-maintenance.timer",
      "etc/caddy/Caddyfile",
      "etc/sudoers.d/complystart-deploy",
      "usr/local/sbin/complystart-migrate",
      "etc/postgresql/16/main/conf.d/90-complystart.conf",
    ])
      expect(fs.existsSync(p(f)), f).toBe(true);

    // .env: mode 600, staging, random secrets (distinct, no placeholder), the address
    const envFile = fs.readFileSync(p("opt/compinabox/.env"), "utf8");
    expect(fs.statSync(p("opt/compinabox/.env")).mode & 0o777).toBe(0o600);
    expect(envFile).toContain("APP_ENV=staging");
    expect(envFile).toContain("PORT=3100");
    expect(envFile).toContain("HOSTNAME=127.0.0.1");
    expect(envFile).toContain("APP_URL=https://203.0.113.5");
    expect(envFile).toContain("ALLOW_FAKE_PAYMENTS=true");
    expect(envFile).toContain("BINDER_CONCURRENCY=1");
    expect(envFile).not.toMatch(/changeme/i);
    const val = (k: string) =>
      new RegExp(`^${k}=(.+)$`, "m").exec(envFile)?.[1] ?? "";
    for (const k of [
      "AUTH_SECRET",
      "FAKE_PAYMENTS_SECRET",
      "DEV_OUTBOX_PASSWORD",
      "REPORT_ENCRYPTION_KEYS",
    ]) {
      expect(val(k).length, k).toBeGreaterThan(15);
    }
    expect(
      new Set(
        ["AUTH_SECRET", "FAKE_PAYMENTS_SECRET", "DEV_OUTBOX_PASSWORD"].map(val),
      ).size,
    ).toBe(3);
    // the outbox password is printed once, and no OTHER secret is
    expect(first.stdout).toContain(`password: ${val("DEV_OUTBOX_PASSWORD")}`);
    for (const k of [
      "AUTH_SECRET",
      "FAKE_PAYMENTS_SECRET",
      "REPORT_ENCRYPTION_KEYS",
    ])
      expect(first.stdout).not.toContain(val(k));
    expect(first.stdout + first.stderr).not.toContain(
      /:([0-9a-f]{48})@/.exec(val("DATABASE_URL"))![1],
    );

    expect(
      fs.readFileSync(
        p("etc/systemd/system/complystart.service.d/10-memory.conf"),
        "utf8",
      ),
    ).toContain("--max-old-space-size=1536");
    expect(fs.readFileSync(p("etc/caddy/Caddyfile"), "utf8")).toContain(
      "https://203.0.113.5 {",
    );
    expect(fs.readFileSync(p("etc/caddy/Caddyfile"), "utf8")).toContain(
      "reverse_proxy 127.0.0.1:3100",
    );
    expect(fs.readFileSync(p("etc/caddy/Caddyfile"), "utf8")).not.toContain(
      "__",
    );
    expect(
      fs.readFileSync(
        p("home/complystart-deploy/.ssh/authorized_keys"),
        "utf8",
      ),
    ).toContain(
      `no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ${KEY}`,
    );
    expect(fs.readFileSync(path.join(state, "ufw.rules"), "utf8")).toMatch(
      /22\/tcp/,
    );

    const snapshot = (d: string) =>
      Object.fromEntries(
        tree(d)
          .filter((f) => fs.statSync(f).isFile())
          .sort()
          .map((f) => [f, fs.readFileSync(f, "utf8")]),
      );
    const treeBefore = snapshot(root);
    const second = run(["203.0.113.5", "--yes"], env);
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(second.stdout).toContain(
      "no changes: this server was already set up.",
    );
    expect(second.stdout).not.toContain("CHANGED");
    expect(second.stdout).not.toContain("password:");
    expect(snapshot(root)).toEqual(treeBefore); // not a byte differs, including .env
  });

  it("an existing .env is never regenerated, even if other things are missing", () => {
    run(["203.0.113.5", "--yes"], env);
    const envPath = path.join(root, "opt/compinabox/.env");
    const original = fs.readFileSync(envPath, "utf8");
    fs.rmSync(path.join(root, "etc/caddy/Caddyfile"));
    fs.rmSync(path.join(root, "etc/systemd/system/complystart.service"));
    const again = run(["203.0.113.5", "--yes"], env);
    expect(again.status, again.stdout + again.stderr).toBe(0);
    expect(again.stdout).toContain("CHANGED");
    expect(again.stdout).toContain("etc/caddy/Caddyfile");
    expect(fs.readFileSync(envPath, "utf8")).toBe(original);
    expect(again.stdout).not.toContain("password:");
  });

  it("a malformed deploy key is rejected before anything is trusted", () => {
    const r = run(["203.0.113.5", "--yes"], {
      DEPLOY_PUBLIC_KEY: 'ssh-ed25519 AAAA\ncommand="rm -rf /" ssh-rsa BBBB',
    });
    expect(r.status).toBe(1);
    expect(r.stderr + r.stdout).toContain(
      "does not look like a single public key line",
    );
  });
});

const KEY2 =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFakeKeyForTestsOnly deploy@test";
const ssFile = (lines: string) =>
  fs.writeFileSync(path.join(state, "ss.txt"), lines);
const L = (addr: string, proc: string) =>
  `LISTEN 0 511 ${addr} 0.0.0.0:* users:(("${proc}",pid=7,fd=3))\n`;

describe("supervisor update: a server that is not clean", () => {
  it("without --yes it reports and changes nothing (exit 3)", () => {
    const b = tree(root).sort();
    const r = run(["203.0.113.5"]);
    expect(r.status).toBe(3);
    expect(r.stdout).toContain("What I found");
    expect(r.stdout).toContain("changes need --yes");
    expect(tree(root).sort()).toEqual(b);
  });
  it("Ubuntu 25.04 is refused with the end-of-life explanation", () => {
    osRelease("ubuntu", "25.04", "plucky");
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/past end of life.*24\.04 LTS/);
  });
  it("the report lists every listener with its owner, services, RAM and the verdict", () => {
    ssFile(
      L("0.0.0.0:80", "nginx") +
        L("0.0.0.0:3000", "node") +
        L("0.0.0.0:5432", "postgres") +
        L("0.0.0.0:22", "sshd"),
    );
    const r = run(["203.0.113.5", "--check"]);
    expect(r.stdout).toMatch(/0\.0\.0\.0:80 -> nginx/);
    expect(r.stdout).toMatch(/0\.0\.0\.0:3000 -> node/);
    expect(r.stdout).toMatch(/0\.0\.0\.0:5432 -> postgres/);
    expect(r.stdout).toContain(
      "WARNING: a PostgreSQL is listening on a PUBLIC address",
    );
    expect(r.stdout).toContain("services:");
    expect(r.stdout).toContain("NOT READY");
    expect(r.status).toBe(1);
  });
  it("a public port held by another service: abort, name the owner, print a rerun with another port", () => {
    ssFile(L("0.0.0.0:443", "nginx"));
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/port 443 is already in use by nginx/);
    expect(r.stdout).toContain("--https-port 8443");
    expect(fs.existsSync(path.join(root, "opt/compinabox"))).toBe(false);
  });
  it("the app port defaults to the first free port from 3100 and never 3000 or 8080", () => {
    ssFile(
      L("0.0.0.0:3000", "node") +
        L("0.0.0.0:3100", "node") +
        L("0.0.0.0:8080", "java"),
    );
    const r = run(["203.0.113.5", "--check"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("app 127.0.0.1:3101");
  });
  it("--app-port 3000 / 8080 / a port in use / a privileged port are refused", () => {
    for (const p of ["3000", "8080", "443"]) {
      const r = run(["203.0.113.5", "--check", "--app-port", p]);
      expect(r.status, p).toBe(1);
    }
    ssFile(L("127.0.0.1:3300", "python3"));
    expect(
      run(["203.0.113.5", "--check", "--app-port", "3300"]).stdout,
    ).toContain("already in use");
    expect(run(["203.0.113.5", "--check", "--app-port", "abc"]).status).toBe(2);
    expect(
      run(["203.0.113.5", "--check", "--http-port", "81", "--no-http"]).status,
    ).toBe(2);
  });
  it("non-default ports end up in the Caddyfile, .env, app-port file and firewall; a re-run without flags reuses them and changes nothing", () => {
    const args = [
      "203.0.113.5",
      "--yes",
      "--https-port",
      "8443",
      "--no-http",
      "--app-port",
      "3205",
    ];
    const first = run(args, { DEPLOY_PUBLIC_KEY: KEY2 });
    expect(first.status, first.stdout + first.stderr).toBe(0);
    const p = (f: string) => path.join(root, f);
    const caddy = fs.readFileSync(p("etc/caddy/Caddyfile"), "utf8");
    expect(caddy).toContain("https_port 8443");
    expect(caddy).toContain("auto_https disable_redirects");
    expect(caddy).not.toContain("http_port");
    expect(caddy).toContain("https://203.0.113.5:8443 {");
    expect(caddy).toContain("reverse_proxy 127.0.0.1:3205");
    expect(caddy).not.toContain("__");
    expect(caddy).toContain("managed-by: complystart-bootstrap");
    const envFile = fs.readFileSync(p("opt/compinabox/.env"), "utf8");
    expect(envFile).toContain("APP_URL=https://203.0.113.5:8443");
    expect(envFile).toContain("AUTH_URL=https://203.0.113.5:8443");
    expect(envFile).toContain("PORT=3205");
    expect(fs.readFileSync(p("opt/compinabox/app-port"), "utf8").trim()).toBe(
      "3205",
    );
    const rules = fs.readFileSync(path.join(state, "ufw.rules"), "utf8");
    expect(rules).toMatch(/8443\/tcp/);
    expect(rules).not.toMatch(/(^|\n)(80|443)\/tcp/);
    expect(first.stdout).toContain(
      "DEPLOY_BASE_URL = https://203.0.113.5:8443",
    );
    const second = run(["203.0.113.5", "--yes"], { DEPLOY_PUBLIC_KEY: KEY2 });
    expect(second.status, second.stdout + second.stderr).toBe(0);
    expect(second.stdout).toContain(
      "no changes: this server was already set up.",
    );
  });
  it("default ports with http on: nothing extra in the Caddyfile global block", () => {
    run(["203.0.113.5", "--yes"], { DEPLOY_PUBLIC_KEY: KEY2 });
    const caddy = fs.readFileSync(
      path.join(root, "etc/caddy/Caddyfile"),
      "utf8",
    );
    expect(caddy).not.toMatch(/https_port|http_port|disable_redirects/);
    expect(caddy).toContain("https://203.0.113.5 {");
  });
  it("a custom http port is configured", () => {
    run([
      "203.0.113.5",
      "--yes",
      "--http-port",
      "8081",
      "--https-port",
      "8443",
    ]);
    const caddy = fs.readFileSync(
      path.join(root, "etc/caddy/Caddyfile"),
      "utf8",
    );
    expect(caddy).toContain("http_port 8081");
    expect(caddy).toContain("https_port 8443");
  });
  it("an existing PostgreSQL: abort by default", () => {
    ssFile(L("0.0.0.0:5432", "postgres"));
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("found an existing PostgreSQL");
    expect(r.stdout).toContain("--use-existing-postgres");
    expect(fs.existsSync(path.join(root, "opt/compinabox"))).toBe(false);
  });
  it("--use-existing-postgres: only our role and database, no package, no config file; remembered on re-run", () => {
    ssFile(L("0.0.0.0:5432", "postgres"));
    const r = run(["203.0.113.5", "--yes", "--use-existing-postgres"], {
      DEPLOY_PUBLIC_KEY: KEY2,
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(fs.existsSync(path.join(state, "pkg/postgresql-16"))).toBe(false);
    expect(fs.existsSync(path.join(root, "etc/postgresql"))).toBe(false);
    expect(fs.existsSync(path.join(state, "pg/role"))).toBe(true);
    expect(fs.existsSync(path.join(state, "pg/db"))).toBe(true);
    expect(
      fs.readFileSync(
        path.join(root, "opt/compinabox/.compinabox-bootstrap"),
        "utf8",
      ),
    ).toContain("postgres=existing");
    expect(
      fs.readFileSync(path.join(root, "opt/compinabox/.env"), "utf8"),
    ).toMatch(
      /DATABASE_URL=postgres:\/\/complystart:[0-9a-f]+@127\.0\.0\.1:5432\/complystart/,
    );
    expect(r.stdout).toMatch(/using the existing cluster/);
    const again = run(["203.0.113.5", "--yes"], { DEPLOY_PUBLIC_KEY: KEY2 });
    expect(again.status, again.stdout).toBe(0);
    expect(again.stdout).toContain(
      "no changes: this server was already set up.",
    );
  });
  it("--use-existing-postgres needs version 15 or newer", () => {
    ssFile(L("0.0.0.0:5432", "postgres"));
    fs.writeFileSync(path.join(state, "pg/version"), "140005");
    const r = run(["203.0.113.5", "--yes", "--use-existing-postgres"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("needs 15 or newer");
  });
  it("ufw inactive while other services listen: not enabled, warned", () => {
    ssFile(L("0.0.0.0:9000", "someapp") + L("0.0.0.0:22", "sshd"));
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(r.stdout).toContain("did NOT enable it");
    expect(fs.existsSync(path.join(state, "ufw.on"))).toBe(false);
    expect(fs.existsSync(path.join(state, "ufw.rules"))).toBe(false);
  });
  it("ufw active: only our rules are added, and it stays active", () => {
    fs.writeFileSync(path.join(state, "ufw.on"), "");
    fs.writeFileSync(
      path.join(state, "ufw.rules"),
      "22/tcp ALLOW Anywhere\n9000/tcp ALLOW Anywhere\n",
    );
    ssFile(L("0.0.0.0:9000", "someapp") + L("0.0.0.0:22", "sshd"));
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const rules = fs.readFileSync(path.join(state, "ufw.rules"), "utf8");
    expect(rules).toContain("9000/tcp");
    expect(rules).toMatch(/80\/tcp/);
    expect(rules).toMatch(/443\/tcp/);
  });
  it("an existing Caddy configuration that is not ours is never replaced; the stock one may be", () => {
    fs.mkdirSync(path.join(root, "etc/caddy"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "etc/caddy/Caddyfile"),
      "example.com {\n\treverse_proxy 127.0.0.1:9\n}\n",
    );
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("existing Caddy configuration");
    expect(
      fs.readFileSync(path.join(root, "etc/caddy/Caddyfile"), "utf8"),
    ).toContain("example.com");
    fs.writeFileSync(
      path.join(root, "etc/caddy/Caddyfile"),
      ":80 {\n\troot * /usr/share/caddy\n\tfile_server\n}\n",
    );
    expect(run(["203.0.113.5", "--check"]).status).toBe(0);
  });
  it("Caddy is installed without being started on its stock port (policy-rc.d is removed afterwards)", () => {
    const r = run(["203.0.113.5", "--yes"]);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(fs.existsSync(path.join(root, "usr/sbin/policy-rc.d"))).toBe(false);
  });
});
