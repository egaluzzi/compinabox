import type { DocumentTemplate } from "../../types";
import {
  AO_RESPONSIBLE,
  DO_RESPONSIBLE,
  PELO_RESPONSIBLE,
  Responsible,
  industryNotesSection,
  legalContext,
} from "./shared";

export const antiBribery: DocumentTemplate = {
  type: "policy:anti_bribery",
  version: 1,
  title: "Política Anticorrupção e Antissuborno",
  sections: [
    {
      id: "purpose",
      heading: "Objetivo",
      paragraphs: [
        "Esta Política estabelece como {{companyName}} previne e enfrenta o suborno e a corrupção em suas atividades. Ela complementa o Código de Conduta e detalha o que é proibido, o que exige aprovação e o que deve ser comunicado.",
      ],
    },
    {
      id: "scope",
      heading: "Quem deve seguir esta Política",
      paragraphs: [
        "Esta Política se aplica a sócios, administradores, empregados e a qualquer pessoa que atue em nome de {{companyName}}, inclusive terceiros contratados para representá-la ou intermediar negócios.",
      ],
    },
    {
      id: "definitions",
      heading: "O que entendemos por suborno e corrupção",
      paragraphs: [
        "Suborno é oferecer, prometer, dar, solicitar ou aceitar uma vantagem indevida, de qualquer valor ou natureza, para que alguém faça ou deixe de fazer algo relacionado ao seu trabalho ou à sua função.",
        "Vantagem indevida não é apenas dinheiro: pode ser presente, viagem, emprego ou estágio para parente, doação, patrocínio, desconto fora do normal, favor ou qualquer benefício sem justificativa legítima.",
      ],
    },
    {
      id: "rules",
      heading: "Regras",
      paragraphs: [
        "1. É proibido oferecer ou aceitar vantagem indevida, direta ou indiretamente, a agentes públicos ou a pessoas do setor privado.",
        "2. É proibido usar terceiros para fazer o que a empresa não pode fazer diretamente.",
        "3. Pagamentos para agilizar ou facilitar atos de rotina de agentes públicos não são permitidos.",
        `4. Doações e patrocínios exigem finalidade legítima, registro e aprovação prévia ${DO_RESPONSIBLE}.`,
        "5. Todo pagamento deve ser registrado com clareza nos livros e documentos da empresa, com descrição fiel do que foi pago e por quê.",
        "6. Em fusões, aquisições e novas parcerias relevantes, deve-se verificar antes o histórico de integridade da outra parte.",
      ],
    },
    {
      id: "red-flags",
      heading: "Sinais de alerta",
      paragraphs: [
        `Comunique ${AO_RESPONSIBLE} situações como: pedido de pagamento em dinheiro ou em conta de terceiros ou de outro país; comissão desproporcional ao serviço; intermediário indicado por um agente público; recusa em formalizar o contrato; ou notas fiscais genéricas, sem detalhe do que foi entregue.`,
      ],
    },
    {
      id: "responsibilities",
      heading: "Responsabilidades",
      paragraphs: [
        `A Administração dá o exemplo, destina recursos para a aplicação desta Política e apoia as decisões ${DO_RESPONSIBLE}, inclusive quando elas significarem recusar um negócio.`,
        `${Responsible} orienta as pessoas, analisa os casos que lhe são levados, mantém os registros e propõe revisões desta Política.`,
        "Cada pessoa é responsável por conhecer esta Política, aplicá-la e comunicar o que perceber de errado.",
      ],
    },
    {
      id: "reporting",
      heading: "Como comunicar",
      paragraphs: [
        `Dúvidas e suspeitas podem ser levadas à liderança, ${AO_RESPONSIBLE} ou ao canal de denúncias da empresa, inclusive de forma anônima. Retaliação contra quem comunica de boa-fé é proibida.`,
      ],
    },
    {
      id: "consequences",
      heading: "Consequências",
      paragraphs: [
        "O descumprimento desta Política pode levar a medidas disciplinares proporcionais à gravidade do caso, incluindo desligamento ou rescisão de contrato, e à comunicação do fato às autoridades quando apropriado.",
      ],
    },
    industryNotesSection,
    legalContext,
  ],
  industryNotes: {
    construction: [
      "No setor de {{industry}}, atenção especial a licenças, medições, aditivos de contrato e fiscalizações. Pagamentos a despachantes e a subcontratados devem ser feitos mediante contrato, com a descrição do serviço e a comprovação de que ele foi realizado.",
    ],
    health: [
      `No setor de {{industry}}, brindes, amostras, patrocínio de congressos e convites a profissionais de saúde ou a compradores públicos devem ser aprovados previamente ${PELO_RESPONSIBLE} e documentados.`,
    ],
    finance: [
      `No setor de {{industry}}, atenção a operações sem justificativa econômica clara e a pedidos de sigilo incomuns. Esses casos devem ser comunicados ${AO_RESPONSIBLE} antes de qualquer andamento.`,
    ],
  },
};
