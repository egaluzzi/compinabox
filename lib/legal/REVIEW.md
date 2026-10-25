# Legal drafts — notes for the lawyer

**Status: DRAFT.** `lib/legal/privacy.ts` (Política de Privacidade) and `lib/legal/terms.ts` (Termos de Uso)
were written by the engineering team from what the product actually does (the code, the schema and the README),
not from a legal source. Nothing here has been reviewed by a lawyer. Both pages carry the "RASCUNHO" banner and
`noindex`. Legal review still gates the Brazil launch (CLAUDE.md §11, IMPLEMENTATION_PLAN Phase 9d).

Rules the team followed: the only statute named is the **LGPD**, by name; no article numbers, decrees or other
laws; no sentence saying the service makes anyone compliant, adequate or certified; no invented company facts.
`tests/legal.test.ts` enforces the wording rules and that every placeholder below is listed here.

Versions: `lib/legal/version.ts`. Changing a text requires a new version label and hash (the test fails
otherwise). The **terms version a buyer accepted** is stored on `checkout_attempt.terms_version` together with
`terms_accepted_at`; rows created before this existed have both NULL.

## 1. Placeholders (visible in the pages, highlighted)

Each one needs a real value or a lawyer's wording. Tests fail if one appears in a text and is not in this list.

| Placeholder (exact text) | Where | Who supplies it |
| :- | :- | :- |
| [RAZÃO SOCIAL — a preencher] | privacy §1, terms §11 | Esteban (legal entity) |
| [CNPJ — a preencher] | privacy §1, terms §11 | Esteban |
| [ENDEREÇO — a preencher] | privacy §1 | Esteban |
| [ENCARREGADO / CONTATO DE PRIVACIDADE — a preencher] | privacy §1, §11 | Esteban / lawyer (is an encarregado required for this business?) |
| [E-MAIL DE SUPORTE — a preencher] | privacy §1, §11, terms §11 | Esteban |
| [TRANSFERÊNCIAS INTERNACIONAIS: países e mecanismo jurídico — a definir pelo advogado] | privacy §7 | lawyer |
| [PRAZOS DE RETENÇÃO — a definir] | privacy §8 | Esteban + lawyer |
| [PREÇOS E FORMA DE COBRANÇA — a definir] | terms §6 | Esteban (open input: BRL pricing, monthly vs annual) |
| [CANCELAMENTO E REEMBOLSO — a definir] | terms §6 | Esteban + lawyer |
| [LIMITAÇÃO DE RESPONSABILIDADE — a definir pelo advogado] | terms §8 | lawyer |
| [LEI APLICÁVEL E FORO — a definir pelo advogado] | terms §9 | lawyer |

## 2. Assumptions the team made — please confirm or correct

**Roles (controller / processor).** Privacy §1 says: for site, sign-up and billing data **we decide** (controller);
for the data a customer loads about its employees, vendors and whistleblowers **the customer decides** and we
process to provide the service (processor). We are *not* sure this split is right for every category — in
particular (a) the whistleblower channel, where the reporter's relationship is with the customer, and (b) the
vendor screening, where we send names to a third party on the customer's instruction. We did not use the words
"controlador" or "operador" in the text for that reason. A data-processing agreement between us and the customer
may be needed; the terms do not contain one.

**Legal bases.** Privacy §3 deliberately says "as bases legais de cada uso serão indicadas na versão revisada". We
chose none. Categories where the basis matters most: employee acceptance records **with IP** (audit trail the
customer wants), whistleblower data, analytics cookies (consent), vendor screening of named persons/companies.

**Employee IP at acceptance.** The product stores the client IP with each document acceptance
(`acknowledgments.ip_address`) and the customer is told to inform employees (terms §4). The portal also tells the
employee before accepting. Is that enough? Is an employee notice from us needed?

