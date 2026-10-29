// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/reconcile-payments/route";
import { reconcileToken } from "@/lib/payments/reconcile";

const SECRET = "wh-secret-for-tests-only";
const req = (auth?: string) =>
  new Request("http://localhost/api/internal/reconcile-payments", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });

describe("POST /api/internal/reconcile-payments", () => {
  it("404 unless mercadopago is configured AND the bearer is right", async () => {
    vi.stubEnv("PAYMENT_PROVIDER", "none");
    expect((await POST(req(`Bearer ${reconcileToken(SECRET)}`))).status).toBe(
      404,
    );
    vi.stubEnv("PAYMENT_PROVIDER", "mercadopago");
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "t".repeat(20));
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
    expect((await POST(req())).status).toBe(404);
    expect((await POST(req("Bearer nope"))).status).toBe(404);
  });
});

describe("scripts/reconcile-payments.mjs", () => {
  const run = (env: Record<string, string>) =>
    spawnSync(
      "node",
      [path.resolve(__dirname, "../scripts/reconcile-payments.mjs")],
      {
        env: {
          PATH: process.env.PATH ?? "",
          ...env,
        } as unknown as NodeJS.ProcessEnv,
        encoding: "utf8",
      },
    );
  it("does nothing, successfully, when the provider is not mercadopago", () => {
    const r = run({ PAYMENT_PROVIDER: "fake" });
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/nothing to do/);
  });
  it("fails without a webhook secret, and never prints it", () => {
    const r = run({
      PAYMENT_PROVIDER: "mercadopago",
      MERCADOPAGO_WEBHOOK_SECRET: "changeme",
    });
    expect(r.status).toBe(1);
  });
  it("an unreachable app is a failure that prints no secret", () => {
    const r = run({
      PAYMENT_PROVIDER: "mercadopago",
      MERCADOPAGO_WEBHOOK_SECRET: SECRET,
      PORT: "1",
    });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).not.toContain(SECRET);
  });
});
