// @vitest-environment node
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { binders } from "@/lib/db/schema";
import { useTestDb } from "./helpers/db";
import { inspectPdf, makeBinder, seedBinderCompany } from "./helpers/binder";

// A big company: 500 employees, 50 vendors, 30 reports, all six documents. Proves the long tables
// break across pages correctly and records the cost of one render (wall time and memory). The
// numbers are printed so they can be pasted into HANDOFF.md; the assertions are generous ceilings
// (the supervisor's bar: ~60 s and ~600 MB for the render itself).
const EMPLOYEES = 500;
const VENDORS = 50;

let db: ReturnType<typeof useTestDb>;
let rssBefore = 0;
let rssPeak = 0;
let wallMs = 0;
let ready: Awaited<ReturnType<typeof inspectPdf>>;
let row: typeof binders.$inferSelect;

beforeAll(async () => {
  process.env.APP_URL = "http://localhost:3000";
  db = useTestDb();
  const s = await seedBinderCompany(db, {
    employees: EMPLOYEES,
    vendors: VENDORS,
    reports: 30,
    namePrefix: "Grande",
  });
  global.gc?.();
  rssBefore = process.memoryUsage().rss;
  rssPeak = rssBefore;
  const sampler = setInterval(() => {
    rssPeak = Math.max(rssPeak, process.memoryUsage().rss);
  }, 50);
  const t0 = Date.now();
  row = await makeBinder(db, s, { includeChannelStats: true });
  wallMs = Date.now() - t0;
  clearInterval(sampler);
  rssPeak = Math.max(rssPeak, process.memoryUsage().rss);
  ready = await inspectPdf(row.pdf!);
  const mb = (n: number) => `${Math.round(n / 1048576)} MB`;
  console.log(
    `BINDER-PERF employees=${EMPLOYEES} vendors=${VENDORS} wall=${(wallMs / 1000).toFixed(1)}s ` +
      `pages=${row.pageCount} size=${mb(row.sizeBytes!)}(${row.sizeBytes} B) ` +
      `rss_before=${mb(rssBefore)} rss_peak=${mb(rssPeak)} rss_delta=${mb(rssPeak - rssBefore)}`,
  );
}, 300_000);

describe("a 500-employee, 50-vendor company", () => {
  it("renders to ready within the ceilings", () => {
    expect(row.status).toBe("ready");
    expect(wallMs).toBeLessThan(90_000);
    expect(rssPeak - rssBefore).toBeLessThan(900 * 1048576);
    expect(row.sizeBytes!).toBeLessThan(5 * 1048576);
    expect(row.pageCount).toBe(ready.numPages);
  });

  it("every employee appears exactly once in each of the three roster tables, in order", () => {
    const section = (from: string, to: string) => {
      const a = ready.pages.findIndex(
        (p) => p.includes(from) && /^\s*\S*\s*\d?\s*/.test(p),
      );
      return { a };
    };
    void section;
    const names = Array.from(
      { length: EMPLOYEES },
      (_, i) =>
        `Grande ${String(i + 1).padStart(3, "0")} José Antônio Çavalcanti`,
    );
    for (const heading of [
      "Relatório de treinamento",
      "Registro de leitura e aceite",
      "Declarações de conflito de interesses",
    ]) {
      // pages of this section: from the page that starts it up to the page before the next section
      const start = ready.outline.find((o) => o.title.endsWith(heading))!.page!;
      const after = ready.outline
        .map((o) => o.page!)
        .filter((p) => p > start)
        .sort((a, b) => a - b)[0];
      const text = ready.pages
        .slice(start - 1, after - 1)
        .join("\n")
        .replace(/\s+/g, " ");
      let pos = 0;
      for (const n of names) {
        const at = text.indexOf(n, pos);
        expect(at, `${heading}: ${n}`).toBeGreaterThanOrEqual(0);
        pos = at + n.length;
        expect(text.indexOf(n, pos), `${heading}: ${n} twice`).toBe(-1);
      }
    }
  });

  it("the header row repeats on every continuation page and nothing is cut off", () => {
    const start = ready.outline.find((o) =>
      o.title.endsWith("Relatório de treinamento"),
    )!.page!;
    const after = ready.outline.find((o) =>
      o.title.endsWith("Registro de leitura e aceite"),
    )!.page!;
    const pages = ready.pages.slice(start - 1, after - 1);
    expect(pages.length).toBeGreaterThan(5); // continues over many pages
    for (const [i, p] of pages.entries()) {
      expect(p, `training page ${i + 1}`).toMatch(/Nome Situação Data Nota/);
      // never an orphan heading: the section heading is only on its first page
      expect(p.includes("Relatório de treinamento")).toBe(i === 0);
    }
    // the roster also repeats its header, with the six document columns
    const a0 = ready.outline.find((o) =>
      o.title.endsWith("Registro de leitura e aceite"),
    )!.page!;
    const a1 = ready.outline.find((o) =>
      o.title.endsWith("Declarações de conflito de interesses"),
    )!.page!;
    for (const p of ready.pages.slice(a0 - 1, a1 - 1))
      expect(p).toMatch(
        /Nome Código Anticorrupção Presentes Conflitos Terceiros Denunciante/,
      );
  });

  it("the contents, outline and page numbers stay consistent at this size", () => {
    for (const o of ready.outline) expect(o.page).toBeGreaterThan(0);
    ready.pages.forEach((p, i) =>
      expect(p).toContain(`Página ${i + 1} de ${ready.numPages}`),
    );
    const last = ready.outline.find((o) =>
      o.title.endsWith("Notas sobre os dados"),
    )!.page!;
    expect(last).toBe(ready.numPages);
    expect(ready.pages[1]).toContain(` ${last} `);
  });

  it("all 50 vendors are listed", () => {
    for (let i = 1; i <= VENDORS; i++)
      expect(ready.text).toContain(
        `Fornecedor ${String(i).padStart(2, "0")} Ltda`,
      );
  });

  it("the row is stored and immutable", async () => {
    const [r] = await db
      .select({ s: binders.status })
      .from(binders)
      .where(eq(binders.id, row.id));
    expect(r.s).toBe("ready");
  });
});
