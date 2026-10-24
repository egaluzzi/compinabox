# Dossier (binder) — legal review sheet

**Status: DRAFT — written by a worker session, reviewed by no one.** This is the one list for the reviewing
lawyer for the phase 8 dossier (`lib/binder/`). It sits next to `lib/documents/REVIEW.md` (the six documents and
`lib/content/br.ts`) and `lib/training/REVIEW.md` (the training module); the dossier *includes* those texts
unchanged, so their review status carries into the dossier's cover notice.

The dossier is a PDF the customer hands to an auditor or a buyer. It says what the platform **recorded**, as of a
date. It must never say or imply that the company is compliant, adequate or certified (CLAUDE.md §8). Every
fixed sentence the dossier prints is below, in the order it appears. Source of truth: `messages/pt-BR.json`,
keys `binder.pdf.*` (the table is generated from it). A correction is a one-line edit there (and in the other
three locale files, `messages/DRAFTS.md` lists them); the next generated dossier carries it. Dossiers already
generated are immutable and keep the wording they were made with.

## 1. The personal-data question (needs a lawyer, and probably Esteban)

The dossier contains **employee names and the dates on which each person accepted a document, completed the
training (with the score) and submitted the annual conflict-of-interest declaration**, and it leaves the platform
when the customer sends it to a third party. It deliberately **excludes**: employee e-mail addresses, the IP
address logged with each acceptance, the *content* of any declaration, whistleblower report content / contact /
evidence / tracking codes, and vendor questionnaire answers (a marker test and a source check enforce that).

Questions:
1. Is sharing names + acceptance dates + training scores with an auditor or procurement officer acceptable under
   the LGPD for the customer, and what legal basis / employee notice does the customer need? (The customer is the
   controller; we are the processor — is the dashboard notice "o arquivo contém nomes de colaboradores e datas;
   compartilhe só com quem precisa" enough, or must the product ask the customer to confirm a basis before the
   first generation?)
2. Training **scores** per named person: needed by an auditor, or should the dossier show only completed / pending?
3. Whether the *whistleblower* section should include usage statistics at all. They are totals by status, no
   content, **off by default**, and chosen by whoever clicks "Gerar dossiê". Even totals could identify a report
   in a very small company (e.g. "1 relato recebido").
4. A binder is kept forever (immutable by design, stored in the database and its backups). Is a retention or
   erasure rule needed for dossiers that contain names? (Today deleting one would need a deliberate migration.)
5. The dossier shows the **vendor's name** and the screening state to whoever receives it. Vendor names are
   already sent to the screening provider (Phase 7 carry-over); confirm this onward disclosure is acceptable.

## 2. Statements I was least sure of

- **Channel description (section 6).** It says reports are visible only to the company's administrator, that
  report text / optional contact / evidence are stored encrypted, and that the platform does not store the
  reporter's IP address or browser *with the report*. This matches what Phase 5 does (AES-256-GCM column
  encryption; no IP/user-agent column; the intake paths read no request metadata) but it is a **factual claim
  about security made to third parties**: please judge whether it should be softened or removed. It also says
  "Serviços de infraestrutura podem manter registros técnicos próprios" because the reverse proxy sees IPs
  (open item in CLAUDE.md §11 and Phase 9).
- **"Elementos de programa citados como exigidos / recomendados" (section 1).** These come straight from
  `lib/content/br.ts` (`requiredElements`, `recommendedElements`), which is itself a draft built from SPEC §7;
  the heading wording ("citados como exigidos") is mine. Whether Lei 14.133/2021 requires these elements, and for
  which contracts, is the open question already recorded in CLAUDE.md §11.
