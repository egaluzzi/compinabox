import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { vendors } from "@/lib/db/schema";
import type { Country } from "@/lib/countries";
import type { EmailMessage, EmailSender } from "@/lib/email";
import { newSecret, sha256 } from "@/lib/employee/session";
import { COUNTRY_LOCALE, getT } from "@/lib/i18n";
import { VENDOR_INVITE_TTL_MS } from "./constants";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

type CompanyLike = { id: string; name: string; country: string };

/** A neutral request from the company: who is asking, what, one button. No accusation, no document text. */
export function questionnaireEmail(
  company: Pick<CompanyLike, "name" | "country">,
  to: string,
  contactName: string | null,
  url: string,
): EmailMessage {
  const t = getT(COUNTRY_LOCALE[company.country as Country] ?? "en");
  const values = { company: company.name, name: contactName ?? "" };
  const body = t("email.vendorBody", values);
  const button = t("email.vendorButton");
  return {
    to,
    subject: t("email.vendorSubject", values),
    text: `${body}\n\n${button}: ${url}\n`,
    html: `<p>${esc(body)}</p><p><a href="${esc(url)}">${esc(button)}</a></p><p>${esc(url)}</p>`,
  };
}

const linkFor = (token: string) =>
  `${new URL(process.env.APP_URL || "http://localhost:3000").origin}/vendor/${token}`;

export type SendResult =
  "sent" | "failed" | "not_found" | "no_email" | "archived";

/**
 * Send or resend the questionnaire. The mail goes out FIRST with a fresh token; only after a
 * successful send is the token's hash stored (replacing, and so killing, any previous link),
 * `invited_at`/expiry set and the status set to `sent`. A failed send changes nothing.
 */
export async function sendQuestionnaire(
  db: Db,
  company: CompanyLike,
  vendorId: string,
  sender: EmailSender,
  now = new Date(),
): Promise<SendResult> {
  const [v] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.companyId, company.id)));
  if (!v) return "not_found";
  if (v.archivedAt) return "archived";
  if (!v.contactEmail) return "no_email";
  const token = newSecret();
  try {
    await sender.send(
      questionnaireEmail(
        company,
        v.contactEmail,
        v.contactName,
        linkFor(token),
      ),
    );
  } catch {
    // Fixed string only: no address, no link, no error text.
    console.error("vendor questionnaire email failed");
    return "failed";
  }
  const rows = await db
    .update(vendors)
    .set({
      inviteTokenHash: sha256(token),
      invitedAt: now,
      inviteExpiresAt: new Date(now.getTime() + VENDOR_INVITE_TTL_MS),
      questionnaireStatus: "sent",
    })
    .where(
      and(
        eq(vendors.id, v.id),
        eq(vendors.companyId, company.id),
        isNull(vendors.archivedAt),
      ),
    )
    .returning({ id: vendors.id });
  return rows.length > 0 ? "sent" : "not_found";
}
