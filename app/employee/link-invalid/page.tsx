import { LinkInvalidView } from "@/components/employee/LinkInvalidView";

// Public by nature (no session exists here): one of the only pages under app/employee that does
// not use the portal session gate — see tests/employee-gate.test.ts for the explicit allow-list.
export default function LinkInvalid() {
  return <LinkInvalidView />;
}
