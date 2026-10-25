// Versions of the drafted legal texts. A version is a label for one exact text: when lib/legal/terms.ts
// or privacy.ts changes, tests/legal.test.ts fails until the text hash AND the version here are
// updated together. The terms version is stored on every checkout attempt (checkout_attempt.terms_version).

export const TERMS_VERSION = "2026-10-25-rascunho-1";
export const PRIVACY_VERSION = "2026-10-25-rascunho-1";
/** Date shown at the foot of the pages (the date of this version). */
export const LEGAL_VERSION_DATE = "25/10/2026";

/** sha256 of JSON.stringify(<doc>) — checked by tests/legal.test.ts. */
export const TERMS_TEXT_SHA256 =
  "6ab8d30b222553874607fa917d5c3c265047654f439b5834133dd3a1c1a139d8";
export const PRIVACY_TEXT_SHA256 =
  "9f254f973e0af6d16136bac7524864fb5ccdd3a231c14b77b00d46ca6b158825";
