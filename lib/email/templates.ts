import { getT, type Locale } from "@/lib/i18n";
import type { EmailMessage } from "./index";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sign-in and welcome emails: one localized message with one link. */
export function linkEmail(
  kind: "signin" | "welcome",
  locale: Locale,
  to: string,
  url: string,
): EmailMessage {
  const t = getT(locale);
  const subject = t(`email.${kind}Subject`);
  const body = t(`email.${kind}Body`);
  const button = t(`email.${kind}Button`);
  return {
    to,
    subject,
    text: `${body}\n\n${button}: ${url}\n`,
    html: `<p>${esc(body)}</p><p><a href="${esc(url)}">${esc(button)}</a></p><p>${esc(url)}</p>`,
  };
}
