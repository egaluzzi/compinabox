export function json(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

/** Cookie `Secure` follows the public origin, not the internal hop behind Caddy. */
export function isHttpsApp(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https:");
}

/** Reads one cookie from the request's Cookie header (no Next request context needed). */
export function requestCookie(
  request: Request,
  name: string,
): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}
