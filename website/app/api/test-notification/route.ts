import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

const PUSH_TOKEN_KEY = 'push:token';
const LONG_FORM_TIME_KEY = 'longform:publish-time';
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL not configured');
    return new Redis(redisUrl);
}

export async function POST(req: NextRequest) {
    let redis: Redis | null = null;
    try {
        const body = await req.json().catch(() => ({}));
        const type: 'success' | 'failure' = body.type === 'failure' ? 'failure' : 'success';

        redis = getRedisClient();
        const pushToken = await redis.get(PUSH_TOKEN_KEY);

        if (!pushToken) {
            return NextResponse.json({
                ok: false,
                error: 'No push token found in Redis. Open the Serenity mobile app on a real device to register.',
            }, { status: 404 });
        }

        const scheduledTime = (await redis.get(LONG_FORM_TIME_KEY)) || '18:30';
        const sampleTitle = 'Why Is HTTP Stateless?';
        const isSuccess = type === 'success';

        const title = isSuccess
            ? '✅ SUCCESS • Video Ready & Scheduled'
            : '🚨 PIPELINE ALERT • Generation Halted';

        const subtitle = isSuccess
            ? 'Broadcast Queued • YouTube Premiere'
            : 'Action Required • Inspect Telemetry';

        const notificationBody = isSuccess
            ? `🎬 "${sampleTitle}" is ready • Goes live at ${scheduledTime} IST on YouTube`
            : `⚠️ Generation halted: Voiceover synthesis failed for Scene 3. Video: "${sampleTitle}". Tap to inspect.`;

        const message = {
            to: pushToken,
            sound: 'default',
            title,
            body: notificationBody,
            subtitle,
            data: {
                screen: 'Pipeline',
                targetScreen: 'Pipeline',
                videoId: 'test-preview-id',
                youtubeId: isSuccess ? 'dQw4w9WgXcQ' : null,
                status: type,
                videoTitle: sampleTitle,
            },
            channelId: isSuccess ? 'pipeline-success' : 'pipeline-alerts',
            priority: 'high',
        };

        const resp = await fetch(EXPO_PUSH_API, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!resp.ok) {
            const text = await resp.text();
            throw new Error(`Expo push API returned ${resp.status}: ${text}`);
        }

        const result = await resp.json();
        return NextResponse.json({
            ok: true,
            type,
            title,
            subtitle,
            body: notificationBody,
            result,
        });
    } catch (err: any) {
        console.error('[test-notification] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}
