"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type Labels = {
  companyName: string;
  taxId: string;
  billingEmail: string;
  button: string;
  processing: string;
  signIn: string;
  acceptPrefix: string;
  acceptAnd: string;
  termsLink: string;
  privacyLink: string;
  errors: Record<string, string>;
};

/** Posts to /api/checkout; every failure is shown in-page (SPEC §8: no human touches the order). */
export function CheckoutForm({
  country,
  termsVersion,
  labels,
}: {
  country: string;
  /** The text version the page links to; sent back so the server stores what was shown. */
  termsVersion: string;
  labels: Labels;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const data = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          country,
          companyName: data.get("companyName"),
          taxId: data.get("taxId"),
          billingEmail: data.get("billingEmail"),
          termsAccepted: data.get("terms") === "on",
          termsVersion,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        redirectUrl?: string;
        error?: string;
      };
      if (res.ok && body.redirectUrl) {
        window.location.assign(body.redirectUrl);
        return; // stay "busy" while the browser navigates
      }
      setError(body.error ?? "generic");
    } catch {
      setError("generic");
    }
    setBusy(false);
  }

  const field = "mt-1 w-full rounded border border-slate-300 px-3 py-2";
  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
      <label className="block text-sm font-medium">
        {labels.companyName}
        <input
          name="companyName"
          required
          maxLength={120}
          autoComplete="organization"
          className={field}
        />
      </label>
      <label className="block text-sm font-medium">
        {labels.taxId}
        <input
          name="taxId"
          required
          inputMode="numeric"
          autoComplete="off"
          className={field}
        />
      </label>
      <label className="block text-sm font-medium">
        {labels.billingEmail}
        <input
          name="billingEmail"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          className={field}
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          name="terms"
          type="checkbox"
          required
          className="mt-1"
          aria-describedby={
            error === "terms_not_accepted" ? "terms-error" : undefined
          }
        />
        <span>
          {labels.acceptPrefix}{" "}
          <Link className="underline" href="/legal/terms" target="_blank">
            {labels.termsLink}
          </Link>{" "}
          {labels.acceptAnd}{" "}
          <Link className="underline" href="/legal/privacy" target="_blank">
            {labels.privacyLink}
          </Link>
          .
        </span>
      </label>
      {error && (
        <p id="terms-error" role="alert" className="text-sm text-red-700">
          {labels.errors[error] ?? labels.errors.generic}
          {error === "email_in_use" && (
            <>
              {" "}
              <Link className="underline" href="/login">
                {labels.signIn}
              </Link>
            </>
          )}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {busy ? labels.processing : labels.button}
      </button>
    </form>
  );
}
