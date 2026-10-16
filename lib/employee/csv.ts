import {
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  MAX_EMAIL,
  MAX_NAME,
  MAX_REPORTED_INVALID,
} from "./constants";

// Small, dependency-free CSV reader/writer for the roster import and export (phase 6).

export class CsvError extends Error {
  constructor(
    readonly code:
      | "too_large"
      | "too_many_rows"
      | "not_text"
      | "empty"
      | "bad_header"
      | "unterminated_quote",
  ) {
    super(code);
  }
}

/** Decodes UTF-8 (BOM tolerated). Binary garbage (NUL bytes, invalid UTF-8) is rejected. */
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_CSV_BYTES) throw new CsvError("too_large");
  if (bytes.includes(0)) throw new CsvError("not_text");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvError("not_text");
  }
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** `;` if the header line has more semicolons than commas (outside quotes is not needed: a header has no quotes in practice). */
export function detectDelimiter(text: string): "," | ";" {
  const header = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const semis = (header.match(/;/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/**
 * RFC-4180-style parser: quoted fields may contain the delimiter, doubled quotes and newlines;
 * CRLF, LF and lone CR end a record. Returns the raw rows with their 1-based starting line
 * number (a quoted newline advances the line count). Blank lines are skipped.
 */
export function parseCsv(
  text: string,
  delimiter: "," | ";",
): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let field = "";
  let quoted = false;
  let fieldStarted = false;
  let line = 1;
  let rowLine = 1;
  const endField = () => {
    cells.push(field);
    field = "";
    fieldStarted = false;
  };
  const endRow = () => {
    endField();
    if (!(cells.length === 1 && cells[0].trim() === ""))
      rows.push({ line: rowLine, cells });
    cells = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else {
        if (c === "\n") line++;
        field += c;
      }
      continue;
    }
    if (c === '"' && !fieldStarted) {
      quoted = true;
      fieldStarted = true;
    } else if (c === delimiter) {
      endField();
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      rowLine = line;
    } else {
      field += c;
      fieldStarted = true;
    }
  }
  if (quoted) throw new CsvError("unterminated_quote");
  if (fieldStarted || field !== "" || cells.length > 0) endRow();
  return rows;
}

const EMAIL = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/;
export const isEmail = (s: string) =>
  s.length <= MAX_EMAIL && EMAIL.test(s) && !s.includes("..");

export type ImportRow = { line: number; name: string; email: string };
export type InvalidRow = { line: number; reason: InvalidReason };
export type InvalidReason =
  "columns" | "name_empty" | "name_long" | "email_invalid";

export type ParsedRoster = {
  valid: ImportRow[];
  /** At most MAX_REPORTED_INVALID are listed; `invalidCount` is the true number. */
  invalid: InvalidRow[];
  invalidCount: number;
  /** Rows dropped because the same email appeared earlier in the file (the first one is kept). */
  duplicatesInFile: number;
};

const HEADER_NAME = new Set(["name", "nome"]);

/** Whole pipeline: bytes -> validated rows. Throws CsvError for file-level problems. */
export function parseRosterCsv(bytes: Uint8Array): ParsedRoster {
  const text = decodeCsv(bytes);
  const rows = parseCsv(text, detectDelimiter(text));
  if (rows.length === 0) throw new CsvError("empty");
  const [header, ...data] = rows;
  const h = header.cells.map((c) => c.trim().toLowerCase());
  if (h.length < 2 || !HEADER_NAME.has(h[0]) || h[1] !== "email")
    throw new CsvError("bad_header");
  if (data.length > MAX_CSV_ROWS) throw new CsvError("too_many_rows");

  const out: ParsedRoster = {
    valid: [],
    invalid: [],
    invalidCount: 0,
    duplicatesInFile: 0,
  };
  const seen = new Set<string>();
  const reject = (line: number, reason: InvalidReason) => {
    out.invalidCount++;
    if (out.invalid.length < MAX_REPORTED_INVALID)
      out.invalid.push({ line, reason });
  };
  for (const r of data) {
    // Ragged rows: fewer than 2 cells is invalid; extra cells are ignored.
    if (r.cells.length < 2) {
      reject(r.line, "columns");
      continue;
    }
    const name = r.cells[0].trim().replace(/\s+/g, " ");
    const email = r.cells[1].trim().toLowerCase();
    if (name === "") reject(r.line, "name_empty");
    else if (name.length > MAX_NAME) reject(r.line, "name_long");
    else if (!isEmail(email)) reject(r.line, "email_invalid");
    else if (seen.has(email)) out.duplicatesInFile++;
    else {
      seen.add(email);
      out.valid.push({ line: r.line, name, email });
    }
  }
  return out;
}

/**
 * Spreadsheet formula injection: a cell that starts with = + - @ tab or CR is prefixed with an
 * apostrophe so Excel/Sheets show it as text. Applied to every exported cell.
 */
export function neutralise(cell: string): string {
  return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
}

/** Serialises rows (header first) with `,`, CRLF, quoting where needed, formula-safe. */
export function serializeCsv(rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    const s = neutralise(v === null || v === undefined ? "" : String(v));
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
