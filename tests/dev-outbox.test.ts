// @vitest-environment node
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/dev-outbox/route";
import { FileSink } from "@/lib/email";
import { linkify, listOutbox, resetOutboxLimiter } from "@/lib/email/outbox";

const PASSWORD = "correct horse battery staple";
const basic = (user: string, pass: string) =>
  `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
const call = (auth?: string) =>
  GET(
    new Request("http://localhost/dev-outbox", {
      headers: auth ? { authorization: auth } : {},
    }),
  );

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "outbox-"));
  resetOutboxLimiter();
  vi.stubEnv("EMAIL_SINK_DIR", dir);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

const enable = () => {
  vi.stubEnv("APP_ENV", "staging");
  vi.stubEnv("EMAIL_DEV_SINK", "true");
  vi.stubEnv("DEV_OUTBOX_PASSWORD", PASSWORD);
};

describe("the 404 matrix: only staging + sink + password opens the route", () => {
  const envs = ["", "development", "staging", "production", "prod"];
  const sinks = ["true", "false", ""];
  const passwords = [PASSWORD, ""];
  for (const appEnv of envs)
    for (const sink of sinks)
      for (const pw of passwords) {
        const open = appEnv === "staging" && sink === "true" && pw !== "";
        it(`APP_ENV='${appEnv}' EMAIL_DEV_SINK='${sink}' password ${pw ? "set" : "unset"} -> ${open ? "401 without credentials" : "404 even with the right credentials"}`, async () => {
          vi.stubEnv("APP_ENV", appEnv);
          vi.stubEnv("EMAIL_DEV_SINK", sink);
          vi.stubEnv("DEV_OUTBOX_PASSWORD", pw);
          const res = await call(open ? undefined : basic("outbox", PASSWORD));
          expect(res.status).toBe(open ? 401 : 404);
          if (!open) expect(await res.text()).not.toContain("Dev outbox");
        });
      }
});

describe("Basic auth", () => {
  it("401 without credentials, with a challenge and no-store/noindex", async () => {
    enable();
    const res = await call();
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
  it("401 for a wrong password, a wrong user, malformed headers, other schemes", async () => {
    enable();
    for (const h of [
      basic("outbox", "nope"),
      basic("admin", PASSWORD),
      basic("outbox", PASSWORD + "x"),
      "Basic !!!notbase64",
      "Basic " + Buffer.from("nocolon").toString("base64"),
      "Bearer " + PASSWORD,
    ]) {
      expect((await call(h)).status, h).toBe(401);
    }
  });
  it("200 with the right credentials; headers are safe", async () => {
    enable();
    const res = await call(basic("outbox", PASSWORD));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(await res.text()).toContain("No messages yet");
  });
  it("a password containing a colon works (split at the first colon)", async () => {
    enable();
    vi.stubEnv("DEV_OUTBOX_PASSWORD", "a:b:c");
    expect((await call(basic("outbox", "a:b:c"))).status).toBe(200);
  });
  it("after 10 failed attempts everything is 429 (even the right password) until the window passes", async () => {
    enable();
    for (let i = 0; i < 10; i++)
      expect((await call(basic("outbox", "bad"))).status).toBe(401);
    const res = await call(basic("outbox", PASSWORD));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    resetOutboxLimiter();
    expect((await call(basic("outbox", PASSWORD))).status).toBe(200);
  });
});

describe("what it lists", () => {
  it("shows what the real FileSink wrote: newest first, links clickable, everything escaped", async () => {
    enable();
    const sink = new FileSink(dir);
    await sink.send({ to: "a@example.test", subject: "First", text: "hello" });
    await new Promise((r) => setTimeout(r, 5));
    await sink.send({
      to: "b@example.test",
      subject: "<script>alert(1)</script>",
      text: 'Click https://staging.test/api/welcome?token=abc123&x=1. "<img src=x onerror=alert(2)>"',
    });
    const html = await (await call(basic("outbox", PASSWORD))).text();
    expect(html.indexOf("&lt;script&gt;")).toBeLessThan(html.indexOf("First"));
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x onerror=alert(2)&gt;");
    expect(html).toContain(
      '<a href="https://staging.test/api/welcome?token=abc123&amp;x=1" rel="noopener noreferrer">https://staging.test/api/welcome?token=abc123&amp;x=1</a>.',
    );
    expect(html).toContain("To: b@example.test");
  });
  it("lists at most 50 messages", async () => {
    enable();
    for (let i = 0; i < 55; i++) {
      const name = `${1700000000000 + i}-${randomUUID()}.json`;
      await writeFile(
        path.join(dir, name),
        JSON.stringify({ to: "x@example.test", subject: `m${i}`, text: "t" }),
      );
    }
    const list = await listOutbox(dir);
    expect(list).toHaveLength(50);
    expect(list[0].subject).toBe("m54");
    expect(list[49].subject).toBe("m5");
  });
  it("ignores anything that is not a sink file: other names, subdirectories, symlinks, malformed JSON", async () => {
    enable();
    const outside = await mkdtemp(path.join(tmpdir(), "outside-"));
    await writeFile(
      path.join(outside, "secret.json"),
      JSON.stringify({ to: "x", subject: "OUTSIDE-SECRET", text: "t" }),
    );
    const good = `${Date.now()}-${randomUUID()}.json`;
    await writeFile(
      path.join(dir, good),
      JSON.stringify({ to: "ok@example.test", subject: "GOOD", text: "t" }),
    );
    await writeFile(
      path.join(dir, "notes.json"),
      JSON.stringify({ to: "x", subject: "WRONGNAME", text: "t" }),
    );
    await writeFile(
      path.join(dir, `${Date.now()}-${randomUUID()}.json.bak`),
      "{}",
    );
    await mkdir(path.join(dir, `${Date.now()}-${randomUUID()}.json`));
    await symlink(
      path.join(outside, "secret.json"),
      path.join(dir, `${Date.now() + 1}-${randomUUID()}.json`),
    );
    await writeFile(
      path.join(dir, `${Date.now() + 2}-${randomUUID()}.json`),
      "{not json",
    );
    const html = await (await call(basic("outbox", PASSWORD))).text();
    expect(html).toContain("GOOD");
    expect(html).not.toContain("WRONGNAME");
    expect(html).not.toContain("OUTSIDE-SECRET");
    await rm(outside, { recursive: true, force: true });
  });
  it("a missing sink directory is an empty list, not an error", async () => {
    expect(await listOutbox(path.join(dir, "does-not-exist"))).toEqual([]);
  });
});

describe("linkify", () => {
  it("anchors http(s) URLs only; other schemes stay inert escaped text", () => {
    expect(linkify("see javascript:alert(1) and https://a.test/x?y=1)")).toBe(
      'see javascript:alert(1) and <a href="https://a.test/x?y=1" rel="noopener noreferrer">https://a.test/x?y=1</a>)',
    );
  });
});
