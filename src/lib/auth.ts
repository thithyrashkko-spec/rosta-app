import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
          staffId: user.staffId,
        };
      },
    }),
  ],
  callbacks: {
    // Carry role/teamId/staffId onto the JWT at sign-in, then onto the
    // session on every request -- every API route scopes its Prisma
    // queries by session.user.teamId, and requests use staffId to know
    // "which staff member is this logged-in user".
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.teamId = (user as any).teamId;
        token.staffId = (user as any).staffId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).teamId = token.teamId;
        (session.user as any).staffId = token.staffId ?? null;
      }
      return session;
    },
  },
});
