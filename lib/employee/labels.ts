import type { DocumentType } from "@/lib/documents/types";

/** message key suffix per document type (documents.types.* and dashboard.employees.docShort.*) */
export const TYPE_KEY = {
  code_of_conduct: "codeOfConduct",
  "policy:anti_bribery": "antiBribery",
  "policy:gifts_hospitality": "giftsHospitality",
  "policy:conflicts_of_interest": "conflictsOfInterest",
  "policy:third_party_public_officials": "thirdPartyPublicOfficials",
  "policy:whistleblower_protection": "whistleblowerProtection",
} as const satisfies Record<DocumentType, string>;
