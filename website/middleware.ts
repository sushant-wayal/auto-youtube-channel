import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;

    // 1. Dashboard route protection via NextAuth
    if (pathname.startsWith('/dashboard')) {
        if (!req.auth) {
            const signInUrl = new URL('/auth/signin', req.url);
            signInUrl.searchParams.set('callbackUrl', req.url);
            return NextResponse.redirect(signInUrl);
        }
        return NextResponse.next();
    }

    // 2. API route protection
    if (pathname.startsWith('/api')) {
        // Whitelist public/special routes:
        // - /api/auth/*: NextAuth internal endpoints
        // - /api/pipeline-status (POST): GitHub Actions webhook verified by PIPELINE_WEBHOOK_SECRET
        // - /api/cron/*: Vercel cron endpoints
        // - /api/push-token: Mobile app push token registration
        const isNextAuth = pathname.startsWith('/api/auth');
        const isPipelineWebhook = pathname === '/api/pipeline-status' && req.method === 'POST';
        const isCron = pathname.startsWith('/api/cron');
        const isPushToken = pathname === '/api/push-token';

        if (isNextAuth || isPipelineWebhook || isCron || isPushToken) {
            return NextResponse.next();
        }

        const jarvisApiKey = process.env.JARVIS_API_KEY;
        if (jarvisApiKey) {
            const jarvisHeader = req.headers.get('x-jarvis-key');
            const authHeader = req.headers.get('authorization');
            const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

            const isJarvisAuthenticated = (jarvisHeader === jarvisApiKey) || (bearerToken === jarvisApiKey);
            const isDashboardUser = Boolean(req.auth?.user);

            if (!isJarvisAuthenticated && !isDashboardUser) {
                return NextResponse.json(
                    {
                        ok: false,
                        error: 'Unauthorized: Valid x-jarvis-key header or Authorization: Bearer <JARVIS_API_KEY> required',
                    },
                    { status: 401 }
                );
            }
        }
    }

    return NextResponse.next();
});

export const config = {
    matcher: ["/dashboard/:path*", "/api/:path*"],
};
