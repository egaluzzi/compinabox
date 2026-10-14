"use client";

import { setCookie } from "@/lib/cookies";

type Props = {
  labels: { ar: string; br: string; mx: string; other: string };
};

const btn =
  "block rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-medium hover:border-slate-900";

/** Explicit clicks set the `country` cookie; plain links, so it works without JS too. */
export function CountryPicker({ labels }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {(["ar", "br", "mx"] as const).map((c) => (
        <li key={c}>
          <a
            href={`/${c}`}
            onClick={() => setCookie("country", c)}
            className={btn}
          >
            {labels[c]}
          </a>
        </li>
      ))}
      <li>
        <a
          href="#waitlist"
          onClick={() => setCookie("country", "other")}
          className={btn}
        >
          {labels.other}
        </a>
      </li>
    </ul>
  );
}
