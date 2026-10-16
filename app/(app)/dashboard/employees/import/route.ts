import { NextResponse } from "next/server";
import { requireTenantRoute } from "@/lib/auth/require-tenant";
import { getDb } from "@/lib/db/client";
import { importEmployees } from "@/lib/employee/admin";
import { MAX_CSV_BYTES, MAX_REPORTED_INVALID } from "@/lib/employee/constants";
import { CsvError, parseRosterCsv } from "@/lib/employee/csv";

export const runtime = "nodejs";

// POST /dashboard/employees/import (multipart: file). The company is the session's. The result
// goes back as counts plus "line:reason" pairs only — never a name or an email — in the redirect.
export async function POST(request: Request) {
  const gate = await requireTenantRoute();
  if (!gate.ok) return gate.response;
  const { tenant } = gate.ctx;
  const origin = new URL(process.env.APP_URL || request.url).origin;
  const back = (q: string) =>
    NextResponse.redirect(`${origin}/dashboard/employees?${q}`, 303);

  let file: FormDataEntryValue | null = null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return back("fileError=no_file");
  }
  if (!(file instanceof File) || file.size === 0)
    return back("fileError=no_file");
  if (file.size > MAX_CSV_BYTES) return back("fileError=too_large");
  try {
    const parsed = parseRosterCsv(new Uint8Array(await file.arrayBuffer()));
    const s = await importEmployees(getDb(), tenant.companyId, parsed);
    const bad = parsed.invalid
      .slice(0, MAX_REPORTED_INVALID)
      .map((b) => `${b.line}:${b.reason}`)
      .join(",");
    return back(
      `imported=${s.created}.${s.reactivated}.${s.skipped}.${s.invalid}${bad ? `&bad=${bad}` : ""}`,
    );
  } catch (err) {
    if (err instanceof CsvError) return back(`fileError=${err.code}`);
    throw err;
  }
}
