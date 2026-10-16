import { aadFor, decryptText, encryptText } from "@/lib/whistleblower/crypto";
import { AAD_TABLES } from "@/lib/whistleblower/constants";
import { MAX_LONG, MAX_SHORT } from "./constants";

// Validation + encryption of questionnaire answers. No imports from the database, no I/O.

export type Answers = {
  respondentName: string;
  respondentRole: string;
  ownershipText: string;
  pepExposure: boolean;
  pepDetails: string;
  priorSanctions: boolean;
  sanctionsDetails: string;
  antibriberyPolicy: boolean;
};

export type FieldError = "required" | "too_long" | "choice";
export type AnswerField =
  | "respondentName"
  | "respondentRole"
  | "ownershipText"
  | "pep"
  | "pepDetails"
  | "sanctions"
  | "sanctionsDetails"
  | "antibribery";
export type Errors = Partial<Record<AnswerField, FieldError>>;

/** The raw form values, as strings (what the browser posts). */
export type RawAnswers = Partial<Record<AnswerField, string>>;

const yesNo = (v: string | undefined): boolean | null =>
  v === "yes" ? true : v === "no" ? false : null;

export function parseAnswers(
  raw: RawAnswers,
): { ok: true; answers: Answers } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  const text = (f: AnswerField, max: number, required: boolean) => {
    const v = (raw[f] ?? "").trim();
    if (v === "" && required) errors[f] = "required";
    else if (v.length > max) errors[f] = "too_long";
    return v;
  };
  const respondentName = text("respondentName", MAX_SHORT, true);
  const respondentRole = text("respondentRole", MAX_SHORT, true);
  const ownershipText = text("ownershipText", MAX_LONG, true);
  const pep = yesNo(raw.pep);
  const sanctions = yesNo(raw.sanctions);
  const antibribery = yesNo(raw.antibribery);
  if (pep === null) errors.pep = "choice";
  if (sanctions === null) errors.sanctions = "choice";
  if (antibribery === null) errors.antibribery = "choice";
  // Details are required only when the answer is yes; if no, they are dropped.
  const pepDetails = text("pepDetails", MAX_LONG, pep === true);
  const sanctionsDetails = text(
    "sanctionsDetails",
    MAX_LONG,
    sanctions === true,
  );
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    answers: {
      respondentName,
      respondentRole,
      ownershipText,
      pepExposure: pep === true,
      pepDetails: pep ? pepDetails : "",
      priorSanctions: sanctions === true,
      sanctionsDetails: sanctions ? sanctionsDetails : "",
      antibriberyPolicy: antibribery === true,
    },
  };
}

const aad = (companyId: string, field: string) =>
  aadFor(AAD_TABLES.vendorResponses, companyId, field);

export type EncryptedAnswers = {
  respondentName: string;
  respondentRole: string;
  ownershipText: string;
  pepDetails: string | null;
  sanctionsDetails: string | null;
};

export function encryptAnswers(
  companyId: string,
  a: Answers,
): EncryptedAnswers {
  return {
    respondentName: encryptText(
      a.respondentName,
      aad(companyId, "respondent_name"),
    ),
    respondentRole: encryptText(
      a.respondentRole,
      aad(companyId, "respondent_role"),
    ),
    ownershipText: encryptText(
      a.ownershipText,
      aad(companyId, "ownership_text"),
    ),
    pepDetails: a.pepDetails
      ? encryptText(a.pepDetails, aad(companyId, "pep_details"))
      : null,
    sanctionsDetails: a.sanctionsDetails
      ? encryptText(a.sanctionsDetails, aad(companyId, "sanctions_details"))
      : null,
  };
}

/** Decrypts one stored row; null when a key is missing/wrong (the page shows "cannot decrypt"). */
export function decryptAnswers(
  companyId: string,
  row: {
    respondentName: string;
    respondentRole: string;
    ownershipText: string;
    pepDetails: string | null;
    sanctionsDetails: string | null;
  },
): Pick<
  Answers,
  | "respondentName"
  | "respondentRole"
  | "ownershipText"
  | "pepDetails"
  | "sanctionsDetails"
> | null {
  try {
    return {
      respondentName: decryptText(
        row.respondentName,
        aad(companyId, "respondent_name"),
      ),
      respondentRole: decryptText(
        row.respondentRole,
        aad(companyId, "respondent_role"),
      ),
      ownershipText: decryptText(
        row.ownershipText,
        aad(companyId, "ownership_text"),
      ),
      pepDetails: row.pepDetails
        ? decryptText(row.pepDetails, aad(companyId, "pep_details"))
        : "",
      sanctionsDetails: row.sanctionsDetails
        ? decryptText(row.sanctionsDetails, aad(companyId, "sanctions_details"))
        : "",
    };
  } catch {
    return null;
  }
}
