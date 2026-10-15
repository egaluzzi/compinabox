/**
 * Headers on every public report page and handler: nothing cached, no referrer, no framing, no
 * indexing. (next.config.ts sets the same set for the pages; handlers set them themselves.)
 * No cookie is ever set or read on these paths.
 */
export const PUBLIC_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "frame-ancestors 'none'",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
} as const;

export function reply(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(body, {
    status,
    headers: { ...PUBLIC_HEADERS, ...extra },
  });
}

/** One body for every "no such report" case, so none can be told apart from another. */
export const notFound = () => reply({ error: "not_found" }, 404);
