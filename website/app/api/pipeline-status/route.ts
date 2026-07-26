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
            jobs,
        }: {
            overallStatus: 'success' | 'failure';
            videoId: string;
            videoTitle?: string;
            youtubeId?: string;
            jobs?: Record<string, string>;
        } = body;

        if (!overallStatus || !videoId) {
            return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
        }

        redis = getRedisClient();

        // Persist final overall status (handled by Redis status tracking)
        await redis.set('pipeline:status:overall', overallStatus, 'EX', 60 * 60 * 24 * 7);

        // Persist final job statuses from the pipeline summary
        if (jobs) {
            for (const [jobName, jobStatus] of Object.entries(jobs)) {
                if (jobStatus) {
                    await redis.hset('pipeline:status:jobs', jobName, jobStatus);
                }
            }
        }

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
        
        const overall = await redis.get('pipeline:status:overall');
        
        // If the new keys don't exist, check fallback for older runs
        if (!overall) {
            const raw = await redis.get(PIPELINE_STATUS_KEY);
            if (!raw) {
                return NextResponse.json({ ok: true, status: null });
            }
            return NextResponse.json({ ok: true, status: JSON.parse(raw) });
        }

        const metadata = await redis.hgetall('pipeline:status:metadata');
        const jobs = await redis.hgetall('pipeline:status:jobs');
        const sceneUrls = await redis.lrange('pipeline:status:sceneUrls', 0, -1);
        const voiceoverUrls = await redis.lrange('pipeline:status:voiceoverUrls', 0, -1);
        const ideasAdded = await redis.lrange('pipeline:status:ideasAdded', 0, -1);
        
        const shortsRaw = await redis.lrange(`pipeline:shorts:${metadata.videoId}`, 0, -1);
        const shorts = shortsRaw.map(s => {
            try { return JSON.parse(s); } catch { return null; }
        }).filter(Boolean);

        let parsedScriptData = null;
        let sceneNarrations: string[] = [];
        let shortHooks: string[] = [];
        let shortCaptions: string[] = [];

        if (metadata.scriptData) {
            try {
                parsedScriptData = JSON.parse(metadata.scriptData);
                if (parsedScriptData.scenes) {
                    sceneNarrations = parsedScriptData.scenes.map((s: any) => s.narration || '');
                }
                if (parsedScriptData.shorts) {
                    shortHooks = parsedScriptData.shorts.map((s: any) => s.hook || '');
                    shortCaptions = parsedScriptData.shorts.map((s: any) => s.instagramCaption || '');
                }
            } catch (e) {
                console.error('[pipeline-status] Error parsing scriptData:', e);
            }
        }

        const status = {
            overallStatus: overall,
            ranAt: metadata.ranAt || new Date().toISOString(),
            videoId: metadata.videoId,
            videoTitle: metadata.videoTitle || metadata.videoId,
            youtubeId: metadata.youtubeId || null,
            videoUrl: metadata.videoUrl || null,
            thumbnailUrl: metadata.thumbnailUrl || null,
            description: metadata.description || null,
            sceneUrls: sceneUrls || [],
            voiceoverUrls: voiceoverUrls || [],
            sceneNarrations,
            shortHooks,
            shortCaptions,
            ideasAdded: ideasAdded || [],
            scriptData: parsedScriptData,
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

        return NextResponse.json({ ok: true, status });
    } catch (err: any) {
        console.error('[pipeline-status] Error:', err);
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}
