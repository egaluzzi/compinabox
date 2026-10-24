import { and, asc, count, eq, isNotNull, isNull, lte, or } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { employees } from "@/lib/db/schema";
import type { Country } from "@/lib/countries";
import {
  getEmailSender,
  type EmailMessage,
  type EmailSender,
} from "@/lib/email";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import { INVITE_BATCH_MAX, INVITE_TTL_MS } from "./constants";
import { newSecret, sha256 } from "./session";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type CompanyLike = { id: string; name: string; country: string };

/** The invitation: company name, employee name, the two steps, one button. No document text. */
export function inviteEmail(
  company: Pick<CompanyLike, "name" | "country">,
  employee: { name: string; email: string },
  url: string,
): EmailMessage {
  const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
  const values = { company: company.name, name: employee.name };
  const body = t("email.inviteBody", values);
  const button = t("email.inviteButton");
  return {
    to: employee.email,
    subject: t("email.inviteSubject", values),
    text: `${body}\n\n${button}: ${url}\n`,
    html: `<p>${esc(body)}</p><p><a href="${esc(url)}">${esc(button)}</a></p><p>${esc(url)}</p>`,
  };
}

const linkFor = (token: string) =>
  `${new URL(process.env.APP_URL || "http://localhost:3000").origin}/employee/${token}`;

export type SendResult = "sent" | "failed" | "not_found";

/**
 * Sends one invitation. Order matters: the mail goes out FIRST with a fresh token; only after a
 * successful send is the token's hash stored (replacing, and so killing, any previous link) and
 * `invited_at` set. A failed send therefore changes nothing: the old link, if any, keeps working
 * and `invited_at` stays as it was (unset for a first invitation).
 */
export async function sendInvite(
  db: Db,
  company: CompanyLike,
  employeeId: string,
  sender: EmailSender,
  now = new Date(),
): Promise<SendResult> {
  const [emp] = await db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.companyId, company.id),
        isNull(employees.deactivatedAt),
      ),
    );
  if (!emp) return "not_found";
  const token = newSecret();
  try {
    await sender.send(inviteEmail(company, emp, linkFor(token)));
  } catch {
    console.error("employee invitation email failed");
    return "failed";
  }
  const rows = await db
    .update(employees)
    .set({
      inviteTokenHash: sha256(token),
      invitedAt: now,
      inviteExpiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    })
    .where(
      and(
        eq(employees.id, emp.id),
        eq(employees.companyId, company.id),
        isNull(employees.deactivatedAt),
      ),
    )
    .returning({ id: employees.id });
  return rows.length > 0 ? "sent" : "not_found";
}

/** Active employees never invited, or whose unused link has expired. */
const pendingWhere = (companyId: string, now: Date) =>
  and(
    eq(employees.companyId, companyId),
    isNull(employees.deactivatedAt),
    or(
      isNull(employees.invitedAt),
      and(
        isNotNull(employees.inviteTokenHash),
        lte(employees.inviteExpiresAt, now),
      ),
    ),
  );

export type BatchResult = { sent: number; failed: number; remaining: number };

/** "Send pending invitations": at most INVITE_BATCH_MAX per call, sequential. */
export async function sendPending(
  db: Db,
  company: CompanyLike,
  now = new Date(),
  sender: EmailSender = getEmailSender(),
): Promise<BatchResult> {
  const batch = await db
    .select({ id: employees.id })
    .from(employees)
    .where(pendingWhere(company.id, now))
    .orderBy(asc(employees.createdAt), asc(employees.id))
    .limit(INVITE_BATCH_MAX);
  let sent = 0;
  let failed = 0;
  for (const e of batch) {
    const r = await sendInvite(db, company, e.id, sender, now);
    if (r === "sent") sent++;
    else failed++;
  }
  return { sent, failed, remaining: await countPending(db, company.id, now) };
}

export async function countPending(
  db: Db,
  companyId: string,
  now = new Date(),
) {
  const [row] = await db
    .select({ n: count() })
    .from(employees)
    .where(pendingWhere(companyId, now));
  return row?.n ?? 0;
}
