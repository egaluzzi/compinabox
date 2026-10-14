import type { DocumentTemplate } from "../../types";
import { AO_RESPONSIBLE, industryNotesSection, legalContext } from "./shared";

export const thirdPartyPublicOfficials: DocumentTemplate = {
  type: "policy:third_party_public_officials",
  version: 1,
  title: "Política de Relacionamento com Terceiros e Agentes Públicos",
  sections: [
    {
      id: "purpose",
      heading: "Objetivo",
      paragraphs: [
        "Esta Política define como {{companyName}} se relaciona com agentes públicos e escolhe e acompanha terceiros que atuam em seu nome, como fornecedores, representantes, consultores e parceiros.",
      ],
    },
    {
      id: "scope",
      heading: "A quem se aplica",
      paragraphs: [
        "Aplica-se a sócios, administradores, empregados e a qualquer pessoa que atue em nome de {{companyName}} em contato com agentes públicos ou na contratação de terceiros.",
      ],
    },
    {
      id: "public-officials",
      heading: "Relacionamento com agentes públicos",
      paragraphs: [
        "1. O contato com agentes públicos deve ocorrer por canais oficiais, de forma transparente e profissional.",
        "2. Reuniões relevantes devem contar, sempre que possível, com mais de uma pessoa da empresa e ser registradas, com data, participantes e assunto.",
        "3. Nenhuma vantagem indevida pode ser oferecida, prometida ou dada a agente público, nem a familiares ou pessoas indicadas por ele.",
        "4. Propostas, declarações e documentos entregues a órgãos públicos devem ser verdadeiros, completos e conferidos antes do envio.",
        `5. Contratar ou conceder benefícios a agente público ou a seus parentes exige comunicação prévia ${AO_RESPONSIBLE}.`,
      ],
    },
    {
      id: "tenders",
      heading: "Licitações e contratos públicos",
      paragraphs: [
        "Na participação em licitações e na execução de contratos públicos, a empresa não combina preços, não frauda documentos, não oferece vantagens e não usa intermediários para obter informação ou decisão favorável. Todo aditivo, medição ou prorrogação deve estar documentado e justificado.",
      ],
    },
    {
      id: "third-parties",
      heading: "Escolha e acompanhamento de terceiros",
      paragraphs: [
        "Antes de contratar um terceiro que possa interagir com agentes públicos em nome da empresa, ou que seja relevante para o negócio, deve-se: conhecer quem ele é e quem são seus sócios; verificar sua reputação e histórico de integridade; confirmar a necessidade real do serviço; e documentar a escolha.",
        "Contratos com terceiros devem descrever claramente o serviço, o preço e a forma de pagamento, e incluir o compromisso de seguir princípios de integridade equivalentes aos desta Política.",
      ],
    },
    {
      id: "monitoring",
      heading: "Acompanhamento e registro",
      paragraphs: [
        "Terceiros relevantes devem ser acompanhados durante a relação: o serviço contratado foi de fato prestado? Os pagamentos são compatíveis? Surgiu algum sinal de alerta? As verificações feitas e as decisões tomadas devem ser guardadas em registro.",
      ],
    },
    {
      id: "red-flags",
      heading: "Sinais de alerta",
      paragraphs: [
        `Comunique ${AO_RESPONSIBLE}: indicação do terceiro por um agente público; pedido de pagamento em conta de terceiro, em dinheiro ou em outro país; recusa em fornecer informações ou assinar compromissos de integridade; comissão fora do padrão; ou serviço descrito de forma vaga.`,
      ],
    },
    {
      id: "consequences",
      heading: "Consequências",
      paragraphs: [
        `O descumprimento desta Política pode levar a medidas disciplinares proporcionais à gravidade do caso e, no caso de terceiros, à suspensão ou rescisão do contrato. Dúvidas e suspeitas podem ser levadas ${AO_RESPONSIBLE} ou ao canal de denúncias da empresa.`,
      ],
    },
    industryNotesSection,
    legalContext,
  ],
  industryNotes: {
    construction: [
      "No setor de {{industry}}, a relação com órgãos públicos costuma ser frequente (contratos, medições, licenças e fiscalizações). Mantenha registro das reuniões e dos documentos entregues, e documente a seleção e a atuação de subempreiteiros e consórcios.",
    ],
    health: [
      "No setor de {{industry}}, compras públicas, credenciamentos e fiscalizações exigem registro cuidadoso. Distribuidores, representantes e consultores devem ser avaliados antes da contratação e acompanhados durante a relação.",
    ],
    finance: [
      "No setor de {{industry}}, a interação com órgãos públicos e reguladores deve ser documentada. Intermediários e parceiros devem ser avaliados antes da contratação, com atenção a quem são os beneficiários finais.",
    ],
  },
};
