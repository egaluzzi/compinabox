"use client";

import { useState, type FormEvent } from "react";

export type StatusLabels = {
  codeLabel: string;
  submit: string;
  checking: string;
  resultStatus: string; // contains {status}
  resultDate: string; // contains {date}
  notFound: string;
  rateLimited: string;
  error: string;
};

// The code travels in a POST body only: never in a URL, history entry or referrer.
export function StatusLookup({
  slug,
  labels,
}: {
  slug: string;
  labels: StatusLabels;
}) {
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "found"; label: string; date: string }
    | { kind: "problem"; text: string }
  >({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    setState({ kind: "checking" });
    try {
      const res = await fetch(
        `/api/report/${encodeURIComponent(slug)}/status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "omit",
          referrerPolicy: "no-referrer",
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        label?: string;
        date?: string;
      };
      if (res.ok && body.label && body.date)
        setState({ kind: "found", label: body.label, date: body.date });
      else if (res.status === 404)
        setState({ kind: "problem", text: labels.notFound });
      else if (res.status === 429)
        setState({ kind: "problem", text: labels.rateLimited });
      else setState({ kind: "problem", text: labels.error });
    } catch {
      setState({ kind: "problem", text: labels.error });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <label className="block text-sm font-medium">
        {labels.codeLabel}
        <input
          type="text"
          name="code"
          required
          maxLength={32}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="mt-1 w-full rounded border border-slate-400 px-3 py-2 font-mono font-normal uppercase tracking-widest"
        />
      </label>
      <button
        disabled={state.kind === "checking"}
        className="rounded bg-slate-900 px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {state.kind === "checking" ? labels.checking : labels.submit}
      </button>
      <div role="status" aria-live="polite">
        {state.kind === "found" && (
          <div className="space-y-1">
            <p className="font-medium">
              {labels.resultStatus.replace("{status}", state.label)}
            </p>
            <p className="text-sm text-slate-700">
              {labels.resultDate.replace("{date}", state.date)}
            </p>
          </div>
        )}
        {state.kind === "problem" && (
          <p className="text-red-800">{state.text}</p>
        )}
      </div>
    </form>
  );
}
