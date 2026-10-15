"use client";

import { useState } from "react";

/** Read-only value with a copy button. Without JS the value is still selectable. */
export function CopyField({
  value,
  label,
  copy,
  copied,
}: {
  value: string;
  label: string;
  copy: string;
  copied: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-sm font-medium">
        {label}
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 w-full rounded border border-slate-400 px-3 py-2 font-mono text-sm font-normal"
        />
      </label>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setDone(true);
          } catch {
            setDone(false);
          }
        }}
        className="rounded border border-slate-400 px-3 py-2 text-sm"
      >
        {done ? copied : copy}
      </button>
    </div>
  );
}
