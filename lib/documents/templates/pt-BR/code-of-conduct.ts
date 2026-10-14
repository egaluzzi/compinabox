import type { DocumentTemplate } from "../../types";
import {
  AO_RESPONSIBLE,
  DO_RESPONSIBLE,
  PELO_RESPONSIBLE,
  RESPONSIBLE,
  Responsible,
  industryNotesSection,
  legalContext,
} from "./shared";

export const codeOfConduct: DocumentTemplate = {
  type: "code_of_conduct",
  version: 1,
  title: "Código de Conduta",
  sections: [
    {
      id: "purpose",
      heading: "Nosso compromisso",
      paragraphs: [
        "{{companyName}} quer fazer negócios de forma honesta, transparente e respeitosa. Este Código de Conduta foi preparado considerando o contexto de {{country}} e reúne as regras básicas que esperamos de todas as pessoas que trabalham conosco.",
        "Ele vale como orientação no dia a dia. Quando uma situação não estiver prevista aqui, a pergunta a fazer é: isso é honesto, está de acordo com as regras da empresa e poderia ser explicado em público sem constrangimento? Se houver dúvida, consulte antes de agir.",
      ],
    },
    {
      id: "leadership-commitment",
      heading: "Comprometimento da alta direção",
      paragraphs: [
        "A Administração de {{companyName}} se compromete a cumprir este Código, a dar o exemplo, a destinar tempo e recursos para que ele seja conhecido e aplicado, e a não tolerar corrupção, suborno ou qualquer forma de conduta antiética, em nenhum nível da empresa.",
        "A Administração também se compromete a proteger quem levanta uma preocupação de boa-fé e a tratar os casos relatados com seriedade e imparcialidade.",
      ],
    },
    {
      id: "scope",
      heading: "A quem este Código se aplica",
      paragraphs: [
        "Este Código se aplica a sócios, administradores, empregados, estagiários e a qualquer pessoa que atue em nome de {{companyName}}. Esperamos que fornecedores, parceiros e representantes sigam princípios equivalentes ao trabalhar conosco.",
      ],
    },
    {
      id: "anti-bribery",
      heading: "Combate ao suborno e à corrupção",
      paragraphs: [
        "É proibido oferecer, prometer, dar, pedir ou aceitar qualquer vantagem indevida, em dinheiro ou em qualquer outra forma, para obter ou manter um negócio, uma decisão ou um tratamento favorável. Isso vale para agentes públicos e também para pessoas e empresas privadas.",
        "Também é proibido fazer por meio de terceiros, como consultores, despachantes ou intermediários, o que não pode ser feito diretamente. Pagamentos devem ter finalidade legítima, estar documentados e corresponder a um serviço ou produto realmente prestado.",
      ],
    },
    {
      id: "gifts-hospitality",
      heading: "Brindes, presentes e hospitalidade",
      paragraphs: [
        "Brindes, presentes, refeições e convites só podem ser dados ou aceitos quando forem de valor modesto, ocasionais, ligados a uma finalidade comercial legítima e abertos a qualquer pessoa. Nunca devem ser dados ou aceitos para influenciar uma decisão.",
        `Dinheiro ou equivalentes (como cartões-presente) nunca são aceitáveis. Nenhum brinde ou hospitalidade deve ser oferecido a agente público sem aprovação prévia ${DO_RESPONSIBLE}. Em caso de dúvida, recuse ou consulte antes.`,
      ],
    },
    {
      id: "conflicts",
      heading: "Conflito de interesses",
      paragraphs: [
        "Há conflito de interesses quando um interesse pessoal, familiar ou financeiro pode afetar, ou parecer afetar, a imparcialidade de uma decisão tomada em nome de {{companyName}}. Exemplos: contratar um fornecedor da família, ter participação em um concorrente ou aceitar um segundo trabalho que prejudique as suas funções.",
        `Todo conflito, real ou potencial, deve ser informado por escrito ${AO_RESPONSIBLE} assim que for percebido. Informar não é falta; esconder é.`,
      ],
    },
    {
      id: "public-officials",
      heading: "Relacionamento com agentes públicos",
      paragraphs: [
        "O contato com agentes públicos, em licitações, contratos, fiscalizações, licenças ou autorizações, deve ser feito de forma transparente, por canais oficiais e com registro. Nenhuma vantagem indevida pode ser oferecida para acelerar, facilitar ou influenciar um ato oficial.",
        "Em reuniões com agentes públicos, sempre que possível, participe com outra pessoa da empresa e registre o assunto tratado. Contratos e propostas públicas devem refletir informações verdadeiras e completas.",
      ],
    },
    {
      id: "confidentiality",
      heading: "Confidencialidade e uso de informações",
      paragraphs: [
        "Informações não públicas de {{companyName}}, de clientes, de fornecedores e de colegas devem ser usadas apenas para os fins do trabalho e protegidas contra acesso indevido. Isso inclui dados pessoais, informações comerciais e financeiras e documentos internos.",
        "O dever de confidencialidade continua depois que a relação de trabalho termina. Nada neste Código impede que alguém relate, de boa-fé, uma preocupação de ética pelos canais indicados abaixo.",
      ],
    },
    {
      id: "raise-concern",
      heading: "Como levantar uma preocupação",
      paragraphs: [
        `Se você presenciar ou suspeitar de uma violação deste Código, comunique. Você pode falar com sua liderança, com ${RESPONSIBLE} ou usar o canal de denúncias da empresa, que permite relatos de forma sigilosa e, quando a pessoa preferir, anônima.`,
        "Ninguém será punido por levantar de boa-fé uma preocupação. Retaliação contra quem relata é proibida e será tratada como violação grave deste Código.",
      ],
    },
    {
      id: "consequences",
      heading: "Consequências",
      paragraphs: [
        "Violações deste Código podem levar a medidas disciplinares proporcionais à gravidade do caso, incluindo advertência e desligamento, além do encerramento de contratos com terceiros. Dependendo do caso, os fatos também podem ser comunicados às autoridades.",
      ],
    },
    industryNotesSection,
    legalContext,
    {
      id: "review",
      heading: "Responsabilidade e revisão",
      paragraphs: [
        `${Responsible} é responsável por esclarecer dúvidas sobre este Código e por propor sua revisão periódica. Cada versão gerada é guardada, de modo que seja possível saber qual texto estava em vigor em cada momento.`,
      ],
    },
  ],
  industryNotes: {
    construction: [
      "No setor de {{industry}}, é comum atuar em obras e contratos com o poder público e depender de licenças, vistorias e autorizações. Esses momentos exigem atenção redobrada: nenhum pagamento ou favor pode ser feito para agilizar uma licença ou liberar uma medição.",
      "Subempreiteiros, fornecedores e consórcios atuam em nome da empresa na obra. Escolha-os com critério, formalize o serviço contratado e acompanhe se ele foi de fato prestado.",
    ],
    health: [
      "No setor de {{industry}}, o relacionamento com profissionais de saúde, hospitais, operadoras e compradores públicos exige cuidado especial. Nenhuma vantagem pode ser oferecida a quem decide sobre compras, prescrições ou credenciamentos.",
      `Patrocínios de eventos, amostras e doações devem ter finalidade legítima, ser documentados e ser aprovados previamente ${PELO_RESPONSIBLE}.`,
    ],
    finance: [
      `No setor de {{industry}}, a empresa lida com recursos de terceiros e com informações sensíveis. Operações incomuns, pedidos de sigilo fora do normal ou pagamentos sem justificativa clara devem ser comunicados ${AO_RESPONSIBLE}.`,
      "Conheça seus clientes e parceiros e registre as operações com clareza; nunca ajude alguém a esconder a origem ou o destino de valores.",
    ],
  },
};
