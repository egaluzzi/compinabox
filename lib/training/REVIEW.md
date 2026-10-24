# Training module — review sheet (DRAFT)

**Status: DRAFT — written by a worker session, not reviewed by anyone.** For Esteban: this is the
pt-BR anti-corruption training that employees take in the portal (module id
`anticorruption-pt-BR-v1`). Tone, accuracy and fit with the six generated policies are your call;
get a Brazilian lawyer to read it if you want legal assurance. The product does **not** claim that
taking this training makes anyone compliant, certified or legally covered — completion copy says
"Treinamento concluído", never "certificado".

How it is built (so you know what you are approving):

- 6 lessons, one per document in the policy set, each ~350–450 words with one realistic scenario
  and what to do. Reading time ≈ 18 min + 2 min quiz.
- 12 questions (2 per lesson), 4 options, exactly one correct answer, a one-sentence explanation
  each. Pass mark: at least 80% correct (10 of 12 passes, 9 fails). Retakes are unlimited and
  immediate; failed attempts are not stored; a pass is stored once with the score.
- It names **no** statute, article or decree. It points to "o código de conduta e as políticas da
  empresa". Where it describes the company's rules (gifts, public officials, retaliation) it
  assumes the generated policies say the same — **check that they do** before launch.
- Data lives in `lib/training/content.ts`; edit there. Changing it requires no migration, but
  bumping `MODULE_ID` would make everyone retake it.

Status of every item: **DRAFT**.

## Lessons (all DRAFT)

1. O código de conduta: o essencial — DRAFT
2. Suborno e vantagens indevidas — DRAFT
3. Presentes, brindes e hospitalidade — DRAFT
4. Conflitos de interesse — DRAFT
5. Relacionamento com agentes públicos e terceiros — DRAFT
6. Falar é seguro: canal de denúncias e não retaliação — DRAFT

## Quiz (all DRAFT)

- **q1** (lição 1) — DRAFT — Você tem uma dúvida sobre como agir em uma situação que o código de conduta não descreve exatamente. O que fazer primeiro?
- **q2** (lição 1) — DRAFT — Seu gestor pede que você registre uma despesa com uma descrição diferente do que realmente aconteceu, "só desta vez". Qual é a atitude adequada?
- **q3** (lição 2) — DRAFT — Qual das alternativas pode ser uma vantagem indevida, segundo a política da empresa?
- **q4** (lição 2) — DRAFT — Um intermediário pede uma comissão muito acima do normal, em dinheiro e sem nota, "para agilizar" um processo. Como você deve reagir?
- **q5** (lição 3) — DRAFT — Um fornecedor que participa de uma concorrência em andamento convida você para um jantar caro. O que a política orienta?
- **q6** (lição 3) — DRAFT — Você recebe em casa um presente de valor alto de um cliente, sem aviso. O que fazer?
- **q7** (lição 4) — DRAFT — Qual é a atitude esperada ao perceber um possível conflito de interesse?
- **q8** (lição 4) — DRAFT — A melhor proposta para um serviço vem da empresa de um parente seu. O que você deve fazer?
- **q9** (lição 5) — DRAFT — Um funcionário de um órgão público sugere que o processo andaria mais rápido com um pagamento por fora. O que fazer?
- **q10** (lição 5) — DRAFT — Qual cuidado a empresa espera ao contratar um terceiro, como um despachante ou consultor, para agir em seu nome?
- **q11** (lição 6) — DRAFT — Para usar o canal de denúncias, o que você precisa?
- **q12** (lição 6) — DRAFT — Depois de fazer um relato de boa-fé, você percebe que passou a ser tratado de forma desfavorável por causa dele. O que fazer?
