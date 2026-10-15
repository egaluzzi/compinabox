import { randomInt } from "node:crypto";

// 12 chars from a 31-letter alphabet without 0/O/1/I/L (~59 bits). The entropy, not the rate
// limiter, is what stops enumeration.
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 12;

export function generateTrackingCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++)
    s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** XXXX-XXXX-XXXX for display. */
export const formatTrackingCode = (code: string) =>
  code.match(/.{1,4}/g)?.join("-") ?? code;

const VALID = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

/** Strips spaces/dashes, uppercases; null when it cannot be a code (malformed). */
export function normalizeTrackingCode(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 64) return null;
  const s = input.replace(/[\s-]+/g, "").toUpperCase();
  return VALID.test(s) ? s : null;
}
