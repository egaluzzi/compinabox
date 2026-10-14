// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ar } from "@/lib/content/ar";
import { br } from "@/lib/content/br";
import { mx } from "@/lib/content/mx";
import { getMessages } from "@/lib/i18n";

const ptBR = getMessages("pt-BR");

describe("lib/content/br.ts", () => {
  it("explainer equals the pt-BR legal-basis page copy (no drift between the two copies)", () => {
    expect(br.explainer).toBe(ptBR.landing.min);
  });
  it("disclaimer equals the pt-BR legal-basis disclaimer", () => {
    expect(br.disclaimer).toBe(ptBR.landing.minNote);
  });
  it("each law summary is a verbatim part of the approved explainer (nothing added)", () => {
    for (const law of br.laws) expect(br.explainer).toContain(law.summary);
  });
  it("cites exactly the two laws from SPEC §7 and is marked draft", () => {
    expect(br.laws.map((l) => l.citation)).toEqual([
      "Lei 12.846/2013",
      "Lei 14.133/2021",
    ]);
    expect(br.reviewStatus).toBe("draft");
    expect(br.locale).toBe("pt-BR");
  });
  it("required elements are the ones SPEC §7 names (whistleblowing channel, leadership commitment)", () => {
    expect(br.requiredElements.map((e) => e.id)).toEqual([
      "whistleblowing-channel",
      "leadership-commitment",
    ]);
  });
  it("contains no article numbers, decrees or other statutes", () => {
    expect(JSON.stringify(br)).not.toMatch(
      /Art\.|Artigo|Decreto|LGPD|Lei\s*(n[ºo°.]?\s*)?(?!12\.846|14\.133)\d/i,
    );
  });
});

describe("ar / mx placeholders", () => {
  it("are typed NotYetEnabled", () => {
    expect(ar).toEqual({ country: "ar", notYetEnabled: true });
    expect(mx).toEqual({ country: "mx", notYetEnabled: true });
  });
});
