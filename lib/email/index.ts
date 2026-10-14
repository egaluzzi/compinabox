import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

export class ResendSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}
  async send(m: EmailMessage) {
    const { error } = await new Resend(this.apiKey).emails.send({
      from: this.from,
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
  }
}

/** Dev/CI only: writes each message as a JSON file. Enabled solely by EMAIL_DEV_SINK=true. */
export class FileSink implements EmailSender {
  constructor(private readonly dir: string) {}
  async send(m: EmailMessage) {
    await mkdir(this.dir, { recursive: true });
    const file = path.join(this.dir, `${Date.now()}-${randomUUID()}.json`);
    await writeFile(file, JSON.stringify(m, null, 2), "utf8");
  }
}

let warned = false;

/**
 * Resend when RESEND_API_KEY is set; the file sink only when EMAIL_DEV_SINK=true; otherwise
 * throws. A missing key must never silently turn into links written to disk in production.
 */
export function getEmailSender(
  env: NodeJS.ProcessEnv = process.env,
): EmailSender {
  if (env.EMAIL_DEV_SINK === "true") {
    if (!warned) {
      warned = true;
      console.warn("EMAIL_DEV_SINK=true: emails are written to disk, not sent");
    }
    return new FileSink(env.EMAIL_SINK_DIR || ".dev-outbox");
  }
  const key = env.RESEND_API_KEY;
  if (!key || key === "changeme") {
    throw new Error(
      "No email sender configured: set RESEND_API_KEY (or EMAIL_DEV_SINK=true in dev/CI)",
    );
  }
  const from = env.EMAIL_FROM;
  if (!from || from === "changeme") throw new Error("EMAIL_FROM is not set");
  return new ResendSender(key, from);
}
