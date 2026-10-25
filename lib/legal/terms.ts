import type { LegalDoc } from "./types";

// DRAFT (pt-BR). Written from what the product does. No statute is cited. Placeholders are visible
// and listed in lib/legal/REVIEW.md. The version in lib/legal/version.ts changes with this text
// (tests/legal.test.ts).

export const TERMS_DOC: LegalDoc = {
  title: "Termos de Uso",
  intro: [
    "Este é um texto em rascunho, ainda sem revisão jurídica. Ele explica o que o serviço é, o que ele não é e o que se espera de quem o contrata.",
    "“Empresa cliente” é a empresa que contrata o serviço. “Nós” é quem opera a plataforma.",
  ],
  sections: [
    {
      heading: "1. O que é o serviço",
      paragraphs: [
        "A plataforma ajuda a empresa cliente a montar e manter, em um só lugar, componentes documentados de um programa de integridade:",
      ],
      bullets: [
        "geração de um código de conduta e de políticas a partir de modelos, com os dados da empresa;",
        "um portal para funcionários lerem e aceitarem os documentos, fazerem o treinamento e enviarem a declaração anual de conflito de interesses;",
        "um canal de denúncias com página pública própria da empresa;",
        "um questionário para fornecedores e uma triagem em listas públicas de sanções;",
        "um dossiê em PDF que reúne o que a plataforma registrou até uma data.",
      ],
    },
    {
      heading: "2. O que o serviço não é",
      bullets: [
        "Não é aconselhamento jurídico e não substitui um advogado.",
        "Não garante que a empresa cliente cumpra qualquer lei, regra, edital, exigência de cliente ou auditoria.",
        "Não é certificação, avaliação de adequação, auditoria nem parecer. O dossiê é um compilado de registros, não uma declaração de que a empresa está em ordem.",
        "Os documentos gerados são modelos preenchidos com os dados informados, em rascunho enquanto não revisados por advogado. A empresa cliente deve revisá-los, adaptá-los à sua realidade e responder pelo uso que faz deles.",
        "A triagem de fornecedores é uma ferramenta de consulta a listas públicas, não uma investigação de due diligence. Um resultado sem ocorrências não significa que o fornecedor seja seguro, e um resultado com possível ocorrência exige análise humana.",
      ],
    },
    {
      heading: "3. Conta e administrador",
      paragraphs: [
        "Cada empresa cliente tem um administrador. O acesso é por um link enviado ao e-mail do administrador, sem senha. Quem controla esse e-mail controla a conta; proteja-o.",
        "A empresa cliente responde pelo que é feito com a conta. Funcionários e fornecedores não têm conta: acessam por links pessoais enviados pelo administrador.",
      ],
    },
    {
      heading: "4. Uso aceitável",
      bullets: [
        "Use o serviço apenas para fins legítimos e de acordo com a lei.",
        "Cadastre somente dados de pessoas que a empresa cliente pode cadastrar, e informe os funcionários sobre o que é registrado (por exemplo, o endereço IP no aceite de documentos).",
        "Não tente acessar dados de outra empresa cliente, nem testar, sobrecarregar ou contornar as proteções da plataforma.",
        "Não use o canal de denúncias para fins diferentes de receber relatos, nem tente identificar quem denunciou de forma anônima.",
      ],
    },
    {
      heading: "5. Dados da empresa cliente",
      paragraphs: [
        "Os dados que a empresa cliente cadastra continuam sendo dela. Ela é responsável por ter o direito de cadastrá-los e por informar as pessoas envolvidas. Como tratamos dados pessoais está na Política de Privacidade.",
      ],
    },
    {
      heading: "6. Preços, pagamento, cancelamento e reembolso",
      paragraphs: [
        "Preços e forma de cobrança: [PREÇOS E FORMA DE COBRANÇA — a definir].",
        "O pagamento é feito por um processador de pagamentos; os dados do cartão não passam por nós.",
        "Cancelamento e reembolso: [CANCELAMENTO E REEMBOLSO — a definir].",
      ],
    },
    {
      heading: "7. Limites do serviço",
      paragraphs: [
        "O serviço pode ficar indisponível por manutenção ou por falhas, e não prometemos um nível de disponibilidade. Existem limites de uso, por exemplo para triagens de fornecedores, envio de convites e geração de dossiês por dia. Novas funções podem ser incluídas e funções podem mudar.",
      ],
    },
    {
      heading: "8. Responsabilidade",
      paragraphs: [
        "[LIMITAÇÃO DE RESPONSABILIDADE — a definir pelo advogado].",
      ],
    },
    {
      heading: "9. Lei aplicável e foro",
      paragraphs: ["[LEI APLICÁVEL E FORO — a definir pelo advogado]."],
    },
    {
      heading: "10. Mudanças nestes termos",
      paragraphs: [
        "Podemos mudar estes termos, principalmente depois da revisão jurídica. A versão e a data ficam no fim da página. Quando o texto mudar, a versão muda, e a aceitação registrada na compra mostra qual versão foi aceita.",
      ],
    },
    {
      heading: "11. Contato",
      paragraphs: [
        "Razão social: [RAZÃO SOCIAL — a preencher]. CNPJ: [CNPJ — a preencher]. E-mail de suporte: [E-MAIL DE SUPORTE — a preencher].",
      ],
    },
  ],
};
