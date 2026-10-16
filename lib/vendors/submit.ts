import { and, eq, gt, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { companies, vendorResponses, vendors } from "@/lib/db/schema";
import { sha256 } from "@/lib/employee/session";
import { encryptAnswers, type Answers } from "./answers";

// Public, tokenized side of the questionnaire. There is no session: the emailed token is the only
// credential, stored as sha256 only. NOTHING here reads request metadata or logs.

const badToken = (t: string) => !t || t.length > 200;

/**
 * READ-ONLY check used by the GET form page: the token is not consumed, so a mail scanner or a
 * link preview cannot burn it. Returns who is asking, or null (unknown, used, expired,
 * re-issued-away and archived are one outcome).
 */
export async function findOpenLink(db: Db, token: string, now = new Date()) {
  if (badToken(token)) return null;
  const [row] = await db
    .select({
      vendorId: vendors.id,
      companyId: vendors.companyId,
      company: companies.name,
      country: companies.country,
    })
    .from(vendors)
    .innerJoin(companies, eq(companies.id, vendors.companyId))
    .where(
      and(
        eq(vendors.inviteTokenHash, sha256(token)),
        gt(vendors.inviteExpiresAt, now),
        isNull(vendors.archivedAt),
      ),
    );
  return row ?? null;
}

export type SubmitResult = "ok" | "invalid";

/**
 * Consumes the link and stores the answers in ONE transaction. The UPDATE ... RETURNING is a
 * single atomic statement: two concurrent submits with the same token cannot both match, so
 * exactly one response row is written. Answers are encrypted (with the company found by the
 * read-only lookup, re-checked against the row that actually won) before the transaction opens.
 */
export async function submitQuestionnaire(
  db: Db,
  token: string,
  answers: Answers,
  now = new Date(),
): Promise<SubmitResult> {
  const open = await findOpenLink(db, token, now);
  if (!open) return "invalid";
  const sealed = encryptAnswers(open.companyId, answers);
  return db.transaction(async (tx) => {
    const won = await tx
      .update(vendors)
      .set({
        inviteTokenHash: null,
        questionnaireStatus: "submitted",
        submittedAt: now,
      })
      .where(
        and(
          eq(vendors.inviteTokenHash, sha256(token)),
          gt(vendors.inviteExpiresAt, now),
          isNull(vendors.archivedAt),
        ),
      )
      .returning({ id: vendors.id, companyId: vendors.companyId });
    if (won.length === 0) return "invalid" as const;
    // Cannot happen (the hash is a 256-bit secret); throwing rolls the consumption back.
    if (won[0].companyId !== open.companyId) throw new Error("tenant mismatch");
    await tx.insert(vendorResponses).values({
      companyId: won[0].companyId,
      vendorId: won[0].id,
      submittedAt: now,
      ...sealed,
      pepExposure: answers.pepExposure,
      priorSanctions: answers.priorSanctions,
      antibriberyPolicy: answers.antibriberyPolicy,
    });
    return "ok" as const;
  });
}
