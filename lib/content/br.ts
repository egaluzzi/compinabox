import type { CountryLegalContent } from "./types";

/**
 * Brazil legal-basis content. DRAFT — needs review by a Brazilian lawyer before launch
 * (lib/documents/REVIEW.md). Every statement below comes from SPEC.md §7 or CONTENT.md §3;
 * no article numbers, decrees or other statutes have been added. `explainer` and `disclaimer`
 * must equal the pt-BR marketing copy (tests/content.test.ts guards against drift).
 */
export const br: CountryLegalContent = {
  country: "br",
  locale: "pt-BR",
  laws: [
    {
      id: "lei-12846",
      shortName: "Lei Anticorrupção",
      officialName: "Lei Anticorrupção (Lei 12.846/2013)",
      citation: "Lei 12.846/2013",
      summary:
        "A Lei 12.846 (Lei Anticorrupção) usa a existência de um programa efetivo como atenuante em caso de apuração de responsabilidade.",
    },
    {
      id: "lei-14133",
      shortName: "Lei de Licitações",
      officialName: "Nova Lei de Licitações (Lei 14.133/2021)",
      citation: "Lei 14.133/2021",
      summary:
        "A Lei 14.133/2021 passou a exigir programas de integridade robustos para elegibilidade em licitações públicas, incluindo canal de denúncias e liderança comprometida com a ética.",
    },
  ],
  requiredElements: [
    { id: "whistleblowing-channel", text: "Canal de denúncias" },
    {
      id: "leadership-commitment",
      text: "Comprometimento da alta direção com a ética",
    },
  ],
  recommendedElements: [
    {
      id: "third-party-due-diligence",
      text: "Diligência prévia e monitoramento contínuo de terceiros",
    },
    {
      id: "recordkeeping",
      text: "Registro documentado de treinamentos, uso do canal de denúncias e declarações dos colaboradores",
    },
  ],
  explainer:
    "A Lei 14.133/2021 passou a exigir programas de integridade robustos para elegibilidade em licitações públicas, incluindo canal de denúncias e liderança comprometida com a ética. A Lei 12.846 (Lei Anticorrupção) usa a existência de um programa efetivo como atenuante em caso de apuração de responsabilidade.",
  disclaimer: "Isto é informação geral, não aconselhamento jurídico.",
  reviewStatus: "draft",
};
