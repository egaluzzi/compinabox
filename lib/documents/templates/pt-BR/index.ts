import type { DocumentTemplate, DocumentType } from "../../types";
import { antiBribery } from "./anti-bribery";
import { codeOfConduct } from "./code-of-conduct";
import { conflictsOfInterest } from "./conflicts-of-interest";
import { giftsHospitality } from "./gifts-hospitality";
import { thirdPartyPublicOfficials } from "./third-party-public-officials";
import { whistleblowerProtection } from "./whistleblower-protection";

export const ptBR: Record<DocumentType, DocumentTemplate> = {
  code_of_conduct: codeOfConduct,
  "policy:anti_bribery": antiBribery,
  "policy:gifts_hospitality": giftsHospitality,
  "policy:conflicts_of_interest": conflictsOfInterest,
  "policy:third_party_public_officials": thirdPartyPublicOfficials,
  "policy:whistleblower_protection": whistleblowerProtection,
};
