import "next-auth";

declare module "next-auth" {
  interface Session {
    companyId?: string;
    issuedAtMs?: number;
  }
}
