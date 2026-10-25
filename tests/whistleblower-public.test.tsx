// @vitest-environment node
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { companies } from "@/lib/db/schema";
import nextConfig from "@/next.config";
import { seedCompany, uid, useTestDb } from "./helpers/db";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

let db: ReturnType<typeof useTestDb>;
beforeAll(() => {
  db = useTestDb();
});

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });
async function render(slug: string, page: "page" | "status/page") {
  const Layout = (await import("@/app/report/[slug]/layout")).default;
  const Page = (await import(/* @vite-ignore */ `@/app/report/[slug]/${page}`))
    .default;
  const body = await Page(params(slug));
  return renderToStaticMarkup(
    await Layout({ children: body, params: Promise.resolve({ slug }) }),
  );
}
async function company(country: string, name: string, logoFile?: string) {
  const s = await seedCompany(db, `pub-${uid()}`);
  await db
    .update(companies)
    .set({ country, name, logoFile: logoFile ?? null })
    .where(eq(companies.id, s.company.id));
  return s.company.slug;
}

describe("public report page", () => {
  it("is branded, in the company's country language, with the CONTENT.md form fields", async () => {
    const slug = await company(
      "br",
      "Padaria Útil Ltda",
      "0123456789abcdef0123456789abcdef.png",
    );
    const html = await render(slug, "page");
    expect(html).toContain('<html lang="pt-BR"');
    expect(html).toContain("Canal de denúncias de Padaria Útil Ltda");
    expect(html).toContain("Padaria Útil Ltda"); // intro
    expect(html).toContain(
      'src="/uploads/0123456789abcdef0123456789abcdef.png"',
    );
    for (const name of [
      "category",
      "description",
      "evidence",
      "wantsContact",
      "website",
    ])
      expect(html, name).toContain(`name="${name}"`);
    for (const key of [
      "corruption_bribery",
      "conflict_of_interest",
      "fraud",
      "harassment",
      "other",
    ])
      expect(html, key).toContain(`value="${key}"`);
    expect(html).toContain('accept="image/png,image/jpeg"');
    // honeypot is hidden from people and from assistive tech
    expect(html).toMatch(
      /aria-hidden="true"[^>]*><input[^>]*tabindex="-1"[^>]*name="website"/,
    );
    // labels are real <label> elements
    expect(html.match(/<label/g)!.length).toBeGreaterThanOrEqual(3);
  });

  it("es-AR / es-MX / en by company country; unknown slug is a 404", async () => {
    expect(
      await render(await company("ar", "Almacén Sur SA"), "page"),
    ).toContain("Canal de denuncias de Almacén Sur SA");
    expect(
      await render(await company("mx", "Tienda Norte SA"), "page"),
    ).toContain('<html lang="es-MX"');
    await expect(render("does-not-exist", "page")).rejects.toThrow("NOT_FOUND");
    await expect(render("does-not-exist", "status/page")).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("ships no cookie banner, no analytics, no third-party URL, no tracking", async () => {
    const slug = await company("br", "Limpa Ltda");
    for (const page of ["page", "status/page"] as const) {
      const html = await render(slug, page);
      expect(html).not.toMatch(
        /consent|cookie|gtm|googletagmanager|analytics|utm_/i,
      );
      expect(html).not.toMatch(/https?:\/\//); // no absolute URL at all: nothing third-party
    }
  });

  it("the page metadata says noindex, nofollow and no-referrer; the status page too", async () => {
    const slug = await company("br", "Meta Ltda");
    for (const mod of ["page", "status/page"]) {
      const { generateMetadata } = await import(
        /* @vite-ignore */ `@/app/report/[slug]/${mod}`
      );
      const meta = await generateMetadata(params(slug));
      expect(meta.robots).toEqual({ index: false, follow: false });
      expect(meta.referrer).toBe("no-referrer");
      expect(meta.title).toContain("Meta Ltda");
    }
  });

  it("the status page has the code form and links back", async () => {
    const slug = await company("br", "Status Ltda");
    const html = await render(slug, "status/page");
    expect(html).toContain('name="code"');
    expect(html).toContain("Código de acompanhamento");
    expect(html).toContain(`href="/report/${slug}"`);
  });
});

describe("response headers (next.config) for the public channel", () => {
  it("pages and handlers: no-store, no-referrer, frame denial, noindex", async () => {
    const rules = await nextConfig.headers!();
    for (const source of ["/report/:path*", "/api/report/:path*"]) {
      const rule = rules.find((r) => r.source === source)!;
      expect(rule, source).toBeDefined();
      const h = Object.fromEntries(rule.headers.map((x) => [x.key, x.value]));
      expect(h["Cache-Control"]).toBe("no-store");
      expect(h["Referrer-Policy"]).toBe("no-referrer");
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
      expect(h["X-Robots-Tag"]).toContain("noindex");
    }
  });

  it("the proxy does no geo / UTM / consent work on the channel (phase 9 widened the matcher only so the staging X-Robots-Tag covers every path)", async () => {
    const { proxy } = await import("@/proxy");
    const { NextRequest } = await import("next/server");
    const res = proxy(
      new NextRequest("http://localhost:3000/report/acme?utm_source=x", {
        headers: { "cf-ipcountry": "BR", cookie: "consent=accepted" },
      }),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("scripts/check-anonymity.sh (the verify.sh invariant)", () => {
  const script = path.resolve(__dirname, "../scripts/check-anonymity.sh");
  const run = (dirs: string) =>
    spawnSync("bash", [script], {
      env: { ...process.env, ANON_DIRS: dirs },
      encoding: "utf8",
    });

  it("passes on the real intake paths", () => {
    const r = spawnSync("bash", [script], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("ok");
  });

  it("fails on every kind of planted request-metadata access or logging", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "anon-"));
    const plants = [
      "const h = await headers();",
      'const ip = req.headers.get("x-forwarded-for");',
      'req.headers.get("CF-Connecting-IP")',
      'const ua = req.headers.get("User-Agent");',
      "const ip = request.ip;",
      "const c = await cookies();",
      "console.log(body);",
      "console.error(err)",
    ];
    for (const [i, line] of plants.entries()) {
      const file = path.join(dir, `plant${i}.ts`);
      writeFileSync(file, `export const x = 1;\n${line}\n`);
      const r = run(dir);
      expect(r.status, line).toBe(1);
      expect(r.stdout).toContain(`plant${i}.ts`);
      writeFileSync(file, "export const x = 1;\n");
    }
    expect(run(dir).status).toBe(0);
  });

  it("a missing directory is a failure, not a silent pass", () => {
    expect(run("/nonexistent/anon-dir").status).toBe(1);
  });
});
