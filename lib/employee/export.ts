import { DOCUMENT_TYPES } from "@/lib/documents/types";
import { getT, type Locale } from "@/lib/i18n";
import { serializeCsv } from "./csv";
import { TYPE_KEY } from "./labels";
import type { Roster, RosterRow, Step } from "./roster";

// One table shape for the dashboard grid, the CSV and the PDF, built from the roster model so the
// three can never disagree. NO IP address and NO disclosure content ever appears here: only
// "submitted" with a date (the detail page, behind the admin session, shows those).

export type Cell = {
  kind: "done" | "outdated" | "pending" | "unavailable";
  at?: Date;
};

const cellOf = (s: Step | "unavailable"): Cell =>
  s === "unavailable"
    ? { kind: "unavailable" }
    : s.state === "pending"
      ? { kind: "pending" }
      : { kind: s.state, at: s.at };

export type ExportRow = {
  id: string;
  name: string;
  email: string;
  invite: RosterRow["invite"];
  deactivated: boolean;
  docs: Cell[];
  training: Cell;
  disclosure: Cell;
};

export function exportRows(roster: Roster): ExportRow[] {
  return roster.rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    invite: r.invite,
    deactivated: !!r.deactivatedAt,
    docs: DOCUMENT_TYPES.map((t) => cellOf(r.docs[t])),
    training: cellOf(r.training),
    disclosure: cellOf(r.disclosure),
  }));
}

const iso = (c: Cell) => (c.kind === "done" ? c.at!.toISOString() : c.kind);

export function headerLabels(locale: Locale) {
  const t = getT(locale);
  return [
    t("dashboard.employees.colName"),
    t("dashboard.employees.colEmail"),
    t("dashboard.employees.colInvitation"),
    ...DOCUMENT_TYPES.map((d) =>
      t(`dashboard.employees.docShort.${TYPE_KEY[d]}`),
    ),
    t("dashboard.employees.colTraining"),
    t("dashboard.employees.colDisclosure"),
  ];
}

/** CSV: ISO timestamps for done steps, otherwise the state word. Formula-injection safe. */
export function rosterCsv(roster: Roster, locale: Locale): string {
  const rows = exportRows(roster);
  return serializeCsv([
    headerLabels(locale),
    ...rows.map((r) => [
      r.name,
      r.email,
      r.deactivated ? "deactivated" : r.invite,
      ...r.docs.map(iso),
      iso(r.training),
      iso(r.disclosure),
    ]),
  ]);
}
