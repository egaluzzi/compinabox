// Training module data (phase 6) — pt-BR only, DRAFT. This is content, not logic: it is reviewed
// as a document (lib/training/REVIEW.md). Rules it must keep (CLAUDE.md §8, SUPERVISOR_NOTES):
// no statute, article or decree is named — it points to "o código de conduta e as políticas da
// empresa"; no sentence says the employee, the company or the training makes anyone compliant,
// certified, protected from liability or legally covered. tests/training-content.test.ts and
// verify.sh's forbidden-claims check enforce the wording.

export const MODULE_ID = "anticorruption-pt-BR-v1";
export const TRAINING_LOCALE = "pt-BR" as const;
export const PASS_FRACTION = 0.8;
export const OPTIONS_PER_QUESTION = 4;

export type Lesson = {
  n: number;
  title: string;
  /** Rough reading time, shown in the overview. */
  minutes: number;
  paragraphs: string[];
  scenario: { title: string; text: string; whatToDo: string[] };
};

export type Question = {
  id: string;
  lesson: number;
  prompt: string;
  options: [string, string, string, string];
  /** Index into `options`. NEVER sent to the browser (see publicQuestions). */
  correct: 0 | 1 | 2 | 3;
  explanation: string;
};

export const LESSONS: Lesson[] = [
  {
    n: 1,
    title: "O código de conduta: o essencial",
    minutes: 3,
    paragraphs: [
      "O código de conduta da sua empresa descreve como todas as pessoas que trabalham nela devem agir no dia a dia: com honestidade, respeito e transparência. Ele vale para todos, da direção ao primeiro dia de estágio, e também orienta como a empresa se relaciona com clientes, fornecedores e órgãos públicos.",
      "Um código de conduta não tenta prever todas as situações. Ele dá princípios e exemplos para que cada pessoa consiga decidir bem quando a situação for nova. Por isso, o primeiro passo diante de uma dúvida é reler o código e as políticas da empresa, e o segundo é perguntar a quem for responsável por eles antes de agir, e não depois.",
      "Três ideias sustentam o código. Primeira: negócios se ganham por qualidade, preço e serviço, nunca por vantagens indevidas. Segunda: interesses pessoais não devem influenciar decisões que pertencem à empresa. Terceira: preocupações devem poder ser levantadas sem medo, e a empresa não admite retaliação contra quem relata algo de boa-fé.",
      "Seguir o código também significa registrar as coisas com exatidão. Despesas, contratos e acordos precisam ser descritos como realmente aconteceram. Registrar algo de forma incorreta, mesmo que o valor seja pequeno, esconde o problema em vez de resolvê-lo e dificulta que a empresa perceba um risco a tempo.",
      "Uma boa regra prática é fazer três perguntas antes de uma decisão delicada: eu me sentiria à vontade se isso fosse contado ao meu gestor? Eu me sentiria à vontade se aparecesse em uma conversa com um cliente? Isso está de acordo com o que o código de conduta e as políticas da empresa dizem? Se alguma resposta for não, pare e peça orientação.",
      "Ao aceitar o código, você declara que o leu e que entende que ele se aplica ao seu trabalho. Isso não exige que você conheça cada detalhe de cabeça. Exige que saiba onde encontrar o documento, que o consulte quando precisar e que peça ajuda em caso de dúvida.",
    ],
    scenario: {
      title: 'Uma exceção "só desta vez"',
      text: 'Marina trabalha no setor de compras. Perto do fim do mês, o gestor pede que ela registre uma despesa de um jantar com um cliente como "material de escritório", porque a categoria correta já estourou o orçamento. Ele diz que é só desta vez e que ninguém vai notar.',
      whatToDo: [
        "Não registrar a despesa com uma descrição que não corresponde ao que aconteceu.",
        "Explicar com calma ao gestor que o registro precisa refletir a realidade e perguntar como pedir uma aprovação adicional de orçamento.",
        "Se o pedido se repetir ou ela se sentir pressionada, usar o canal de denúncias, que pode ser anônimo.",
      ],
    },
  },
  {
    n: 2,
    title: "Suborno e vantagens indevidas",
    minutes: 3,
    paragraphs: [
      "Suborno é oferecer, prometer, dar, pedir ou aceitar qualquer vantagem indevida para influenciar uma decisão ou obter um tratamento favorável. A política da empresa proíbe isso em qualquer forma, com qualquer pessoa, em qualquer lugar, e vale tanto quando a vantagem é pedida como quando é oferecida por iniciativa própria.",
      "A vantagem não precisa ser dinheiro. Pode ser um presente caro, uma viagem, um emprego para um parente, um desconto pessoal, um favor, uma doação ou um patrocínio que não tenha finalidade legítima. O que importa é a intenção e o efeito: se a vantagem busca influenciar uma decisão, ela é indevida.",
      "Também não importa se o pagamento é feito diretamente ou por meio de outra pessoa. Contratar um intermediário, um despachante ou um consultor sabendo, ou suspeitando, que parte do valor será usada para pagar uma vantagem indevida é tratado pela política como se a própria empresa tivesse feito o pagamento.",
      'Alguns sinais de alerta merecem atenção: comissões muito acima do praticado no mercado, pedidos de pagamento em dinheiro vivo ou em conta de terceiros, notas com descrições vagas, pressa fora do normal para fechar um negócio e pedidos para que algo "não fique registrado". Nenhum desses sinais prova um problema, mas todos pedem que você pare e consulte.',
      "O que fazer ao receber um pedido de vantagem? Recusar de forma clara e educada, não negociar, anotar o que foi dito, quando e por quem, e avisar a pessoa responsável pelo programa de integridade da empresa ou usar o canal de denúncias. Contar rapidamente é sempre melhor do que tentar resolver sozinho.",
      "Lembre-se de que a pressão por resultados nunca justifica uma vantagem indevida. A empresa prefere perder um negócio a ganhá-lo de forma incorreta, e ninguém será prejudicado por recusar um pedido desse tipo.",
    ],
    scenario: {
      title: "A taxa de agilização",
      text: 'Carlos coordena a logística e um despachante propõe uma "taxa de agilização" em dinheiro, sem nota, para liberar uma carga parada. Segundo o despachante, uma parte do valor vai para quem decide a liberação, e isso é como as coisas funcionam por lá.',
      whatToDo: [
        "Recusar o pagamento e não contratar o despachante nessas condições.",
        "Registrar por escrito o que foi proposto, quando e por quem.",
        "Informar imediatamente a pessoa responsável pelo programa de integridade e aguardar orientação antes de qualquer nova conversa.",
      ],
    },
  },
  {
    n: 3,
    title: "Presentes, brindes e hospitalidade",
    minutes: 3,
    paragraphs: [
      'Trocar pequenas gentilezas faz parte das relações de negócio, mas presentes e hospitalidade podem se tornar um problema quando criam a impressão de que alguém está sendo "comprado". A política de presentes da empresa define o que pode ser aceito ou oferecido, os limites de valor e quando é preciso pedir aprovação.',
      "Como regra geral, é aceitável um brinde de baixo valor, com a marca da empresa, dado em uma ocasião normal, como uma agenda ou uma caneta. Não é aceitável dinheiro ou equivalentes, como cartões-presente, nem algo que chegue durante uma negociação, uma concorrência ou uma renovação de contrato, quando a decisão ainda está em aberto.",
      "Para refeições, eventos e viagens, o critério é a finalidade e a proporção. Um almoço de trabalho de valor razoável, com a presença de quem oferece, costuma ser aceitável. Uma viagem com hospedagem para a família de um cliente, não. Se o convite não tem relação clara com o negócio, ou se o valor chamaria atenção, ele provavelmente não é adequado.",
      "Com agentes públicos, as regras são mais rígidas. Em geral, a política da empresa não admite oferecer presentes ou hospitalidade a pessoas que exercem função pública, a não ser nos casos expressamente previstos e aprovados com antecedência. Na dúvida, a resposta é não oferecer.",
      "Se você receber um presente que não pode aceitar, devolva com um bilhete educado explicando a política da empresa. Se a devolução não for possível, entregue o item à pessoa responsável pelo programa de integridade, que decidirá o que fazer. Presentes aceitos acima do limite, ou oferecidos pela empresa, devem ser registrados conforme a política.",
      "Transparência é o melhor teste: se você hesitaria em contar a um colega ou ao seu gestor sobre o presente ou o convite, é um sinal de que ele não deve ser aceito ou oferecido sem consulta.",
    ],
    scenario: {
      title: "O convite durante a concorrência",
      text: "Uma fornecedora que está participando de uma concorrência da sua empresa convida Paulo, que integra a equipe de avaliação, para um jantar em um restaurante sofisticado e oferece pagar o transporte. A decisão será anunciada na próxima semana.",
      whatToDo: [
        "Recusar o convite com cordialidade, explicando que a política da empresa não permite aceitar hospitalidade durante uma concorrência.",
        "Informar o gestor e a pessoa responsável pelo programa de integridade sobre o convite.",
        "Manter toda a comunicação com a fornecedora pelos canais formais do processo.",
      ],
    },
  },
  {
    n: 4,
    title: "Conflitos de interesse",
    minutes: 3,
    paragraphs: [
      "Há conflito de interesse quando um interesse pessoal, familiar ou financeiro seu pode influenciar, ou parecer influenciar, uma decisão que você toma em nome da empresa. Ter um conflito não é, por si só, um erro. O erro está em não contar a ninguém e em decidir como se ele não existisse.",
      "Exemplos comuns: contratar ou escolher como fornecedor uma empresa de um parente ou amigo próximo; ter participação relevante em um concorrente, cliente ou fornecedor; supervisionar diretamente alguém com quem você tem um relacionamento pessoal; ter um segundo trabalho que compete com a empresa ou consome o tempo e as informações dela.",
      "O que se pede é simples: declare. Quando você percebe uma possível situação de conflito, informe seu gestor e a pessoa responsável pelo programa de integridade, de preferência por escrito e o quanto antes. Em muitos casos, o conflito é resolvido afastando você daquela decisão específica, sem nenhum prejuízo para o seu trabalho.",
      "Enquanto a situação não for avaliada, não participe da decisão e não use sua posição ou informações da empresa para beneficiar a si mesmo ou a outra pessoa. Isso vale também para oportunidades de negócio que você descobriu por causa do seu cargo.",
      'A empresa pede uma declaração anual de conflitos de interesse. Ela existe para que todos tenham a chance de registrar, em um momento regular, qualquer situação que possa afetar sua independência. Responder "não tenho nada a declarar" é uma resposta válida quando é verdadeira, e se algo mudar durante o ano, avise sem esperar a próxima declaração.',
      "Lembre-se de que a aparência também importa. Mesmo quando você tem certeza de que agiria de forma justa, uma situação que parece favorecer alguém próximo pode minar a confiança de colegas, clientes e fornecedores. Declarar protege a todos, inclusive você.",
    ],
    scenario: {
      title: "A empresa do cunhado",
      text: "Renata está escolhendo quem fará a reforma do escritório. A proposta com melhor preço é da empresa do seu cunhado. Ninguém na empresa sabe do parentesco, e ela tem certeza de que o preço é justo.",
      whatToDo: [
        "Informar o gestor e a pessoa responsável pelo programa de integridade sobre o parentesco antes de qualquer decisão.",
        "Não participar da avaliação nem da escolha entre as propostas.",
        "Deixar que outra pessoa conduza o processo, seguindo as regras normais de comparação de propostas.",
      ],
    },
  },
  {
    n: 5,
    title: "Relacionamento com agentes públicos e terceiros",
    minutes: 3,
    paragraphs: [
      "Agentes públicos são pessoas que exercem função em órgãos do governo, empresas estatais ou outras entidades públicas, mesmo que de forma temporária ou sem remuneração. O relacionamento com eles exige cuidado extra, porque uma vantagem oferecida a quem decide em nome do poder público pode ser vista como uma tentativa de influenciar essa decisão.",
      "A regra de conduta da empresa é clara: nenhuma vantagem, de nenhum valor, deve ser oferecida a um agente público para obter ou manter um negócio, acelerar um procedimento ou evitar uma consequência. Isso inclui pagamentos pequenos e informais. Se uma taxa oficial é cobrada, ela deve ter recibo, tabela e destino claros.",
      "Reuniões com agentes públicos devem ser tratadas com transparência. Sempre que possível, participe acompanhado de um colega, registre quem esteve presente e o que foi tratado, e conduza os contatos por canais oficiais. Evite conversas em locais informais sobre assuntos que dependem de uma decisão pública.",
      "Terceiros — como despachantes, consultores, representantes e parceiros — podem agir em nome da empresa e, por isso, também exigem atenção. Antes de contratar um, confirme quem ele é, o que fará, por qual valor e se o preço é compatível com o serviço. Contratos devem ser escritos, e os pagamentos devem ir para uma conta em nome do próprio contratado.",
      "Acompanhe o trabalho dos terceiros depois da contratação. Se perceber pedidos de pagamento incomuns, resistência em prestar informações ou resultados rápidos demais, comunique à pessoa responsável pelo programa de integridade. A empresa espera que você preste atenção ao que os terceiros fazem em seu nome.",
      "Se um agente público fizer um pedido que pareça indevido, não ceda e não discuta. Encerre a conversa com educação, anote o que aconteceu e avise a empresa o mais rápido possível pelos canais indicados na política.",
    ],
    scenario: {
      title: "A licença que não sai",
      text: 'Juliana acompanha um pedido de licença junto a um órgão público. Um funcionário do órgão sugere que o processo poderia andar mais rápido se a empresa "colaborasse" com um pagamento por fora. Ele afirma que outras empresas já fizeram o mesmo.',
      whatToDo: [
        "Recusar com clareza e educação, sem prometer nada e sem negociar.",
        "Anotar data, local, o que foi dito e quem estava presente.",
        "Comunicar imediatamente a pessoa responsável pelo programa de integridade e seguir a orientação dela sobre como continuar o processo pelos canais oficiais.",
      ],
    },
  },
  {
    n: 6,
    title: "Falar é seguro: canal de denúncias e não retaliação",
    minutes: 3,
    paragraphs: [
      "Nenhuma política funciona se as pessoas não se sentirem à vontade para levantar preocupações. Por isso, a empresa mantém um canal de denúncias confidencial, aberto a funcionários, fornecedores e outras pessoas. Você pode relatar uma situação de forma anônima ou deixar seus dados de contato, e a escolha é sua.",
      "O que relatar? Qualquer situação que você acredite, de boa-fé, ser contrária ao código de conduta ou às políticas da empresa: suspeita de suborno, fraude, conflito de interesse não declarado, assédio ou qualquer outra conduta que preocupe. Você não precisa ter provas nem certeza; precisa apenas estar sendo sincero sobre o que viu ou soube.",
      "Ao fazer um relato, descreva o que aconteceu com o máximo de detalhes úteis: o que, quando, onde e quem estava envolvido. Evite investigar por conta própria, confrontar a pessoa envolvida ou compartilhar a suspeita com colegas. Isso pode prejudicar a apuração e colocar você em uma situação difícil.",
      "Depois de enviar, guarde o código de acompanhamento. Ele permite consultar o andamento do caso sem revelar sua identidade. O canal mostra apenas o status geral, como recebida, em análise ou encerrada, e a empresa se compromete a revisar cada relato recebido.",
      "A política da empresa não admite retaliação contra quem faz um relato de boa-fé ou colabora com uma apuração. Retaliação inclui demissão, rebaixamento, mudança injustificada de tarefas, isolamento, ameaças ou qualquer outro tratamento desfavorável em resposta ao relato. Se você sofrer ou presenciar algo assim, relate também.",
      "Também faz parte da conduta esperada não tentar descobrir quem fez um relato anônimo e manter sigilo sobre o que souber de uma apuração em andamento. Um ambiente em que as pessoas falam sem medo ajuda a empresa a corrigir problemas cedo.",
    ],
    scenario: {
      title: "O que fazer com uma suspeita",
      text: "André percebe que um colega do financeiro aprova repetidamente pagamentos para um mesmo fornecedor sem cotação, e a empresa do fornecedor tem o mesmo endereço do colega. Ele não tem certeza de que há algo errado e teme prejudicar alguém inocente.",
      whatToDo: [
        "Relatar o que observou pelo canal de denúncias ou à pessoa responsável pelo programa de integridade, sem acusar ninguém e sem confrontar o colega.",
        "Descrever fatos concretos (datas, valores, o que notou) em vez de conclusões.",
        "Guardar o código de acompanhamento e não comentar o assunto com outros colegas.",
      ],
    },
  },
];