- **Cover paragraph 2** ("Não é uma auditoria, uma certificação nem um parecer jurídico, e não afirma que a empresa
  cumpre qualquer lei ou exigência") and **paragraph 3** ("não constitui aconselhamento jurídico"): are these
  enough, or does a recipient need an explicit disclaimer of liability / reliance?
- **Training section.** "Concluíram" counts people with a stored pass; failed attempts are not stored by the
  platform, so the report cannot show attempts. It says so. The module itself is a draft (see
  `lib/training/REVIEW.md`).
- **Draft notice.** The cover shows "RASCUNHO — pendente de revisão" while any included document, the legal-basis
  content or the training module is still a draft. Today that is always (nothing has been reviewed). Once all of
  them are reviewed the notice disappears on its own — but the dossier's *own* fixed texts (this sheet) are not
  tracked by that flag: please tell us when this sheet is reviewed so the notice can be tied to it.
- **Vendor section.** Uses the existing, already-specified screening-state sentences; always labelled
  "ferramenta de triagem, não uma investigação de due diligence".
- **Time zone.** Dates and times are printed in Brasília time; the "as of" instant is the database snapshot time.

## 3. Every fixed text in the dossier (pt-BR)


### Cover: statement and "how to read this dossier"

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `title` | Dossiê de integridade |
| `coverSubtitle` | Compilação dos registros da plataforma |
| `timezoneNote` | Datas e horas no horário de Brasília. |
| `draftNote` | Este dossiê inclui documentos ou textos em rascunho, pendentes de revisão jurídica. Não os apresente como versão final. |
| `howTitle` | Como ler este dossiê |
| `how1` | Este dossiê é uma compilação dos registros mantidos na plataforma até a data indicada na capa. Ele mostra o que foi gerado, enviado, aceito e concluído até aquele momento. |
| `how2` | Não é uma auditoria, uma certificação nem um parecer jurídico, e não afirma que a empresa cumpre qualquer lei ou exigência. Quem o recebe deve fazer a sua própria avaliação. |
| `how3` | Os dados vêm dos registros da própria empresa na plataforma e não foram verificados de forma independente. Este dossiê não constitui aconselhamento jurídico. |

### Section 1 — legal context (the legal text itself comes from `lib/content/br.ts`, not from here)

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `legal.intro` | Esta seção resume o conteúdo de base legal que a plataforma mantém para o país da empresa e que alimenta os documentos desta seção. É informação geral. |
| `legal.draftNote` | Este conteúdo é um rascunho e aguarda revisão por advogado. |
| `legal.references` | Referências citadas |
| `legal.required` | Elementos de programa citados como exigidos |
| `legal.recommended` | Elementos de programa citados como recomendados |

### Section 2 — code of conduct and policies

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `documents.intro` | Versões vigentes do código de conduta e das cinco políticas na data da posição, como geradas pela plataforma. Cada documento começa em uma nova página. |
| `documents.meta` | Versão {version} · gerado em {date} |
| `documents.missing` | Este documento não existia na data da posição. |

### Section 3 — training report

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `training.intro` | Resultado do módulo de treinamento por colaborador ativo. A plataforma registra apenas as conclusões que atingiram a nota mínima. |
| `training.module` | Módulo de treinamento anticorrupção (identificador {id}): {lessons} lições e questionário de {questions} perguntas. Nota mínima: {pass}%. |
| `training.draft` | O conteúdo deste módulo é um rascunho pendente de revisão. |
| `training.counts` | Convidados: {invited} · Concluíram: {completed} · Colaboradores ativos: {active} |
| `training.note` | Tentativas em que a nota mínima não foi atingida não são registradas; "Pendente" inclui quem ainda não tentou e quem ainda não atingiu a nota. |
| `training.unavailable` | O treinamento não está disponível no idioma da empresa. |

### Section 4 — acknowledgment roster

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `acks.intro` | Para cada colaborador ativo, a data em que aceitou a versão vigente de cada documento. Constam apenas nomes e datas; endereços de e-mail e de IP não fazem parte deste dossiê. |
| `acks.versions` | Versões vigentes |
| `acks.legend` | Data: aceite da versão vigente · Desatualizado: aceitou apenas uma versão anterior · Pendente: sem aceite. |

### Section 5 — disclosure status

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `disclosures.intro` | Declaração anual de conflito de interesses, período {year}. Constam apenas o nome e a data de envio; o conteúdo das declarações não faz parte deste dossiê. |
| `disclosures.counts` | Enviadas: {submitted} de {total} colaboradores ativos |
| `disclosures.submitted` | Enviada |

### Section 6 — whistleblower channel

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `channel.intro` | O canal de denúncias é uma página pública, sem necessidade de conta, publicada no endereço abaixo. |
| `channel.how` | Como funciona |
| `channel.how1` | Qualquer pessoa pode enviar um relato pela página pública do canal, sem criar conta. |
| `channel.how2` | O relato pode ser anônimo; o formulário só recebe dados de contato se a pessoa optar por informá-los. |
| `channel.how3` | Ao enviar, a pessoa recebe um código de acompanhamento para consultar o status do relato sem se identificar. |
| `channel.how4` | Os relatos ficam visíveis apenas para a administração da empresa na plataforma, que registra o status e as anotações de cada caso. |
| `channel.how5` | O texto dos relatos, os contatos opcionais e as evidências são guardados de forma criptografada no servidor da plataforma. |
| `channel.how6` | A plataforma não grava o endereço IP nem o navegador de quem envia um relato junto ao registro do relato. Serviços de infraestrutura podem manter registros técnicos próprios. |
| `channel.limits` | Este dossiê não mostra o conteúdo de relatos e não comprova que o canal tenha sido usado ou respondido. |
| `channel.stats` | Estatísticas de uso (opcional) |
| `channel.statsTotal` | Relatos recebidos até a data da posição: {count} |
| `channel.statsNote` | Somente totais; nenhum conteúdo de relatos. |

### Section 7 — vendor screening summary (also reuses `dashboard.vendors.*` state strings and the screening disclaimer)

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `vendors.intro` | Fornecedores ativos registrados na plataforma, com o estado do questionário e o resultado da última triagem. A triagem é uma ferramenta de triagem, não uma investigação de due diligence. |
| `vendors.noAnswers` | As respostas dos questionários não fazem parte deste dossiê. |
| `vendors.lists` | Listas: {dataset} |
| `vendors.matches` | {count, plural, one {# possível correspondência} other {# possíveis correspondências}} |

### Section 8 — data notes (appendix)

| Key (`binder.pdf.`…) | Text |
| :- | :- |
| `notes.asOf` | Todos os dados foram lidos em um único instante, {date}; alterações posteriores não aparecem neste dossiê. |
| `notes.employees` | Colaboradores: constam apenas colaboradores ativos na data da posição, com nome e datas. Colaboradores desativados não são listados. |
| `notes.excluded` | Deixados de fora de propósito: e-mails e endereços de IP de colaboradores; o conteúdo das declarações de conflito de interesses; o conteúdo de relatos, as evidências e os códigos de acompanhamento do canal de denúncias; as respostas dos questionários de fornecedores. |
| `notes.documents` | Documentos: são as versões vigentes na data da posição, como geradas pela plataforma a partir dos dados da empresa. |
| `notes.vendors` | Fornecedores: a triagem consulta listas públicas na data indicada e registra o que foi consultado e o que retornou. Não é uma conclusão sobre o fornecedor. |
| `notes.statsOn` | Estatísticas de uso do canal de denúncias: incluídas nesta edição, por escolha de quem gerou o dossiê. |
| `notes.statsOff` | Estatísticas de uso do canal de denúncias: não incluídas nesta edição. |
| `notes.personalData` | Este arquivo contém nomes de colaboradores e datas. Compartilhe só com quem precisa. |
| `notes.integrity` | A plataforma guarda o resumo SHA-256 deste arquivo e o exibe na lista de dossiês; use-o para identificar o arquivo exato. |


### Dashboard text around the dossier (`dashboard.binder.*`)

The page where the customer generates and downloads it. The two sentences the customer reads before generating:

| Key | Text |
| :- | :- |
| `dashboard.binder.intro` | Gere um arquivo PDF com os documentos e os registros da sua conta, para entregar a um auditor ou a um comprador. O dossiê mostra o que a plataforma registrou até o momento da geração; não é uma auditoria, uma certificação nem um parecer jurídico. |
| `dashboard.binder.notice` | O arquivo contém nomes de colaboradores e datas; compartilhe só com quem precisa. |
| `dashboard.binder.excluded` | Ficam de fora: e-mails e endereços de IP de colaboradores, conteúdo das declarações, conteúdo e evidências das denúncias, códigos de acompanhamento e respostas dos questionários de fornecedores. |
| `dashboard.binder.draftWarning` | Enquanto houver documentos ou textos em rascunho, a capa do dossiê traz o aviso de rascunho. |
| `dashboard.binder.statsLabel` | Incluir estatísticas de uso do canal de denúncias (totais por status, sem conteúdo) |
| `dashboard.binder.hashHelp` | O resumo SHA-256 identifica o arquivo exato; informe-o a quem receber o dossiê. |

## 4. What is NOT in the dossier, by design

Employee e-mail and IP addresses · disclosure contents · whistleblower report text, contact details, evidence,
notes, tracking codes · vendor questionnaire answers · anything decrypted · screenshots (a headless browser is not
on the droplet; the channel is shown as URL + description + availability date instead of a screenshot).

## 5. Review status

| # | Item | Status |
| :- | :- | :- |
| 1 | Fixed texts above (`binder.pdf.*`, `dashboard.binder.*`) | DRAFT — needs legal review |
| 2 | The personal-data question (section 1) | OPEN — needs lawyer / Esteban |
| 3 | Channel description claims (section 6 of the dossier) | DRAFT — needs legal review |
