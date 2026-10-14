import type { DocumentTemplate } from "../../types";
import { AO_RESPONSIBLE, DO_RESPONSIBLE, legalContext } from "./shared";

export const giftsHospitality: DocumentTemplate = {
  type: "policy:gifts_hospitality",
  version: 1,
  title: "Política de Brindes, Presentes e Hospitalidade",
  sections: [
    {
      id: "purpose",
      heading: "Objetivo",
      paragraphs: [
        "Esta Política define quando {{companyName}} e as pessoas que atuam em seu nome podem dar ou receber brindes, presentes, refeições, viagens e convites, para que relações de negócio sejam construídas com respeito e sem influência indevida.",
      ],
    },
    {
      id: "scope",
      heading: "A quem se aplica",
      paragraphs: [
        "Aplica-se a sócios, administradores, empregados e terceiros que atuem em nome de {{companyName}}, e vale também para presentes e convites a familiares dessas pessoas.",
      ],
    },
    {
      id: "principles",
      heading: "Princípios",
      paragraphs: [
        "Um brinde ou convite só é aceitável quando: tem valor modesto; é ocasional; tem finalidade comercial legítima; é dado de forma aberta e registrada; não cria a impressão de troca de favores; e não seria constrangedor se fosse divulgado.",
      ],
    },
    {
      id: "never",
      heading: "O que nunca é permitido",
      paragraphs: [
        "1. Dinheiro ou equivalentes, como cartões-presente, vales e transferências.",
        "2. Qualquer brinde ou convite durante uma licitação, negociação de contrato ou decisão em andamento que envolva quem presenteia.",
        "3. Presentes ou hospitalidade que a outra parte não possa retribuir de forma semelhante ou que seu código de conduta proíba.",
        "4. Entretenimento impróprio ou que gere constrangimento.",
        `5. Pagar despesas de viagem ou de lazer de terceiros sem aprovação prévia ${DO_RESPONSIBLE}.`,
      ],
    },
    {
      id: "public-officials",
      heading: "Agentes públicos",
      paragraphs: [
        `Brindes, presentes e hospitalidade a agentes públicos exigem aprovação prévia e por escrito ${DO_RESPONSIBLE}. Na dúvida, não ofereça. Agentes públicos costumam estar sujeitos a regras próprias, mais restritivas do que as do setor privado.`,
      ],
    },
    {
      id: "receiving",
      heading: "Como proceder ao receber",
      paragraphs: [
        `Se você receber um presente ou convite que não esteja de acordo com esta Política, recuse com cortesia. Se a recusa for impossível ou ofensiva, aceite em nome da empresa, comunique ${AO_RESPONSIBLE} e entregue o item para que seja destinado de forma adequada.`,
      ],
    },
    {
      id: "record",
      heading: "Registro e aprovação",
      paragraphs: [
        `Brindes, presentes e convites dados ou recebidos, quando acima do valor modesto definido pela Administração, devem ser registrados com a data, a pessoa envolvida, a descrição e o valor aproximado, e informados ${AO_RESPONSIBLE}. A Administração define e revisa o valor considerado modesto.`,
      ],
    },
    {
      id: "consequences",
      heading: "Consequências",
      paragraphs: [
        `O descumprimento desta Política pode levar a medidas disciplinares proporcionais à gravidade do caso. Dúvidas e suspeitas podem ser comunicadas ${AO_RESPONSIBLE} ou pelo canal de denúncias da empresa.`,
      ],
    },
    legalContext,
  ],
};
