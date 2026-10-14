import { cookies } from "next/headers";
import { ReturnStatus } from "@/components/ReturnStatus";
import { getT, localeFromCookies } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

// The browser coming back from the processor proves nothing: this page only shows status.
export default async function CheckoutReturn({
  searchParams,
}: {
  searchParams: Promise<{ attempt?: string }>;
}) {
  const { attempt } = await searchParams;
  const jar = await cookies();
  const t = getT(localeFromCookies((n) => jar.get(n)?.value));
  return (
    <div className="space-y-3">
      <h1 className="text-3xl font-bold">{t("checkout.returnTitle")}</h1>
      <ReturnStatus
        attempt={attempt ?? ""}
        labels={{
          pending: t("checkout.returnPending"),
          failed: t("checkout.returnFailed"),
          expired: t("checkout.returnExpired"),
          paid: t("checkout.returnPaid"),
          retry: t("checkout.returnRetry"),
          generic: t("checkout.errGeneric"),
        }}
      />
    </div>
  );
}
