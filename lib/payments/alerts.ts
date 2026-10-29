import { getEmailSender } from "@/lib/email";

/**
 * Plain-text e-mail to OPS_ALERT_EMAIL for the events a human must act on (paid but not
 * provisioned, unknown/mismatched payment, refund, chargeback). Callers pass ONLY ids and amounts:
 * no names, e-mails or tax ids. A failure is logged and never propagates (the webhook answer must
 * not depend on it). Unset address (staging) = log only.
 */
export async function sendOpsAlert(
  subject: string,
  facts: Record<string, string | number | null | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const body = Object.entries(facts)
    .map(([k, v]) => `${k}: ${v ?? "-"}`)
    .join("\n");
  console.error(`OPS ALERT: ${subject} | ${body.replace(/\n/g, " | ")}`);
  const to = (env.OPS_ALERT_EMAIL ?? "").trim();
  if (!to) return;
  try {
    await getEmailSender().send({
      to,
      subject: `[ComplyStart] ${subject}`,
      text: `${subject}\n\n${body}\n`,
    });
  } catch (err) {
    console.error(
      "ops alert e-mail failed:",
      err instanceof Error ? err.name : "error",
    );
  }
}
