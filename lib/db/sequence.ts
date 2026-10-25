/**
 * Awaits lazy drizzle query builders one after another. Inside a transaction there is ONE
 * connection: awaiting several builders at once (Promise.all) makes node-pg queue them behind a
 * deprecation warning that becomes an error in pg 9. Pass builders, not already-started promises.
 */
export async function sequentially<
  const T extends readonly PromiseLike<unknown>[],
>(queries: T): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const out: unknown[] = [];
  for (const q of queries) out.push(await q);
  return out as { -readonly [K in keyof T]: Awaited<T[K]> };
}
