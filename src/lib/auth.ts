import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { isValidVitEmail, parseVitEmail } from "@/lib/vit";

/**
 * Google sign-in is used in production (set GOOGLE_CLIENT_ID / SECRET).
 * When those are absent (sandbox/dev), a "sandbox mode" credentials
 * provider simulates the Google flow using a VIT student email so the
 * whole journey remains testable.
 */
export const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    ...(googleConfigured
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            authorization: {
              params: {
                prompt: "select_account",
                hd: "vitstudent.ac.in",
              },
            },
          }),
        ]
      : [
          CredentialsProvider({
            id: "vit-sandbox",
            name: "Sandbox Google Sign-In",
            credentials: {
              email: { label: "VIT Email", type: "text" },
            },
            async authorize(credentials) {
              const email = credentials?.email?.trim().toLowerCase();
              if (!email || !isValidVitEmail(email)) return null;
              const profile = parseVitEmail(email);
              await db.user.upsert({
                where: { email: profile!.email },
                update: { name: profile!.fullName },
                create: { email: profile!.email, name: profile!.fullName },
              });
              return { id: profile!.email, email: profile!.email, name: profile!.fullName };
            },
          }),
        ]),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.email) {
        session.user.email = token.email as string;
      }
      return session;
    },
  },
};

/** Helper for server components / route handlers. */
export function getAuthSession() {
  return getServerSession(authOptions);
}
