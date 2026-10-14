import type { DocumentTemplate } from "../../types";
import { AO_RESPONSIBLE, RESPONSIBLE, legalContext } from "./shared";

export const whistleblowerProtection: DocumentTemplate = {
  type: "policy:whistleblower_protection",
  version: 1,
  title: "Política de Proteção ao Denunciante",
  sections: [
    {
      id: "purpose",
      heading: "Objetivo",
      paragraphs: [
        "Esta Política garante que quem relatar, de boa-fé, uma suspeita de violação do Código de Conduta ou das políticas de {{companyName}} possa fazê-lo com segurança e sem medo de represálias. Ela existe como documento próprio, separado do canal de denúncias em si.",
      ],
    },
    {
      id: "scope",
      heading: "Quem pode relatar e o que pode ser relatado",
      paragraphs: [
        "Qualquer pessoa pode relatar: empregados, sócios, administradores, fornecedores, clientes e terceiros. Podem ser relatados fatos ou suspeitas de corrupção, suborno, fraude, conflito de interesses, assédio, discriminação e outras violações do Código de Conduta ou das políticas da empresa.",
      ],
    },
    {
      id: "good-faith",
      heading: "Boa-fé",
      paragraphs: [
        "Proteção é dada a quem relata de boa-fé, ou seja, acreditando honestamente que as informações são verdadeiras, mesmo que a suspeita não seja confirmada. Acusações feitas sabendo que são falsas não são relatos de boa-fé e podem levar a medidas disciplinares.",
      ],
    },
    {
      id: "channels",
      heading: "Como relatar",
      paragraphs: [
        `Os relatos podem ser feitos ao canal de denúncias da empresa, ${AO_RESPONSIBLE} ou à liderança. O canal de denúncias permite relatos de forma anônima. Quem preferir se identificar pode informar um contato para receber retorno.`,
      ],
    },
    {
      id: "anonymity",
      heading: "Anonimato e confidencialidade",
      paragraphs: [
        "Quem escolher o anonimato não será obrigado a se identificar, e a empresa não buscará descobrir a identidade de quem relata de forma anônima. Quando o relato for identificado, a identidade de quem relatou será tratada com confidencialidade e compartilhada apenas com quem precisar saber para apurar o caso ou quando houver obrigação legal.",
        "Os dados pessoais envolvidos nos relatos são usados apenas para a apuração dos fatos e tratados com as medidas de segurança adequadas.",
      ],
    },
    {
      id: "non-retaliation",
      heading: "Proibição de retaliação",
      paragraphs: [
        "É proibida qualquer forma de retaliação contra quem relata, de boa-fé, uma preocupação, ou contra quem colabora com uma apuração. Isso inclui demissão, rebaixamento, mudança injustificada de função ou de turno, isolamento, ameaça, perseguição e qualquer outro tratamento desfavorável.",
        `Quem acreditar que sofreu retaliação deve comunicar imediatamente ${AO_RESPONSIBLE} ou usar o canal de denúncias. Esses casos serão apurados como violação grave desta Política.`,
      ],
    },
    {
      id: "handling",
      heading: "Como os relatos são tratados",
      paragraphs: [
        "Todo relato recebido é registrado e analisado de forma imparcial por pessoas sem conflito de interesses com o caso. A apuração busca reunir os fatos, ouvir as partes envolvidas, respeitando seu direito de se manifestar, e concluir com as medidas cabíveis.",
        "Sempre que houver meio de contato, quem relatou receberá retorno sobre o andamento, dentro do que for possível sem prejudicar a apuração ou os direitos de terceiros.",
      ],
    },
    {
      id: "responsibilities",
      heading: "Responsabilidades",
      paragraphs: [
        `A Administração apoia esta Política e garante que ${RESPONSIBLE} tenha independência e recursos para apurar os casos. Líderes devem encaminhar imediatamente os relatos que receberem e nunca tentar identificar quem relatou.`,
      ],
    },
    legalContext,
  ],
};
