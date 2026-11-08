import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const ALLOWED_EMAIL = process.env.ALLOWED_EMAIL || process.env.ADMIN_EMAIL || "whythisintech@gmail.com";

export const { handlers, signIn, signOut, auth } = NextAuth({
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "channel-pilot-secret-fallback-key-32chars",
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID || "dummy-client-id",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy-client-secret",
        }),
    ],
    callbacks: {
        async signIn({ user }) {
            // If DISABLE_AUTH is true, allow any sign in
            if (process.env.DISABLE_AUTH === "true") {
                return true;
            }
            // Only allow the configured email
            if (user.email === ALLOWED_EMAIL) {
                return true;
            }
            return false;
        },
        async session({ session, token }) {
            return session;
        },
    },
    pages: {
        signIn: '/auth/signin',
        error: '/auth/error',
    },
})
