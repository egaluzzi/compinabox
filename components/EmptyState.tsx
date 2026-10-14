import type { ReactNode } from "react";

/** Section placeholder for features that arrive in later phases: honest copy, no fake data. */
export function EmptyState({
  title,
  message,
  action,
  unavailable,
}: {
  title: string;
  message: string;
  /** Primary action label; rendered visibly disabled until the feature exists. */
  action?: string;
  unavailable?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <div className="rounded border border-dashed border-slate-300 p-6">
        <p className="text-slate-800">{message}</p>
        {action && (
          <div className="mt-4">
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded border border-slate-300 px-4 py-2 text-sm text-slate-500"
            >
              {action}
            </button>
            <p className="mt-1 text-sm text-slate-600">{unavailable}</p>
          </div>
        )}
      </div>
    </div>
  );
}
