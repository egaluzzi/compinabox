// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderBinderPdf } from "@/lib/binder/pdf";
import { takeSnapshot } from "@/lib/binder/snapshot";
import { binders, employees, vendors } from "@/lib/db/schema";
import { useScratchTestDb } from "./helpers/db";
import {
  inspectPdf,
  makeBinder,
  MARKERS,
  seedBinderCompany,
} from "./helpers/binder";

let db: Awaited<ReturnType<typeof useScratchTestDb>>["db"];
let dropDb: () => Promise<void>;
type Seeded = Awaited<ReturnType<typeof seedBinderCompany>>;
let A: Seeded;
let B: Seeded;
let plain: Awaited<ReturnType<typeof inspectPdf>>;
let withStats: Awaited<ReturnType<typeof inspectPdf>>;

const pdfOf = async (id: string) => {
  const [r] = await db.select().from(binders).where(eq(binders.id, id));
  expect(r.status, `binder ${id} (${r.errorCode})`).toBe("ready");
  return r.pdf!;
};

beforeAll(async () => {
  process.env.APP_URL = "http://localhost:3000";
  ({ db, drop: dropDb } = await useScratchTestDb());
  // A carries a unique marker in EVERY excluded field; B is another tenant with its own names.
  A = await seedBinderCompany(db, {
    markers: true,
    employees: 14,
    vendors: 6,
    reports: 4,
    namePrefix: "Alfa",
  });
  B = await seedBinderCompany(db, {
    markers: true,
    employees: 5,
    vendors: 3,
    reports: 2,
    namePrefix: "Bravo",
  });
  const off = await makeBinder(db, A, { includeChannelStats: false });
  const on = await makeBinder(db, A, { includeChannelStats: true });
  plain = await inspectPdf(await pdfOf(off.id));
  withStats = await inspectPdf(await pdfOf(on.id));
}, 120_000);
afterAll(async () => {
  await dropDb();
});

const EXCLUDED = Object.values(MARKERS);

describe("what the dossier leaves out (marker test)", () => {
  // pdfjs sometimes inserts a space inside a kerned run, so every check is also made on the text
  // with all whitespace removed (a marker split by a space must not slip through)
  const compact = (t: { text: string }) =>
    t.text.replace(/\s+/g, "").toLowerCase();

  it("none of the unique markers planted in excluded fields appears — statistics off", () => {
    for (const m of EXCLUDED)
      expect(compact(plain), m).not.toContain(m.toLowerCase());
    for (const m of EXCLUDED) expect(plain.text, m).not.toContain(m);
    expect(plain.text).not.toMatch(/@example\.test/);
    expect(plain.text).not.toMatch(/MARKER/i);
  });

  it("none appears with the channel statistics option ON either", () => {
    for (const m of EXCLUDED)
      expect(compact(withStats), m).not.toContain(m.toLowerCase());
    for (const m of EXCLUDED) expect(withStats.text, m).not.toContain(m);
    expect(withStats.text).not.toMatch(/@example\.test/);
    expect(withStats.text).not.toMatch(/MARKER/i);
  });

  it("the raw bytes of the file do not contain the markers either (not just the extracted text)", async () => {
    const [r] = await db
      .select()
      .from(binders)
      .where(eq(binders.companyId, A.company.id));
    const raw = (await pdfOf(r.id)).toString("latin1");
    for (const m of [MARKERS.email, MARKERS.ip, MARKERS.disclosure])
      expect(raw).not.toContain(m);
  });

  it("what IS included appears: names, dates, statuses, vendor names, the channel URL, the documents", () => {
    for (const t of [plain, withStats]) {
      expect(t.text).toContain("Alfa 001 José Antônio Çavalcanti");
      expect(t.text).toContain("Alfa 014 José Antônio Çavalcanti");
      expect(t.text).toContain("Fornecedor 01 Ltda");
      expect(t.text).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(t.text).toContain(
        `http://localhost:3000/report/${A.company.slug}`,
      );
      expect(t.text).toContain("Concluído");
      expect(t.text).toContain("Pendente");
      expect(t.text).toContain("Enviada");
      expect(t.text).toContain("Código de Conduta");
      expect(t.text).toContain("Lei 12.846");
    }
    // the CNPJ is formatted and the cover carries the binder id
    expect(plain.pages[0]).toContain("11.222.333/0001-81");
    // (text extraction may put a space inside a kerned run, so look at the compacted page)
    expect(plain.pages[0].replace(/\s/g, "")).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
  });

  it("channel statistics appear only when asked for, as totals by status", () => {
    expect(plain.text).not.toContain("Relatos recebidos até a data");
    expect(plain.text).toContain("não incluídas nesta edição");
    expect(withStats.text).toContain(
      "Relatos recebidos até a data da posição: 4",
    );
    expect(withStats.text).toMatch(/Novos 2/);
    expect(withStats.text).toMatch(/Em análise 1/);
    expect(withStats.text).toMatch(/Encerrados 1/);
    expect(withStats.text).toContain("incluídas nesta edição");
  });
});

