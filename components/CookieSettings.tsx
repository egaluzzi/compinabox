"use client";

import { OPEN_CONSENT } from "@/lib/tracking";

/** Footer control to change the cookie choice later (withdrawing consent stops tracking). */
export function CookieSettings({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="underline"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT))}
    >
      {label}
    </button>
  );
}
