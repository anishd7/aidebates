import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account, profile }) {
      // On first sign-in, populate token with Google profile data.
      // The backend auto-creates users from JWT claims on first API call,
      // so no separate user-creation request is needed here.
      if (account && profile) {
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.picture;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose token fields on the session for client-side access
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }

      // Sign a plain HS256 JWT for the backend API.
      // The backend verifies this with the same NEXTAUTH_SECRET via python-jose.
      session.accessToken = await new SignJWT({
        email: token.email,
        name: token.name,
        picture: token.picture,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(secret);

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
