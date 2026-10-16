"use client";

import { useState, type FormEvent } from "react";

export type VendorFormLabels = {
  respondentName: string;
  respondentRole: string;
  ownership: string;
  ownershipHelp: string;
  pep: string;
  sanctions: string;
  antibribery: string;
  details: string;
  yes: string;
  no: string;
  submit: string;
  submitting: string;
  errorSummary: string;
  networkError: string;
  errors: { required: string; too_long: string; choice: string };
  thanksTitle: string;
  thanksBody: string;
  invalidTitle: string;
  invalidBody: string;
};

type Fields = Record<string, string>;
const EMPTY: Fields = {
  respondentName: "",
  respondentRole: "",
  ownershipText: "",
  pep: "",
  pepDetails: "",
  sanctions: "",
  sanctionsDetails: "",
  antibribery: "",
};

// One form. Typed answers live in component state, so a validation error from the server (or a
// network failure) never loses them. Without JavaScript the same <form> posts natively; the
// server then redirects back here with `?retry=1`.
export function VendorForm({
  token,
  labels,
  retry,
}: {
  token: string;
  labels: VendorFormLabels;
  retry: boolean;
}) {
  const [v, setV] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<
    "idle" | "sending" | "done" | "network" | "invalid"
  >("idle");
  const set = (k: string) => (e: { target: { value: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const body = new FormData();
    body.set("token", token);
    body.set("via", "js");
    for (const [k, val] of Object.entries(v)) body.set(k, val);
    try {
      const res = await fetch("/vendor/api/submit", { method: "POST", body });
      const json = (await res.json()) as {
        ok?: boolean;
        invalid?: boolean;
        errors?: Record<string, string>;
      };
      if (json.ok) return setState("done");
      if (json.invalid) {
        return setState("invalid"); // the same message the friendly page shows
      }
      setErrors(json.errors ?? {});
      setState("idle");
    } catch {
      setState("network");
    }
  }

  if (state === "done")
    return (
      <div role="status" className="space-y-2">
        <h1 className="text-2xl font-bold">{labels.thanksTitle}</h1>
        <p>{labels.thanksBody}</p>
      </div>
    );

  if (state === "invalid")
    return (
      <div role="alert" className="space-y-2">
        <h1 className="text-2xl font-bold">{labels.invalidTitle}</h1>
        <p>{labels.invalidBody}</p>
      </div>
    );

  const err = (f: string) =>
    errors[f] ? (
      <p role="alert" className="text-sm text-red-700">
        {labels.errors[errors[f] as keyof VendorFormLabels["errors"]]}
      </p>
    ) : null;
  const box = "mt-1 block w-full rounded border border-slate-400 px-3 py-2";
  const yesNo = (name: "pep" | "sanctions" | "antibribery") => (
    <div className="mt-1 flex gap-6">
      {(["yes", "no"] as const).map((o) => (
        <label key={o} className="flex items-center gap-2">
          <input
            type="radio"
            name={name}
            value={o}
            required
            checked={v[name] === o}
            onChange={set(name)}
          />
          {labels[o]}
        </label>
      ))}
    </div>
  );

  return (
    <form
      method="post"
      action="/vendor/api/submit"
      onSubmit={onSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="token" value={token} />
      {(retry || Object.keys(errors).length > 0) && (
        <p role="alert" className="font-medium text-red-700">
          {labels.errorSummary}
        </p>
      )}
      <label className="block font-medium">
        {labels.respondentName}
        <input
          name="respondentName"
          value={v.respondentName}
          onChange={set("respondentName")}
          maxLength={200}
          required
          className={box}
        />
        {err("respondentName")}
      </label>
      <label className="block font-medium">
        {labels.respondentRole}
        <input
          name="respondentRole"
          value={v.respondentRole}
          onChange={set("respondentRole")}
          maxLength={200}
          required
          className={box}
        />
        {err("respondentRole")}
      </label>
      <label className="block font-medium">
        {labels.ownership}
        <span className="block text-sm font-normal text-slate-700">
          {labels.ownershipHelp}
        </span>
        <textarea
          name="ownershipText"
          value={v.ownershipText}
          onChange={set("ownershipText")}
          maxLength={4000}
          rows={5}
          required
          className={box}
        />
        {err("ownershipText")}
      </label>
      {(
        [
          ["pep", labels.pep, "pepDetails"],
          ["sanctions", labels.sanctions, "sanctionsDetails"],
        ] as const
      ).map(([name, question, detailsName]) => (
        <fieldset key={name} className="space-y-2">
          <legend className="font-medium">{question}</legend>
          {yesNo(name)}
          {err(name)}
          <label className="block text-sm font-medium">
            {labels.details}
            <textarea
              name={detailsName}
              value={v[detailsName]}
              onChange={set(detailsName)}
              maxLength={4000}
              rows={3}
              required={v[name] === "yes"}
              className={box}
            />
            {err(detailsName)}
          </label>
        </fieldset>
      ))}
      <fieldset className="space-y-2">
        <legend className="font-medium">{labels.antibribery}</legend>
        {yesNo("antibribery")}
        {err("antibribery")}
      </fieldset>
      {state === "network" && (
        <p role="alert" className="text-red-700">
          {labels.networkError}
        </p>
      )}
      <button
        disabled={state === "sending"}
        className="rounded bg-slate-900 px-5 py-2 font-medium text-white disabled:opacity-60"
      >
        {state === "sending" ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
