import { and, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { disclosures } from "@/lib/db/schema";
import { aadFor, decryptText, encryptText } from "@/lib/whistleblower/crypto";
import { AAD_TABLES } from "@/lib/whistleblower/constants";
import {
  DISCLOSURE_TYPE,
  disclosureYear,
  MAX_DISCLOSURE_DETAILS,
} from "./constants";
import type { PortalEmployee } from "./session";

export type DisclosureInput = { hasConflict: boolean; details: string };
export type DisclosureResult = "submitted" | "already" | "invalid";

const aad = (companyId: string) =>
  aadFor(AAD_TABLES.disclosures, companyId, "content");

/** Validates the raw form: "none" / "some" + details (required, <= 5000 chars, only for "some"). */
export function parseDisclosure(
  choice: unknown,
  details: unknown,
): DisclosureInput | null {
  if (choice === "none") return { hasConflict: false, details: "" };
  if (choice !== "some" || typeof details !== "string") return null;
  const d = details.trim();
  if (d === "" || d.length > MAX_DISCLOSURE_DETAILS) return null;
  return { hasConflict: true, details: d };
}

/**
 * One disclosure per employee per UTC calendar year (UNIQUE employee, type, year). The content is
 * encrypted with the whistleblower key ring before it touches the database. A second submit in
 * the same year changes nothing and says so.
 */
export async function submitDisclosure(
  db: Db,
  me: Pick<PortalEmployee, "companyId" | "employeeId">,
  input: DisclosureInput,
  now = new Date(),
): Promise<DisclosureResult> {
  const content = encryptText(JSON.stringify(input), aad(me.companyId));
  const rows = await db
    .insert(disclosures)
    .values({
      companyId: me.companyId,
      employeeId: me.employeeId,
      type: DISCLOSURE_TYPE,
      periodYear: disclosureYear(now),
      content,
    })
    .onConflictDoNothing({
      target: [
        disclosures.employeeId,
        disclosures.type,
        disclosures.periodYear,
      ],
    })
    .returning({ id: disclosures.id });
  return rows.length > 0 ? "submitted" : "already";
}

export type StoredDisclosure = {
  year: number;
  submittedAt: Date;
  /** null = could not be decrypted (key missing or value altered): the page says so. */
  content: DisclosureInput | null;
};

/** All of one employee's disclosures (tenant-scoped), newest year first, decrypted. */
export async function listDisclosures(
  db: Db,
  companyId: string,
  employeeId: string,
): Promise<StoredDisclosure[]> {
  const rows = await db
    .select()
    .from(disclosures)
    .where(
      and(
        eq(disclosures.companyId, companyId),
        eq(disclosures.employeeId, employeeId),
        eq(disclosures.type, DISCLOSURE_TYPE),
      ),
    );
  return rows
    .sort((a, b) => b.periodYear - a.periodYear)
    .map((r) => {
      let content: DisclosureInput | null = null;
      try {
        const parsed = JSON.parse(decryptText(r.content, aad(companyId)));
        if (
          typeof parsed?.hasConflict === "boolean" &&
          typeof parsed?.details === "string"
        )
          content = parsed;
      } catch {
        content = null;
      }
      return { year: r.periodYear, submittedAt: r.submittedAt, content };
    });
}

export async function hasDisclosedThisYear(
  db: Db,
  me: Pick<PortalEmployee, "companyId" | "employeeId">,
  now = new Date(),
) {
  const [row] = await db
    .select({ at: disclosures.submittedAt })
    .from(disclosures)
    .where(
      and(
        eq(disclosures.companyId, me.companyId),
        eq(disclosures.employeeId, me.employeeId),
        eq(disclosures.type, DISCLOSURE_TYPE),
        eq(disclosures.periodYear, disclosureYear(now)),
      ),
    );
  return row?.at ?? null;
}
