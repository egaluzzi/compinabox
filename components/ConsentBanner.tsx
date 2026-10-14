"use client";

import { useEffect, useState } from "react";
import { getCookie, setCookie } from "@/lib/cookies";

type Props = { text: string; accept: string; reject: string };

/** Non-blocking bottom bar. Records the choice only; loads nothing (tracking is phase 9). */
export function ConsentBanner({ text, accept, reject }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const choice = getCookie("consent");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie is only readable after mount
    if (choice !== "accepted" && choice !== "rejected") setVisible(true);
  }, []);

  if (!visible) return null;

  const choose = (value: "accepted" | "rejected") => {
    setCookie("consent", value);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-3 text-sm shadow-lg"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-slate-700">{text}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => choose("rejected")}
            className="rounded border border-slate-300 px-3 py-1.5"
          >
            {reject}
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded bg-slate-900 px-3 py-1.5 text-white"
          >
            {accept}
          </button>
        </div>
      </div>
    </div>
  );
}
