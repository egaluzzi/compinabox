"use client";

import { setCookie } from "@/lib/cookies";
import type { Lang } from "@/lib/i18n";

const LANGS: { lang: Lang; label: string }[] = [
  { lang: "en", label: "EN" },
  { lang: "es", label: "ES" },
  { lang: "pt", label: "PT" },
];

/** Switches the UI language only, never the country (SPEC §3.4). */
export function LanguageToggle({
  current,
  label,
}: {
  current: Lang;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 text-sm">
      {LANGS.map(({ lang, label: text }) => (
        <button
          key={lang}
          type="button"
          aria-pressed={lang === current}
          onClick={() => {
            setCookie("lang", lang);
            window.location.reload();
          }}
          className={`rounded px-2 py-1 ${lang === current ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
