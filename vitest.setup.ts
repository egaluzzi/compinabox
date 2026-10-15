import "@testing-library/jest-dom/vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Fixed TEST-ONLY key set for whistleblower encryption (never a real key). Tests that need a
// second key or a missing key set process.env themselves and restore it.
process.env.REPORT_ENCRYPTION_KEYS =
  "t1:dGVzdC1rZXktb25lLTAxMjM0NTY3ODlhYmNkZWYtMDA=";
process.env.EVIDENCE_DIR = mkdtempSync(path.join(tmpdir(), "evidence-"));
