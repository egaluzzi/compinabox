// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/waitlist/route";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("POST /api/waitlist", () => {
  it("accepts a valid email and logs exactly one line with email, country, timestamp", async () => {
    const res = await post({ email: "ana@example.com", country: "ar" });
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(log.mock.calls[0][0] as string);
    expect(Object.keys(entry).sort()).toEqual([
      "at",
      "country",
      "email",
      "event",
    ]);
    expect(entry).toMatchObject({ email: "ana@example.com", country: "ar" });
    expect(new Date(entry.at).toString()).not.toBe("Invalid Date");
  });

  it.each(["", "nope", "a@b", "a b@c.de", 42, null])(
    "rejects bad email %j",
    async (email) => {
      const res = await post({ email });
      expect(res.status).toBe(422);
      expect(log).not.toHaveBeenCalled();
    },
  );

  it("silently drops honeypot hits", async () => {
    const res = await post({
      email: "bot@example.com",
      website: "http://spam",
    });
    expect(res.status).toBe(200);
    expect(log).not.toHaveBeenCalled();
  });

  it("rejects malformed bodies", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post("null")).status).toBe(400);
  });

  it("logs no IP, user-agent or header values", async () => {
    await post(
      { email: "ana@example.com", country: "br" },
      {
        "x-forwarded-for": "203.0.113.9",
        "cf-connecting-ip": "203.0.113.10",
        "user-agent": "SecretAgent/1.0",
        cookie: "session=abc",
      },
    );
    const line = String(log.mock.calls[0][0]);
    for (const leaked of ["203.0.113", "SecretAgent", "session=abc"])
      expect(line).not.toContain(leaked);
  });

  it("strips control characters from the country so a log line stays one line", async () => {
    await post({ email: "ana@example.com", country: "Peru\nFAKE LOG LINE\r" });
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0][0])).not.toMatch(/[\r\n]/);
  });
});
