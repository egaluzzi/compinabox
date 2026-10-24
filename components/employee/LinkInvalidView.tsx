import { getT } from "@/lib/i18n";

// The one friendly page for every failure: unknown, used, expired or re-issued link, deactivated
// employee, ended or missing session, sign-out. Same copy, no hint which case it was. There is no
// session here, so the company language is unknown: the message is shown in the three languages.
export function LinkInvalidView() {
  return (
    <main className="mx-auto max-w-xl space-y-8 px-4 py-12 text-slate-900">
      {(["pt-BR", "es-MX", "en"] as const).map((l) => {
        const t = getT(l);
        return (
          <section key={l} lang={l} className="space-y-2">
            <h1 className="text-2xl font-bold">{t("employee.invalidTitle")}</h1>
            <p>{t("employee.invalidBody")}</p>
          </section>
        );
      })}
    </main>
  );
}
