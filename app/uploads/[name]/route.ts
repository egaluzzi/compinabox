import { contentTypeFor, readUpload } from "@/lib/uploads";

// Phase 9 moves serving to Caddy; until then: fixed content-type derived from the validated
// filename (never from the file), nosniff, and a CSP that blocks anything active.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  const type = contentTypeFor(name);
  const data = type ? await readUpload(name) : null;
  if (!type || !data) return new Response("Not Found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
