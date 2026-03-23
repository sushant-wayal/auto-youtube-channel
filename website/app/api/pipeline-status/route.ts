import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

// Never cache this route — mobile app needs fresh data on every poll
export const dynamic = 'force-dynamic';

const PIPELINE_STATUS_KEY = 'pipeline:latest-status';
const PUSH_TOKEN_KEY = 'push:token';
const LONG_FORM_TIME_KEY = 'longform:publish-time';
const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

// The secret token GitHub Actions must pass in the Authorization header
// Set PIPELINE_WEBHOOK_SECRET in Vercel env vars
const WEBHOOK_SECRET = process.env.PIPELINE_WEBHOOK_SECRET;

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL not configured');
    return new Redis(redisUrl);
}

async function sendPushNotification(
    pushToken: string,
    overallStatus: 'success' | 'failure',
    videoId: string,
    videoTitle: string,
    scheduledTime: string | null,
    youtubeId?: string
) {
    const isSuccess = overallStatus === 'success';
    const title = isSuccess ? '✅ Video scheduled' : '❌ Pipeline failed';

    let body: string;
    if (!isSuccess) {
        body = `"${videoTitle}" — check job details in the app`;
    } else if (scheduledTime) {
        body = `"${videoTitle}" will go live at ${scheduledTime} IST`;
    } else {
        body = `"${videoTitle}" has been scheduled on YouTube`;
    }

    const message = {
        to: pushToken,
        sound: 'default',
        title,
        body,
        data: { youtubeId: youtubeId ?? null, videoId },
        channelId: 'pipeline',
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
    console.log('[pipeline-status] Push notification result:', JSON.stringify(result));
    return result;
}

// POST /api/pipeline-status  — called by GitHub Actions pipeline-summary job
export async function POST(req: NextRequest) {
    // Authenticate with shared secret
    const authHeader = req.headers.get('authorization');
    if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    let redis: Redis | null = null;
    try {
        const body = await req.json();
        const {
            overallStatus,
            videoId,
            videoTitle,
            youtubeId,
            videoUrl,
            thumbnailUrl,
            description,
            sceneUrls,
            voiceoverUrls,
            sceneNarrations,
            shortHooks,
            ideasAdded,
            scriptData,
            jobs,
        }: {
            overallStatus: 'success' | 'failure';
            videoId: string;
            videoTitle?: string;
            youtubeId?: string;
            videoUrl?: string;
            thumbnailUrl?: string;
            description?: string;
            sceneUrls?: string[];
            voiceoverUrls?: string[];
            sceneNarrations?: string[];
            shortHooks?: string[];
            ideasAdded?: string[];
            scriptData?: unknown;
            jobs: Record<string, string | null>;
        } = body;

        if (!overallStatus || !videoId || !jobs) {
            return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
        }

        redis = getRedisClient();

        // Read per-short results stored by each matrix runner
        const shortsRaw = await redis.lrange(`pipeline:shorts:${videoId}`, 0, -1);
        const shorts = shortsRaw.map(s => {
            try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean);

        const status = {
            overallStatus,
            ranAt: new Date().toISOString(),
            videoId,
            videoTitle: videoTitle ?? videoId,
            youtubeId: youtubeId ?? null,
            videoUrl: videoUrl ?? null,
            thumbnailUrl: thumbnailUrl ?? null,
            description: description ?? null,
            sceneUrls: sceneUrls ?? [],
            voiceoverUrls: voiceoverUrls ?? [],
            sceneNarrations: sceneNarrations ?? [],
            shortHooks: shortHooks ?? [],
            ideasAdded: ideasAdded ?? [],
            scriptData: scriptData ?? null,
            shorts,
            jobs: {
                populateIdeas: jobs.populateIdeas ?? null,
                generateScript: jobs.generateScript ?? null,
                renderScenes: jobs.renderScenes ?? null,
                generateVoiceover: jobs.generateVoiceover ?? null,
                assembleLongForm: jobs.assembleLongForm ?? null,
                generateThumbnail: jobs.generateThumbnail ?? null,
                uploadYoutube: jobs.uploadYoutube ?? null,
                shortsProcessing: jobs.shortsProcessing ?? null,
            },
        };

        // Persist status (7-day TTL so stale data auto-clears)
        await redis.set(PIPELINE_STATUS_KEY, JSON.stringify(status), 'EX', 60 * 60 * 24 * 7);

        // Send push notification if a token is registered
        const pushToken = await redis.get(PUSH_TOKEN_KEY);
        if (pushToken) {
            try {
                const scheduledTime = await redis.get(LONG_FORM_TIME_KEY); // e.g. "20:00"
                await sendPushNotification(pushToken, overallStatus, videoId, videoTitle ?? videoId, scheduledTime, youtubeId);
            } catch (pushErr: any) {
                // Non-fatal — log but don't fail the request
                console.error('[pipeline-status] Push notification error:', pushErr.message);
            }
        } else {
            console.log('[pipeline-status] No push token registered, skipping notification');
        }

        return NextResponse.json({ ok: true });
    } catch (err: any) {
        console.error('[pipeline-status] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}

// GET /api/pipeline-status  — polled by the mobile app
export async function GET() {
    let redis: Redis | null = null;
    try {
        redis = getRedisClient();
        const raw = await redis.get(PIPELINE_STATUS_KEY);
        if (!raw) {
            return NextResponse.json({ ok: true, status: null });
        }

        const status = JSON.parse(raw);
        const videoId = status.videoId;
        const shorts = status.shorts || [];

        // Fetch Instagram upload results
        const instagramRaw = await redis.lrange(`pipeline:instagram:${videoId}`, 0, -1);
        const instagramResults = instagramRaw.map(s => {
            try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean);

        // Fetch reel captions for all shorts
        const reelCaptions: Record<number, string> = {};
        for (const short of shorts) {
            try {
                const reelDataRaw = await redis.get(`reel:${videoId}:${short.shortIndex}`);
                if (reelDataRaw) {
                    const reelData = JSON.parse(reelDataRaw);
                    reelCaptions[short.shortIndex] = reelData.caption;
                }
            } catch {
                // Skip if not found
            }
        }

        // Merge Instagram data and captions into shorts array
        for (const short of shorts) {
            const igResult = instagramResults.find((r: any) => r.shortIndex === short.shortIndex);
            if (igResult) {
                (short as any).instagramId = igResult.instagramId;
                (short as any).instagramPermalink = igResult.permalink;
                (short as any).instagramUploadedAt = igResult.uploadedAt;
            }
            if (reelCaptions[short.shortIndex]) {
                (short as any).reelCaption = reelCaptions[short.shortIndex];
            }
        }

        status.shorts = shorts;

        return NextResponse.json({ ok: true, status });
    } catch (err: any) {
        console.error('[pipeline-status] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}
