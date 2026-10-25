import type { LegalDoc } from "./types";

// DRAFT (pt-BR). Written from what the product actually does (code, schema, README), not from a
// legal source. The only statute named is the LGPD by name; no article numbers, no decrees, no other
// laws. Every assumption is listed in lib/legal/REVIEW.md. Editing this text requires a new version
// in lib/legal/version.ts (tests/legal.test.ts enforces it).

export const PRIVACY_DOC: LegalDoc = {
  title: "Política de Privacidade",
  intro: [
    "Este é um texto em rascunho, ainda sem revisão jurídica. Ele explica, em linguagem simples, quais dados pessoais a plataforma trata, para quê, com quem compartilha e como você pode falar conosco.",
    "A plataforma é um serviço para empresas. Quando falamos em “empresa cliente”, falamos da empresa que contrata o serviço. “Nós” é quem opera a plataforma.",
  ],
  sections: [
    {
      heading: "1. Quem somos",
      paragraphs: [
        "Razão social: [RAZÃO SOCIAL — a preencher]. CNPJ: [CNPJ — a preencher]. Endereço: [ENDEREÇO — a preencher].",
        "Contato de privacidade (encarregado pelo tratamento de dados pessoais): [ENCARREGADO / CONTATO DE PRIVACIDADE — a preencher]. E-mail de suporte: [E-MAIL DE SUPORTE — a preencher].",
        "Para os dados do site, do cadastro e da cobrança da empresa cliente, nós decidimos como os dados são usados. Para os dados que a empresa cliente cadastra sobre seus funcionários, fornecedores e denunciantes, entendemos que é a empresa cliente quem decide como usá-los e nós os tratamos para prestar o serviço. Essa divisão de papéis ainda será confirmada na revisão jurídica.",
      ],
    },
    {
      heading: "2. Quais dados tratamos",
      bullets: [
        "Visitantes do site: país e idioma escolhidos, a escolha sobre cookies e, só se você aceitar cookies de análise, dados de origem da visita (campanha, fonte e meio). Não pedimos cadastro para navegar.",
        "Lista de espera: o e-mail e o país que você informa no formulário.",
        "Compra e conta da empresa cliente: nome da empresa, CNPJ, e-mail de cobrança, valor e data do pagamento e o e-mail do administrador da conta. Os dados do cartão são tratados pelo processador de pagamentos e não passam por nós.",
        "Funcionários da empresa cliente: nome e e-mail enviados pelo administrador; a data e o registro de leitura e aceite de cada documento, junto com o endereço IP do aparelho no momento do aceite; o resultado do treinamento (aprovação e nota); e, quando houver, a declaração anual de conflito de interesses, guardada cifrada.",
        "Fornecedores: nome, e, se informados, país, número de identificação fiscal e contato; as respostas do questionário (guardadas cifradas); e o resultado de triagens de sanções e pessoas politicamente expostas feitas pelo administrador.",
        "Canal de denúncias: o texto da denúncia, o contato (somente se o denunciante optar por informá-lo), as anotações do caso e as imagens de evidência, tudo guardado cifrado. Veja a seção 6.",
        "Documentos e dossiê: os documentos gerados para a empresa cliente e o arquivo PDF do dossiê, com nomes, datas e estados de cada registro.",
        "Registros técnicos de funcionamento do servidor, que podem incluir endereço IP e dados da requisição, mantidos pela hospedagem e pelos serviços de rede que usamos.",
      ],
    },
    {
      heading: "3. Para que usamos os dados",
      bullets: [
        "Prestar o serviço contratado: criar a conta, gerar documentos, enviar convites e links, registrar leituras e aceites, aplicar treinamentos, receber denúncias, triar fornecedores e montar o dossiê.",
        "Cobrar e confirmar pagamentos.",
        "Enviar e-mails do serviço: link de acesso, boas-vindas, convites a funcionários e fornecedores e avisos de denúncia recebida.",
        "Manter a segurança e o funcionamento da plataforma.",
        "Entender, se você aceitar cookies de análise, de onde vêm as visitas e se a página de preços e a compra funcionam.",
        "Cumprir obrigações legais quando exigido.",
      ],
      paragraphs: [
        "As bases legais de cada uso serão indicadas na versão revisada deste texto.",
      ],
    },
    {
      heading: "4. Cookies e tecnologias parecidas",
      paragraphs: [
        "Usamos cookies que o serviço precisa para funcionar e outros que dependem da sua escolha. Você pode aceitar ou rejeitar os cookies opcionais na faixa que aparece no site.",
      ],
      bullets: [
        "country e lang (1 ano): lembram o país e o idioma que você escolheu.",
        "consent (1 ano): guarda a sua escolha sobre cookies.",
        "utm (30 dias): guarda a origem da visita (campanha, fonte e meio), somente depois de você aceitar cookies.",
        "Cookie de sessão da conta: mantém o administrador conectado depois de entrar com o link enviado por e-mail.",
        "return_token (24 horas): liga a volta do pagamento ao navegador que iniciou a compra.",
        "employee_session (8 horas): mantém o funcionário conectado ao portal depois de abrir o link pessoal.",
        "Análise de visitas: se e quando ativarmos o Google Tag Manager e o Google Analytics, eles só serão carregados depois de você aceitar cookies, e nunca no canal de denúncias, na área da conta, no portal do funcionário, no questionário de fornecedores nem nas páginas de entrada e de cadastro inicial. Se você retirar o consentimento, nenhum novo evento é enviado.",
      ],
    },
    {
      heading: "5. Com quem compartilhamos",
      paragraphs: [
        "Compartilhamos dados apenas com quem precisamos para prestar o serviço. Não vendemos dados pessoais.",
      ],
      bullets: [
        "A empresa cliente: o administrador da conta vê os dados da própria empresa, incluindo os registros de funcionários, as denúncias recebidas pelo canal da empresa e os fornecedores cadastrados. Nunca vê dados de outra empresa.",
        "Provedor de hospedagem: os servidores onde a plataforma e o banco de dados funcionam.",
        "Provedor de e-mail: recebe o endereço do destinatário e o conteúdo das mensagens do serviço (por exemplo, links de acesso e convites).",
        "Processador de pagamentos: recebe os dados da compra e do pagamento; os dados do cartão ficam com ele.",
        "Provedor de triagem de sanções: recebe o nome do fornecedor e, se informado, o código do país, quando o administrador pede uma triagem. Não enviamos CNPJ, e-mail nem respostas do questionário.",
        "Serviço de rede e proteção (CDN/proxy), quando usado: pode ver o tráfego do site, incluindo endereços IP.",
        "Ferramentas de análise, somente após o seu consentimento e quando estiverem ativas.",
        "Autoridades, quando houver obrigação legal ou ordem válida.",
      ],
    },
    {
      heading: "6. Canal de denúncias",
      paragraphs: [
        "O canal de denúncias de cada empresa cliente pode ser usado sem cadastro e sem identificação. Em condições normais, o que a plataforma faz é o seguinte:",
      ],
      bullets: [
        "O formulário e o servidor da plataforma não guardam o endereço IP, o navegador ou outros dados do seu aparelho junto com a denúncia, e o canal não define cookies.",
        "Você só informa um contato se quiser ser contatado. Sem isso, a denúncia é anônima para a plataforma.",
        "O texto da denúncia, o contato opcional, as anotações do caso e as imagens de evidência são guardados cifrados. Das imagens, removemos os metadados (como local e data de captura) antes de cifrar.",
        "Você recebe um código de acompanhamento para consultar a resposta. Guarde esse código: ele não pode ser recuperado.",
        "A empresa cliente decide o que fazer com a denúncia. Se a pessoa denunciada for o próprio administrador da conta, essa situação ainda precisa ser tratada (veja o arquivo de revisão).",
      ],
    },
    {
      heading: "6.1 O que isso não significa",
      paragraphs: [
        "A hospedagem, os serviços de rede e o provedor de internet podem manter registros técnicos de acesso que estão fora do controle do aplicativo. Por isso, não descrevemos o canal como impossível de rastrear. Se o seu caso exige anonimato forte, use uma rede e um aparelho que você considere seguros.",
      ],
    },
    {
      heading: "7. Transferências internacionais",
      paragraphs: [
        "Alguns prestadores podem guardar ou processar dados fora do Brasil. [TRANSFERÊNCIAS INTERNACIONAIS: países e mecanismo jurídico — a definir pelo advogado].",
      ],
    },
    {
      heading: "8. Por quanto tempo guardamos os dados",
      paragraphs: [
        "Hoje não há exclusão automática dos dados da empresa cliente, dos funcionários, dos fornecedores, das denúncias e dos registros de aceite. Os prazos de guarda ainda serão definidos: [PRAZOS DE RETENÇÃO — a definir]. A única limpeza automática é a de sessões e códigos de acesso vencidos.",
        "Alguns registros são feitos para não serem alterados nem apagados (por exemplo, registros de aceite, treinamentos concluídos, declarações, respostas de fornecedores, o histórico de casos de denúncia e dossiês prontos). Pedidos de exclusão serão analisados considerando isso.",
      ],
    },
    {
      heading: "9. Como protegemos os dados",
      paragraphs: [
        "Tomamos medidas como estas: o acesso do administrador é por link enviado ao e-mail, sem senha; os links de funcionários e fornecedores são pessoais, de uso único e guardados apenas na forma de resumo criptográfico; dados sensíveis (denúncias, evidências, declarações e respostas de fornecedores) são cifrados no banco; cada empresa só acessa os próprios dados; fazemos cópias de segurança do banco de dados. Nenhuma medida elimina todo o risco.",
      ],
    },
    {
      heading: "10. Seus direitos",
      paragraphs: [
        "Nos termos da LGPD, você pode pedir, em linguagem simples:",
      ],
      bullets: [
        "saber se tratamos dados seus e ter acesso a eles;",
        "corrigir dados incompletos, errados ou desatualizados;",
        "pedir a exclusão ou o bloqueio de dados desnecessários ou tratados de forma indevida, quando isso for cabível;",
        "pedir uma cópia dos dados em formato que permita levá-los a outro serviço;",
        "saber com quem compartilhamos seus dados;",
        "retirar o consentimento que deu, como o de cookies de análise;",
        "pedir revisão de decisões tomadas apenas por meios automatizados, se houver. Hoje a plataforma não toma decisões automatizadas sobre pessoas.",
      ],
    },
    {
      heading: "11. Como pedir",
      paragraphs: [
        "Escreva para [ENCARREGADO / CONTATO DE PRIVACIDADE — a preencher] ou para [E-MAIL DE SUPORTE — a preencher]. Se os seus dados foram cadastrados por uma empresa cliente (por exemplo, você é funcionário ou fornecedor dela), o primeiro contato deve ser a própria empresa, que decide sobre esses dados; podemos ajudá-la a atender o seu pedido.",
        "Podemos precisar confirmar a sua identidade antes de atender o pedido. No canal de denúncias anônimo não temos como localizar uma denúncia sem o código de acompanhamento.",
      ],
    },
    {
      heading: "12. Menores de idade",
      paragraphs: [
        "O serviço é para empresas e não é dirigido a menores de 18 anos.",
      ],
    },
    {
      heading: "13. Mudanças neste texto",
      paragraphs: [
        "Este texto pode mudar, principalmente depois da revisão jurídica. A versão e a data ficam no fim da página.",
      ],
    },
  ],
};
