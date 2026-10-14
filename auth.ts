import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import { SESSION_MAX_AGE } from "@/lib/auth/session";
import { localeForEmail } from "@/lib/auth/links";
import { getDb, schema } from "@/lib/db/client";
import { getEmailSender } from "@/lib/email";
import { linkEmail } from "@/lib/email/templates";

export const SIGNIN_LINK_TTL_SECONDS = 15 * 60;

/**
 * Auth.js v5, magic link, JWT sessions. Config is built per request so importing this module
 * never needs a database (build time). No self sign-up: only emails that already have a User
 * get a link, and the response is identical for everyone else (no account enumeration).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const db = getDb();
  const base = DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  });
  return {
    adapter: {
      ...base,
      // Belt and braces: a verified link can never create an account.
      createUser: async () => {
        throw new Error("Self sign-up is disabled");
      },
    },
    providers: [
      {
        id: "email",
        type: "email",
        name: "Email",
        from: process.env.EMAIL_FROM,
        maxAge: SIGNIN_LINK_TTL_SECONDS,
        options: {},
        async sendVerificationRequest({ identifier, url }) {
          try {
            const locale = await localeForEmail(db, identifier);
            if (!locale) return; // unknown email: send nothing, answer the same
            await getEmailSender().send(
              linkEmail("signin", locale, identifier.toLowerCase(), url),
            );
          } catch (err) {
            // Swallowed on purpose: surfacing it would distinguish known from unknown emails.
            console.error("sign-in email failed:", err);
          }
        },
      },
    ],
    session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
    trustHost: true, // behind Caddy/Cloudflare; the public origin comes from AUTH_URL / forwarded headers
    pages: {
      signIn: "/login",
      verifyRequest: "/login?sent=1",
      error: "/login?error=1",
    },
    callbacks: {
      async jwt({ token, user }) {
        if (user?.id) {
          const [row] = await db
            .select({ companyId: schema.users.companyId })
            .from(schema.users)
            .where(eq(schema.users.id, user.id));
          token.userId = user.id;
          token.companyId = row?.companyId;
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) session.user.id = token.userId as string;
        session.companyId = token.companyId as string | undefined;
        return session;
      },
    },
  };
});
