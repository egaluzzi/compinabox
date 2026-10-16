import { and, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { vendorResponses, vendorScreenings, vendors } from "@/lib/db/schema";
import {
  MAX_SHORT,
  MAX_VENDOR_EMAIL,
  MAX_VENDOR_NAME,
  MAX_VENDOR_TAX_ID,
} from "./constants";

// Tenant-scoped vendor access. EVERY function takes `companyId` from the authenticated session
// (requireTenant) and filters by it; a vendor id from the URL is only a lookup key combined with
// it, so another company's vendor is indistinguishable from a missing one.

export type Vendor = typeof vendors.$inferSelect;

export type VendorState = "not_sent" | "sent" | "expired" | "submitted";

/** "expired" is derived: a sent link whose expiry has passed and that was never used. */
export function questionnaireState(
  v: Pick<
    Vendor,
    "questionnaireStatus" | "inviteExpiresAt" | "inviteTokenHash"
  >,
  now = new Date(),
): VendorState {
  if (v.questionnaireStatus === "submitted") return "submitted";
  if (v.questionnaireStatus !== "sent") return "not_sent";
  return v.inviteTokenHash && v.inviteExpiresAt && v.inviteExpiresAt <= now
    ? "expired"
    : "sent";
}

export type VendorInput = {
  name: string;
  country: string | null;
  taxId: string | null;
  contactName: string | null;
  contactEmail: string | null;
};
export type VendorFormError =
  | "name_required"
  | "name_long"
  | "country_invalid"
  | "tax_id_long"
  | "contact_name_long"
  | "email_invalid";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validates the add-vendor form: name 1–200 required, the rest optional. */
export function parseVendorForm(
  get: (k: string) => string,
): { ok: true; input: VendorInput } | { ok: false; error: VendorFormError } {
  const name = get("name").trim();
  if (name === "") return { ok: false, error: "name_required" };
  if (name.length > MAX_VENDOR_NAME) return { ok: false, error: "name_long" };
  const country = get("country").trim();
  if (country !== "" && !/^[A-Za-z]{2}$/.test(country))
    return { ok: false, error: "country_invalid" };
  const taxId = get("taxId").trim();
  if (taxId.length > MAX_VENDOR_TAX_ID)
    return { ok: false, error: "tax_id_long" };
  const contactName = get("contactName").trim();
  if (contactName.length > MAX_SHORT)
    return { ok: false, error: "contact_name_long" };
  const email = get("contactEmail").trim().toLowerCase();
  if (email !== "" && (email.length > MAX_VENDOR_EMAIL || !EMAIL.test(email)))
    return { ok: false, error: "email_invalid" };
  return {
    ok: true,
    input: {
      name,
      country: country === "" ? null : country.toUpperCase(),
      taxId: taxId === "" ? null : taxId,
      contactName: contactName === "" ? null : contactName,
      contactEmail: email === "" ? null : email,
    },
  };
}

export async function createVendor(
  db: Db,
  companyId: string,
  input: VendorInput,
) {
  const [row] = await db
    .insert(vendors)
    .values({ companyId, ...input })
    .returning();
  return row;
}

export async function listVendors(
  db: Db,
  companyId: string,
  opts: { includeArchived?: boolean } = {},
) {
  return db
    .select()
    .from(vendors)
    .where(
      and(
        eq(vendors.companyId, companyId),
        opts.includeArchived ? undefined : isNull(vendors.archivedAt),
      ),
    )
    .orderBy(desc(vendors.createdAt), desc(vendors.id));
}

export async function getVendor(db: Db, companyId: string, vendorId: string) {
  const [row] = await db
    .select()
    .from(vendors)
    .where(and(eq(vendors.id, vendorId), eq(vendors.companyId, companyId)));
  return row ?? null;
}

/** Archive / unarchive (never delete). Returns false when the vendor is not this company's. */
export async function setArchived(
  db: Db,
  companyId: string,
  vendorId: string,
  archived: boolean,
  now = new Date(),
) {
  const rows = await db
    .update(vendors)
    .set(archived ? { archivedAt: now } : { archivedAt: null })
    .where(and(eq(vendors.id, vendorId), eq(vendors.companyId, companyId)))
    .returning({ id: vendors.id });
  return rows.length > 0;
}

/** Latest screening per vendor (for the list), keyed by vendor id. */
export async function latestScreenings(db: Db, companyId: string) {
  const rows = await db
    .select()
    .from(vendorScreenings)
    .where(eq(vendorScreenings.companyId, companyId))
    .orderBy(desc(vendorScreenings.screenedAt), desc(vendorScreenings.id));
  const out = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!out.has(r.vendorId)) out.set(r.vendorId, r);
  return out;
}

/** Everything the detail page shows: the vendor, every response (newest first), every screening. */
export async function getVendorDetail(
  db: Db,
  companyId: string,
  vendorId: string,
) {
  const vendor = await getVendor(db, companyId, vendorId);
  if (!vendor) return null;
  const responses = await db
    .select()
    .from(vendorResponses)
    .where(
      and(
        eq(vendorResponses.companyId, companyId),
        eq(vendorResponses.vendorId, vendorId),
      ),
    )
    .orderBy(desc(vendorResponses.submittedAt), desc(vendorResponses.id));
  const screenings = await db
    .select()
    .from(vendorScreenings)
    .where(
      and(
        eq(vendorScreenings.companyId, companyId),
        eq(vendorScreenings.vendorId, vendorId),
      ),
    )
    .orderBy(desc(vendorScreenings.screenedAt), desc(vendorScreenings.id));
  return { vendor, responses, screenings };
}
