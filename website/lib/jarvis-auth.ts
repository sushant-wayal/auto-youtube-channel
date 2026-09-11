import { NextRequest } from 'next/server';

/**
 * Validates whether the incoming request is authorized as Jarvis.
 * Checks for `x-jarvis-key` or `Authorization: Bearer <token>`.
 * If JARVIS_API_KEY is not defined in the environment, it returns authorized: true (for development).
 */
export function verifyJarvisAuth(req: Request | NextRequest): { authorized: boolean; reason?: string } {
    const jarvisApiKey = process.env.JARVIS_API_KEY;

    // If no key is set on the server, allow in development
    if (!jarvisApiKey) {
        return { authorized: true };
    }

    const jarvisHeader = req.headers.get('x-jarvis-key');
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (jarvisHeader === jarvisApiKey || bearerToken === jarvisApiKey) {
        return { authorized: true };
    }

    return {
        authorized: false,
        reason: 'Invalid or missing Jarvis API Key. Provide x-jarvis-key header or Authorization: Bearer <JARVIS_API_KEY>',
    };
}
