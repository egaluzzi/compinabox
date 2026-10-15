import { isIP } from "node:net";

/**
 * The ONLY place in the app (outside the anonymous whistleblower paths, which must contain none)
 * that reads a client IP. Cloudflare is the sole trusted source (CLAUDE.md §3): `cf-connecting-ip`,
 * never a client-supplied forwarding header. Absent or not a valid address (local dev, CI, direct hits) -> null.
 * The result is stored on `acknowledgments.ip_address` and nowhere else (SPEC §5.5: the audit trail
 * the customer wants as proof of acceptance). verify.sh enforces "exactly one file".
 */
export function clientIp(request: Request): string | null {
  const raw = request.headers.get("cf-connecting-ip")?.trim();
  return raw && isIP(raw) !== 0 ? raw : null;
}