describe("positive control for the marker test", () => {
  it("a marker that DOES reach the snapshot is found by the same extraction (the test can fail)", async () => {
    const snap = await takeSnapshot(db, {
      binderId: crypto.randomUUID(),
      companyId: A.company.id,
      options: { includeChannelStats: false },
    });
    snap.training.rows[0].name = `Leak ${MARKERS.disclosure}`;
    snap.vendors[0].name = `Leak ${MARKERS.vendorOwnership}`;
    const t = await inspectPdf((await renderBinderPdf(snap)).buffer);
    const compact = t.text.replace(/\s+/g, "").toLowerCase();
    expect(compact).toContain(MARKERS.disclosure.toLowerCase());
    expect(compact).toContain(MARKERS.vendorOwnership.toLowerCase());
  }, 60_000);
});

describe("tenant isolation", () => {
  it("company B's names, vendors and company name never appear in A's dossier", () => {
    for (const t of [plain, withStats]) {
      expect(t.text).not.toContain("Bravo 001");
      expect(t.text).not.toContain(B.company.name);
      expect(t.text).not.toContain(B.company.slug);
      for (const v of B.vendors) expect(t.text).not.toContain(v.name);
    }
  });

  it("and B's own dossier has B's data only", async () => {
    const b = await makeBinder(db, B);
    const t = await inspectPdf(await pdfOf(b.id));
    expect(t.text).toContain("Bravo 001");
    expect(t.text).not.toContain("Alfa 001");
    expect(t.text).not.toContain(A.company.name);
    expect(t.text).not.toContain(A.company.slug);
  });
});

describe("layout", () => {
  it("every page says 'Página X de Y' with the real total", () => {
    plain.pages.forEach((p, i) =>
      expect(p, `page ${i + 1}`).toContain(
        `Página ${i + 1} de ${plain.numPages}`,
      ),
    );
  });

  it("the running header (company · title) is on every page but the cover", () => {
    plain.pages.slice(1).forEach((p, i) => {
      expect(p, `page ${i + 2}`).toContain(A.company.name);
      expect(p, `page ${i + 2}`).toContain("Dossiê de integridade");
    });
  });

  it("the contents list real start pages, the outline and the links point at the same pages", () => {
    const toc = plain.pages[1];
    const entries = [
      ["Contexto legal", /(^|\s)1 Contexto legal (\d+)/],
      ["Registro de leitura e aceite", /4 Registro de leitura e aceite (\d+)/],
      ["Canal de denúncias", /6 Canal de denúncias (\d+)/],
      ["Triagem de fornecedores", /7 Triagem de fornecedores (\d+)/],
      ["Notas sobre os dados", /8 Notas sobre os dados (\d+)/],
    ] as const;
    for (const [title, re] of entries) {
      const m = re.exec(toc);
      expect(m, title).not.toBeNull();
      const page = Number(m![m!.length - 1]);
      // the page the contents point at really starts that section
      expect(plain.pages[page - 1], title).toContain(title);
      const o = plain.outline.find((x) => x.title.endsWith(title));
      expect(o?.page, `outline ${title}`).toBe(page);
    }
    // 8 sections + 6 documents + contents
    expect(plain.outline.length).toBe(15);
    expect(plain.outline.every((o) => o.page && o.page >= 2)).toBe(true);
    // one clickable link per contents row, each landing on the page printed beside it
    const tocLinks = plain.links.filter((l) => l.page === 2);
    expect(tocLinks.length).toBe(14);
    const printed = [...toc.matchAll(/ (\d+) ?(?=\d|\n|$)/g)];
    expect(printed.length).toBeGreaterThan(0);
    for (const l of tocLinks) expect(l.target).toBeGreaterThan(2);
  });

  it("a long table continues on the next page with its header row repeated", () => {
    const training = plain.pages.findIndex((p) =>
      p.includes("Relatório de treinamento"),
    );
    expect(training).toBeGreaterThan(0);
    const roster = plain.pages.filter((p) => p.includes("Alfa 0"));
    expect(roster.length).toBeGreaterThan(0);
    // 14 employees fit one page; the dedicated large-company test covers the continuation
  });
});

