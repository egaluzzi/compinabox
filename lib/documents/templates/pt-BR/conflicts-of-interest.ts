import type { DocumentTemplate } from "../../types";
import {
  AO_RESPONSIBLE,
  Responsible,
  industryNotesSection,
  legalContext,
} from "./shared";

export const conflictsOfInterest: DocumentTemplate = {
  type: "policy:conflicts_of_interest",
  version: 1,
  title: "Política de Conflito de Interesses",
  sections: [
    {
      id: "purpose",
      heading: "Objetivo",
      paragraphs: [
        "Esta Política explica como {{companyName}} identifica, comunica e trata situações em que interesses pessoais podem interferir, ou parecer interferir, nas decisões tomadas em nome da empresa.",
      ],
    },
    {
      id: "scope",
      heading: "A quem se aplica",
      paragraphs: [
        "Aplica-se a sócios, administradores, empregados, estagiários e terceiros que atuem em nome de {{companyName}}.",
      ],
    },
    {
      id: "definition",
      heading: "O que é um conflito de interesses",
      paragraphs: [
        "Há conflito de interesses quando um interesse pessoal, familiar, financeiro ou de relacionamento pode influenciar, ou parecer influenciar, a forma como alguém exerce suas funções. O conflito pode ser real, potencial ou apenas aparente: todos devem ser comunicados.",
        "Exemplos: contratar ou supervisionar parente ou amigo próximo; participar de decisão sobre fornecedor em que se tem participação ou emprego; usar informação ou bens da empresa em benefício próprio; ter outra atividade remunerada que concorra com a empresa ou prejudique o trabalho.",
      ],
    },
    {
      id: "duty",
      heading: "O que se espera de cada pessoa",
      paragraphs: [
        "1. Evitar situações de conflito sempre que possível.",
        `2. Comunicar por escrito, e logo que perceber, qualquer conflito real, potencial ou aparente ${AO_RESPONSIBLE}.`,
        "3. Não participar de decisões sobre as quais exista conflito até que ele seja avaliado.",
        "4. Não usar o cargo, o nome da empresa ou informações a que tem acesso em benefício próprio ou de terceiros.",
      ],
    },
    {
      id: "assessment",
      heading: "Como os casos são tratados",
      paragraphs: [
        `${Responsible} avalia cada comunicação, registra a decisão e define as medidas: autorizar com cuidados, afastar a pessoa da decisão, reorganizar responsabilidades ou, quando necessário, recusar a situação. A comunicação feita de boa-fé não é motivo de punição.`,
        "A decisão e as medidas adotadas são guardadas em registro de acesso restrito, que é revisto sempre que a situação mudar.",
      ],
    },
    {
      id: "relatives",
      heading: "Parentes e relações pessoais",
      paragraphs: [
        `A contratação de parentes e de pessoas com relação próxima a empregados, ou a agentes públicos com os quais a empresa se relaciona, exige comunicação prévia ${AO_RESPONSIBLE} e aprovação da Administração.`,
      ],
    },
    {
      id: "consequences",
      heading: "Consequências",
      paragraphs: [
        `Deixar de comunicar um conflito conhecido pode levar a medidas disciplinares proporcionais à gravidade do caso. Dúvidas e suspeitas podem ser levadas ${AO_RESPONSIBLE} ou ao canal de denúncias da empresa.`,
      ],
    },
    industryNotesSection,
    legalContext,
  ],
  industryNotes: {
    construction: [
      "No setor de {{industry}}, atenção à escolha de subempreiteiros, fornecedores de materiais e projetistas ligados a empregados ou a seus familiares. Essas escolhas devem seguir critérios documentados.",
    ],
    health: [
      "No setor de {{industry}}, atenção a relações financeiras ou pessoais com fornecedores, prescritores, operadoras e compradores públicos. Participações e vínculos desse tipo devem ser comunicados.",
    ],
    finance: [
      `No setor de {{industry}}, atenção a operações com partes relacionadas e ao uso de informações privilegiadas ou confidenciais em benefício próprio. Esses casos exigem comunicação imediata ${AO_RESPONSIBLE}.`,
    ],
  },
};