export const QUESTIONS: Question[] = [
  {
    id: "q1",
    lesson: 1,
    prompt:
      "Você tem uma dúvida sobre como agir em uma situação que o código de conduta não descreve exatamente. O que fazer primeiro?",
    options: [
      "Decidir sozinho, porque o código não cobre o caso.",
      "Reler o código e as políticas da empresa e pedir orientação antes de agir.",
      "Agir e perguntar depois, se alguém reclamar.",
      "Esperar que outra pessoa tome a decisão.",
    ],
    correct: 1,
    explanation:
      "O código dá princípios para situações novas, e pedir orientação antes de agir evita problemas difíceis de desfazer.",
  },
  {
    id: "q2",
    lesson: 1,
    prompt:
      'Seu gestor pede que você registre uma despesa com uma descrição diferente do que realmente aconteceu, "só desta vez". Qual é a atitude adequada?',
    options: [
      "Registrar como pedido, pois ele é seu gestor.",
      "Registrar como pedido, mas guardar uma anotação pessoal.",
      "Não registrar de forma incorreta, explicar a preocupação e, se necessário, usar o canal de denúncias.",
      "Registrar como pedido se o valor for pequeno.",
    ],
    correct: 2,
    explanation:
      "Os registros precisam refletir a realidade, qualquer que seja o valor, e o canal de denúncias existe para pressões desse tipo.",
  },
  {
    id: "q3",
    lesson: 2,
    prompt:
      "Qual das alternativas pode ser uma vantagem indevida, segundo a política da empresa?",
    options: [
      "Apenas dinheiro em espécie.",
      "Apenas pagamentos acima de um valor alto.",
      "Qualquer benefício oferecido para influenciar uma decisão, como um emprego para um parente ou uma viagem.",
      "Somente o que é entregue diretamente à pessoa que decide.",
    ],
    correct: 2,
    explanation:
      "A vantagem pode assumir muitas formas, e o que importa é a intenção de influenciar uma decisão.",
  },
  {
    id: "q4",
    lesson: 2,
    prompt:
      'Um intermediário pede uma comissão muito acima do normal, em dinheiro e sem nota, "para agilizar" um processo. Como você deve reagir?',
    options: [
      "Pagar, porque o risco é de quem recebe.",
      "Pagar apenas metade do valor.",
      "Pedir que ele resolva sem contar os detalhes.",
      "Recusar, anotar o que foi pedido e avisar a pessoa responsável pelo programa de integridade.",
    ],
    correct: 3,
    explanation:
      "Pagamentos incomuns por meio de terceiros são um sinal de alerta, e a política trata o pagamento por intermediário como se fosse da própria empresa.",
  },
  {
    id: "q5",
    lesson: 3,
    prompt:
      "Um fornecedor que participa de uma concorrência em andamento convida você para um jantar caro. O que a política orienta?",
    options: [
      "Aceitar, desde que você pague a própria parte depois.",
      "Recusar com cordialidade e informar o gestor e a pessoa responsável pelo programa de integridade.",
      "Aceitar, desde que não se fale de negócios.",
      "Aceitar, desde que o convite seja por escrito.",
    ],
    correct: 1,
    explanation:
      "Hospitalidade durante uma concorrência pode parecer uma tentativa de influenciar a decisão e deve ser recusada e comunicada.",
  },
  {
    id: "q6",
    lesson: 3,
    prompt:
      "Você recebe em casa um presente de valor alto de um cliente, sem aviso. O que fazer?",
    options: [
      "Ficar com ele, pois já foi entregue.",
      "Devolver com um bilhete educado explicando a política ou entregá-lo à pessoa responsável pelo programa de integridade.",
      "Dar a um familiar para que não seja seu.",
      "Guardar e não contar a ninguém.",
    ],
    correct: 1,
    explanation:
      "Presentes que não podem ser aceitos devem ser devolvidos ou entregues à pessoa responsável, de forma transparente.",
  },
  {
    id: "q7",
    lesson: 4,
    prompt:
      "Qual é a atitude esperada ao perceber um possível conflito de interesse?",
    options: [
      "Resolver sozinho, para não incomodar ninguém.",
      "Aguardar para ver se alguém percebe.",
      "Declarar o quanto antes ao gestor e à pessoa responsável pelo programa de integridade, de preferência por escrito.",
      "Declarar somente se a decisão favorecer a outra pessoa.",
    ],
    correct: 2,
    explanation:
      "Ter um conflito não é o erro; o erro é não declará-lo, e muitas vezes basta afastar-se da decisão específica.",
  },
  {
    id: "q8",
    lesson: 4,
    prompt:
      "A melhor proposta para um serviço vem da empresa de um parente seu. O que você deve fazer?",
    options: [
      "Escolher a proposta, já que o preço é o melhor.",
      "Escolher outra proposta para não ter problemas.",
      "Não participar da decisão e informar o parentesco antes de qualquer escolha.",
      "Participar da decisão, mas não contar sobre o parentesco.",
    ],
    correct: 2,
    explanation:
      "Mesmo com preço justo, a decisão deve ser tomada por quem não tem o conflito, e o parentesco precisa ser declarado.",
  },
  {
    id: "q9",
    lesson: 5,
    prompt:
      "Um funcionário de um órgão público sugere que o processo andaria mais rápido com um pagamento por fora. O que fazer?",
    options: [
      "Recusar com clareza, anotar o que foi dito e comunicar imediatamente a pessoa responsável pelo programa de integridade.",
      "Pagar um valor pequeno, que não chama atenção.",
      "Dizer que vai pensar e voltar a conversar depois.",
      "Pedir a um terceiro que faça o pagamento.",
    ],
    correct: 0,
    explanation:
      "A empresa não admite vantagens a agentes públicos, de nenhum valor, e a comunicação rápida permite proteger o processo.",
  },
  {
    id: "q10",
    lesson: 5,
    prompt:
      "Qual cuidado a empresa espera ao contratar um terceiro, como um despachante ou consultor, para agir em seu nome?",
    options: [
      "Nenhum, pois a responsabilidade é do terceiro.",
      "Confirmar quem ele é, o que fará, por qual valor, ter contrato escrito e pagar uma conta em nome do contratado.",
      "Combinar tudo verbalmente para agilizar.",
      "Contratar sempre o mais barato.",
    ],
    correct: 1,
    explanation:
      "Verificar o terceiro e documentar a relação reduz o risco de que ele aja de forma inadequada em nome da empresa.",
  },
  {
    id: "q11",
    lesson: 6,
    prompt: "Para usar o canal de denúncias, o que você precisa?",
    options: [
      "Ter provas completas do que aconteceu.",
      "Identificar-se obrigatoriamente.",
      "Falar primeiro com a pessoa envolvida.",
      "Apenas estar sendo sincero sobre o que viu ou soube; o relato pode ser anônimo.",
    ],
    correct: 3,
    explanation:
      "Não é preciso ter certeza nem provas, e a pessoa decide se quer ou não deixar seus dados de contato.",
  },
  {
    id: "q12",
    lesson: 6,
    prompt:
      "Depois de fazer um relato de boa-fé, você percebe que passou a ser tratado de forma desfavorável por causa dele. O que fazer?",
    options: [
      "Aceitar, porque é uma consequência normal.",
      "Pedir demissão.",
      "Esperar a situação passar.",
      "Relatar também essa situação, pois a política da empresa não admite retaliação.",
    ],
    correct: 3,
    explanation:
      "Retaliação contra quem relata de boa-fé não é admitida e também deve ser comunicada.",
  },
];

export const TOTAL_MINUTES = LESSONS.reduce((s, l) => s + l.minutes, 0);

export const QUIZ_MINUTES = 2;
