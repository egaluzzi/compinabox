"use client";

import { useState, type FormEvent } from "react";

export type ReportFormLabels = {
  categoryLabel: string;
  categoryPlaceholder: string;
  categories: { value: string; label: string }[];
  descriptionLabel: string;
  descriptionHelp: string;
  evidenceLabel: string;
  evidenceHelp: string;
  contactQuestion: string;
  contactYes: string;
  contactNo: string;
  contactLabel: string;
  contactHelp: string;
  submit: string;
  submitting: string;
  confirmed: string;
  saveCode: string;
  statusLink: string;
  errors: Record<string, string>;
};

const input = "w-full rounded border border-slate-400 px-3 py-2";

// Plain fetch + multipart. No cookies are sent (credentials: "omit"); nothing is stored in the
// browser; the form works by keyboard (real labels, a live error region, a real submit button).
export function ReportForm({
  slug,
  labels,
  maxDescription,
}: {
  slug: string;
  labels: ReportFormLabels;
  maxDescription: number;
}) {
  const [wantsContact, setWantsContact] = useState(false);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "error"; code: string }
    | { kind: "done"; code: string }
  >({ kind: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "sending" });
    try {
      const res = await fetch(`/api/report/${encodeURIComponent(slug)}`, {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        error?: string;
      };
      if (res.ok && body.ok && body.code)
        setState({ kind: "done", code: body.code });
      else setState({ kind: "error", code: body.error ?? "server_error" });
    } catch {
      setState({ kind: "error", code: "network" });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="space-y-3">
        <p className="font-medium">{labels.confirmed}</p>
        <p className="rounded border border-slate-400 bg-slate-50 px-4 py-3 font-mono text-2xl tracking-widest">
          {state.code}
        </p>
        <p className="text-sm text-slate-700">{labels.saveCode}</p>
        <a
          className="underline"
          href={`/report/${encodeURIComponent(slug)}/status`}
        >
          {labels.statusLink}
        </a>
      </div>
    );
  }

  const errorText =
    state.kind === "error"
      ? (labels.errors[state.code] ?? labels.errors.server_error)
      : null;
  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div role="alert" aria-live="assertive">
        {errorText && (
          <p className="rounded border border-red-700 px-3 py-2 text-red-800">
            {errorText}
          </p>
        )}
      </div>

      <label className="block text-sm font-medium">
        {labels.categoryLabel}
        <select
          name="category"
          required
          defaultValue=""
          className={`${input} mt-1 font-normal`}
        >
          <option value="" disabled>
            {labels.categoryPlaceholder}
          </option>
          {labels.categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        {labels.descriptionLabel}
        <textarea
          name="description"
          required
          rows={8}
          maxLength={maxDescription}
          aria-describedby="description-help"
          className={`${input} mt-1 font-normal`}
        />
        <span
          id="description-help"
          className="block text-xs font-normal text-slate-600"
        >
          {labels.descriptionHelp}
        </span>
      </label>

      <label className="block text-sm font-medium">
        {labels.evidenceLabel}
        <input
          type="file"
          name="evidence"
          multiple
          accept="image/png,image/jpeg"
          aria-describedby="evidence-help"
          className={`${input} mt-1 font-normal`}
        />
        <span
          id="evidence-help"
          className="block text-xs font-normal text-slate-600"
        >
          {labels.evidenceHelp}
        </span>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          {labels.contactQuestion}
        </legend>
        <label className="mr-6 inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="wantsContact"
            value="no"
            checked={!wantsContact}
            onChange={() => setWantsContact(false)}
          />
          {labels.contactNo}
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="wantsContact"
            value="yes"
            checked={wantsContact}
            onChange={() => setWantsContact(true)}
          />
          {labels.contactYes}
        </label>
        {wantsContact && (
          <label className="block text-sm font-medium">
            {labels.contactLabel}
            <input
              type="text"
              name="contact"
              required
              maxLength={254}
              autoComplete="off"
              aria-describedby="contact-help"
              className={`${input} mt-1 font-normal`}
            />
            <span
              id="contact-help"
              className="block text-xs font-normal text-slate-600"
            >
              {labels.contactHelp}
            </span>
          </label>
        )}
      </fieldset>

      {/* Honeypot: invisible to people and to assistive tech; a filled value marks a bot. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        disabled={state.kind === "sending"}
        className="rounded bg-slate-900 px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {state.kind === "sending" ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