**Sub-processors, named by role, not by name.** Privacy §5 lists hosting provider, e-mail provider, payment
processor, sanctions-screening provider (receives vendor name + optional 2-letter country only), CDN/proxy "when
used", analytics after consent. It is worded to be true with or without Cloudflare. Names (the hosting provider,
Resend, Mercado Pago, OpenSanctions, Cloudflare, Google) are **not** in the text; Phase 9d says the final policy must
name them. On staging, e-mail is a dummy sink and payment is a fake — the text describes the production product.

**"Não vendemos dados pessoais."** True of the code; it is a business commitment — Esteban to confirm.

**International transfers.** We state only that some providers may store or process data outside Brazil and leave the
mechanism as a placeholder. We did not assert any legal mechanism.

**Retention (privacy §8).** Stated as it is today: **no automatic deletion** of company, employee, vendor, report or
acknowledgment data; the only automatic cleanup is expired login sessions and tokens (`scripts/maintenance.mjs`).
Some tables are append-only at the database level (acknowledgments, training completions, disclosures, vendor
responses, whistleblower case log, ready binders). The text says deletion requests "serão analisados considerando
isso". Needed: retention periods (especially whistleblower reports, notes and evidence) and a purge procedure.
**Hard to undo — Esteban's call.**

**Rights (privacy §10).** Listed in plain language without article numbers; we included portability and "revisão de
decisões automatizadas" — the product takes no automated decisions about people. Please check the list is the right
one and whether response deadlines should be stated. For data held for a customer, we say the first contact should be
the customer.

**Whistleblower channel (privacy §6).** Written to match the Phase 5 README exactly: no IP, browser identifier or
cookie is stored with the report; contact only if the reporter opts in; description, contact, notes and evidence
encrypted; image metadata stripped; infrastructure (hosting, proxy, ISP) may keep technical logs, so the text does
**not** call the channel untraceable. Open: (a) what reporters should be told about Cloudflare/hosting logs, (b) the
reporter-facing notice and legal basis, (c) the case where the single customer admin is the subject of a report —
the text says "ainda precisa ser tratada", which is honest but unfinished.

**Cookies (privacy §4).** Names and lifetimes copied from the code: `country`, `lang`, `consent` (1 year), `utm`
(30 days, only after acceptance), the Auth.js session cookie, `return_token` (24 h), `employee_session` (8 h).
Analytics (GTM/GA4) are described as "if and when activated", loaded only after consent and never on the excluded
paths. Is a more detailed cookie table required?

**Minors (privacy §12).** "Não é dirigido a menores de 18 anos" — an assumption about the audience.

**Security (privacy §9).** Lists measures that exist in the code (magic-link login, hashed single-use links, encryption
at rest of the sensitive tables, tenant isolation, backups). It promises nothing beyond that and says no measure
eliminates all risk. Please check that even this list is acceptable to publish.

**Terms.** (a) §2 states what the service is not (no legal advice, no guarantee of compliance with any law, tender or
audit, no certification, templates are drafts until reviewed, screening is not due diligence) — wording reuses the
product's approved disclaimers; (b) §3 single admin; §4 acceptable use incl. informing employees; §5 "customer data
stays the customer's"; §7 "no availability promise" — we invented no uptime number; §8–§9 left to the lawyer; (c) there
is **no** licence/IP clause for generated documents, no data-processing annex, no consumer-law analysis (customers are
companies — is that always so?), no termination clause beyond the placeholder in §6.

## 3. Statements we were least sure of

1. The controller/processor split in privacy §1 (above).
2. Saying nothing about legal bases while listing purposes.
3. "Não vendemos dados pessoais" and "a plataforma não toma decisões automatizadas".
4. The whistleblower paragraph: how far we can describe anonymity given infrastructure logs.
5. The employee-IP notice chain (customer informs employees; the portal also tells them).
6. Terms §2 last bullet on vendor screening ("não é uma investigação de due diligence") — matches product copy, but it
   is a legal characterisation.
7. Absence of any liability, termination or governing-law text while the checkout asks the buyer to accept these terms.
