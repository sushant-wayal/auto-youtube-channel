import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const PUSH_TOKEN_KEY = 'push:token';

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL not configured');
    return new Redis(redisUrl);
}

// POST /api/push-token  — save Expo push token from the mobile app
export async function POST(req: NextRequest) {
    let redis: Redis | null = null;
    try {
        const { token } = await req.json();
        if (!token || typeof token !== 'string') {
            return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
        }

        redis = getRedisClient();
        await redis.set(PUSH_TOKEN_KEY, token);
        console.log('[push-token] Saved push token:', token.substring(0, 30) + '…');
        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[push-token] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}

// GET /api/push-token  — retrieve stored token (for debugging)
export async function GET() {
    let redis: Redis | null = null;
    try {
        redis = getRedisClient();
        const token = await redis.get(PUSH_TOKEN_KEY);
        return NextResponse.json({ ok: true, token });
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}