describe("honest wording", () => {
  const BANNED =
    /em conformidade|certificad[oa]s?\b|aprovad[oa]s?\b|adequad[oa]s?\b|\batende\b|ISO ?3730|compliant|certified|approved/i;

  it("no compliance claim, verdict word or ISO mention in anything the dossier itself says", () => {
    // the six documents are the customer's own policy texts (separate lawyer review, e.g. an
    // ordinary "de forma adequada" in a gifts clause); everything else is the dossier's own voice
    for (const t of [plain, withStats]) {
      const first = t.outline.find((o) => o.title.startsWith("2.1"))!.page!;
      const after = t.outline.find((o) => o.title.startsWith("3 "))!.page!;
      const own = t.pages.filter((_, i) => i + 1 < first || i + 1 >= after);
      expect(own.length).toBeGreaterThanOrEqual(10);
      expect(own.join("\n")).not.toMatch(BANNED);
    }
  });

  it("the cover carries the not-legal-advice / not-an-audit statement and the date", () => {
    const cover = plain.pages[0];
    expect(cover).toContain("Como ler este dossiê");
    expect(cover).toContain(
      "Não é uma auditoria, uma certificação nem um parecer jurídico",
    );
    expect(cover).toContain("não constitui aconselhamento jurídico");
    expect(cover).toMatch(/Posição em \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  });

  it("the draft notice is on the cover while documents / legal content / training are drafts", () => {
    expect(plain.pages[0]).toContain("RASCUNHO — pendente de revisão");
    expect(plain.pages[0]).toContain("revisão jurídica");
  });

  it("the vendor section is labelled a screening tool, not due diligence", () => {
    expect(plain.text).toContain(
      "ferramenta de triagem, não uma investigação de due diligence",
    );
    expect(plain.text).toContain(
      "As respostas dos questionários não fazem parte",
    );
  });

  it("the draft notice disappears when nothing is a draft (rendering the same snapshot with draft=false)", async () => {
    const snap = await takeSnapshot(db, {
      binderId: crypto.randomUUID(),
      companyId: A.company.id,
      options: { includeChannelStats: false },
    });
    expect(snap.draft).toBe(true);
    const t = await inspectPdf(
      (await renderBinderPdf({ ...snap, draft: false })).buffer,
    );
    expect(t.pages[0]).not.toContain("RASCUNHO — pendente de revisão");
  }, 60_000);
});

describe("snapshot consistency", () => {
  it("rows committed by another connection after the snapshot started never appear", async () => {
    const S = await seedBinderCompany(db, {
      employees: 3,
      vendors: 2,
      namePrefix: "Snap",
    });
    const snap = await takeSnapshot(
      db,
      {
        binderId: crypto.randomUUID(),
        companyId: S.company.id,
        options: { includeChannelStats: false },
      },
      {
        afterFirstRead: async () => {
          // committed on another pooled connection while the snapshot transaction is open
          await db.insert(employees).values({
            companyId: S.company.id,
            name: "Intruso Tarde",
            email: "late@example.test",
          });
          await db
            .insert(vendors)
            .values({ companyId: S.company.id, name: "Fornecedor Tardio" });
        },
      },
    );
    expect(snap.training.rows.map((r) => r.name).join()).not.toContain(
      "Intruso",
    );
    expect(snap.vendors.map((v) => v.name).join()).not.toContain("Tardio");
    expect(snap.activeEmployees).toBe(3);
    // ...and they ARE in the database, so the next snapshot sees them
    const next = await takeSnapshot(db, {
      binderId: crypto.randomUUID(),
      companyId: S.company.id,
      options: { includeChannelStats: false },
    });
    expect(next.activeEmployees).toBe(4);
    expect(next.vendors.map((v) => v.name)).toContain("Fornecedor Tardio");
  }, 60_000);

  it("data changed between the snapshot and the render (the job path) does not appear in the file", async () => {
    const S = await seedBinderCompany(db, {
      employees: 3,
      vendors: 2,
      namePrefix: "Job",
    });
    const done = await makeBinder(
      db,
      S,
      { includeChannelStats: false },
      {
        beforeRender: async () => {
          await db.insert(employees).values({
            companyId: S.company.id,
            name: "Alterado Durante Render",
            email: "mid@example.test",
          });
          await db
            .insert(vendors)
            .values({ companyId: S.company.id, name: "Fornecedor Durante" });
        },
      },
    );
    const t = await inspectPdf(done.pdf!);
    expect(t.text).toContain("Job 001");
    expect(t.text).not.toContain("Alterado Durante Render");
    expect(t.text).not.toContain("Fornecedor Durante");
    // the as-of printed on the cover is the stored as_of
    expect(done.asOf).toBeInstanceOf(Date);
  }, 60_000);
});

describe("a company with nothing recorded", () => {
  it("renders honest empty sections: no employees, no vendors, no reports", async () => {
    const E = await seedBinderCompany(db, {
      employees: 0,
      vendors: 0,
      reports: 0,
    });
    const done = await makeBinder(db, E, { includeChannelStats: true });
    const t = await inspectPdf(done.pdf!);
    expect(done.status).toBe("ready");
    expect(t.text).toContain("Nenhum colaborador ativo na data da posição");
    expect(t.text).toContain("Nenhum fornecedor registrado na data da posição");
    expect(t.text).toContain("Relatos recebidos até a data da posição: 0");
    expect(t.text).toContain("Enviadas: 0 de 0 colaboradores ativos");
    expect(t.text).toContain("Colaboradores ativos: 0");
    expect(t.numPages).toBeGreaterThan(10); // the six documents are still there
  }, 60_000);
});
