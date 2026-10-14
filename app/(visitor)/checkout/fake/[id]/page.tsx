import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { checkoutAttempt } from "@/lib/db/schema";
import { getT } from "@/lib/i18n";
import { fakeSecretIfEnabled } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// Dev/test simulator. 404 unless the fake provider is fully enabled (CLAUDE.md §8).
export default async function FakeProcessor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!fakeSecretIfEnabled()) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [attempt] = await getDb()
    .select()
    .from(checkoutAttempt)
    .where(eq(checkoutAttempt.id, id));
  if (!attempt || attempt.provider !== "fake") notFound();
  const t = getT("en"); // developer tool: English only
  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">{t("checkout.fakeTitle")}</h1>
      <p className="text-sm text-amber-800">{t("checkout.fakeNote")}</p>
      <p>
        {attempt.companyName} — {(attempt.amountCents / 100).toFixed(2)}{" "}
        {attempt.currency}
      </p>
      <form
        method="post"
        action={`/api/fake-payments/${attempt.id}`}
        className="flex gap-3"
      >
        <button
          name="outcome"
          value="pay"
          className="rounded bg-green-700 px-4 py-2 font-semibold text-white"
        >
          {t("checkout.fakePay")}
        </button>
        <button
          name="outcome"
          value="fail"
          className="rounded border border-slate-400 px-4 py-2"
        >
          {t("checkout.fakeFail")}
        </button>
      </form>
    </div>
  );
}
