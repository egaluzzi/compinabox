// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as health } from "@/app/api/health/route";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { proxy } from "@/proxy";
import { useTestDb } from "./helpers/db";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("200 with ok, version, db, env — and nothing else", async () => {
    useTestDb();
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("APP_VERSION", "abc1234");
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({
      ok: true,
      version: "abc1234",
      db: true,
      env: "staging",
    });
  });
  it("503 and db:false when the database does not answer", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://nobody:nope@127.0.0.1:1/none");
    // a fresh pool is needed: drop the cached singleton
    const g = globalThis as unknown as {
      __db?: unknown;
      __pool?: { end(): Promise<void> };
    };
    const saved = { db: g.__db, pool: g.__pool };
    delete g.__db;
    const res = await health();
    g.__db = saved.db;
    g.__pool = saved.pool;
    expect(res.status).toBe(503);
    expect((await res.json()).db).toBe(false);
  });
  it("503 with violation CODES (no values) when production is misconfigured", async () => {
    useTestDb();
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("ALLOW_FAKE_PAYMENTS", "true");
    vi.stubEnv("AUTH_SECRET", "changeme-super-secret-value");
    const res = await health();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.violations).toEqual(
      expect.arrayContaining([
        "allow_fake_payments_set",
        "auth_secret_placeholder",
      ]),
    );
    expect(JSON.stringify(body)).not.toContain("changeme-super-secret-value");
  });
  it("a typo in APP_ENV reports env 'invalid'", async () => {
    useTestDb();
    vi.stubEnv("APP_ENV", "prod");
    const body = await (await health()).json();
    expect(body.env).toBe("invalid");
    expect(body.violations).toContain("app_env_invalid");
  });
});

describe("indexing: staging vs the rest", () => {
  it("staging: robots disallows everything, sitemap is empty", () => {
    vi.stubEnv("APP_ENV", "staging");
    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
    expect(sitemap()).toEqual([]);
  });
  it("development / production keep the normal robots and sitemap", () => {
    for (const v of ["", "development", "production"]) {
      vi.stubEnv("APP_ENV", v);
      expect(JSON.stringify(robots().rules)).toContain("/dashboard");
      expect(sitemap().length).toBeGreaterThan(0);
    }
  });
  it("staging: X-Robots-Tag on marketing, app and API paths; not elsewhere", () => {
    const get = (p: string) =>
      proxy(new NextRequest(`http://localhost:3000${p}`)).headers.get(
        "x-robots-tag",
      );
    vi.stubEnv("APP_ENV", "staging");
    for (const p of [
      "/",
      "/br",
      "/dashboard",
      "/api/health",
      "/legal/privacy",
      "/report/x",
      "/employee/x",
    ]) {
      expect(get(p), p).toBe("noindex, nofollow");
    }
    vi.stubEnv("APP_ENV", "production");
    expect(get("/br")).toBeNull();
    vi.stubEnv("APP_ENV", "");
    expect(get("/br")).toBeNull();
  });
});
