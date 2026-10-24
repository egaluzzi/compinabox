import { getT } from "@/lib/i18n";

// Shown after a no-JavaScript submit. No token, no company, no data: three languages.
export default function Thanks() {
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-12 text-slate-900">
      {(["pt-BR", "es-MX", "en"] as const).map((l) => {
        const t = getT(l);
        return (
          <section key={l} lang={l} className="space-y-2">
            <h1 className="text-2xl font-bold">{t("vendor.thanksTitle")}</h1>
            <p>{t("vendor.thanksBody")}</p>
          </section>
        );
      })}
    </main>
  );
}
