import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { YouTubeDataService } from '@/lib/youtube-data-service';

const redis = new Redis(process.env.REDIS_URL!);

/**
 * POST /api/thumbnail
 * Handles:
 * 1. action: "set-active": Sets the active thumbnail for the episode in Redis and pushes live to YouTube (if published)
 * 2. action: "set-ab-test": Configures or updates A/B testing experiment in Redis
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action, videoId, thumbnailUrl, abTesting } = body;

        if (!action) {
            return NextResponse.json({ ok: false, error: 'action is required' }, { status: 400 });
        }

        if (action === 'set-active') {
            if (!thumbnailUrl) {
                return NextResponse.json({ ok: false, error: 'thumbnailUrl is required' }, { status: 400 });
            }

            console.log(`[API] Setting active thumbnail to ${thumbnailUrl} for video ${videoId}`);

            // 1. Update Redis pipeline status metadata
            await redis.hset('pipeline:status:metadata', {
                thumbnailUrl,
                selectedThumbnailUrl: thumbnailUrl,
            });

            // 2. If video is already published on YouTube, update it live!
            const metadata = await redis.hgetall('pipeline:status:metadata');
            let youtubeUpdated = false;
            let youtubeError = null;

            if (metadata.youtubeId && process.env.YT_CLIENT_ID && process.env.YT_REFRESH_TOKEN) {
                try {
                    console.log(`[API] Updating live YouTube thumbnail for video ${metadata.youtubeId}`);
                    const ytService = new YouTubeDataService();
                    await ytService.updateThumbnail(metadata.youtubeId, thumbnailUrl);
                    youtubeUpdated = true;
                } catch (ytErr: any) {
                    console.error('[API] Failed to update YouTube thumbnail live:', ytErr?.message || ytErr);
                    youtubeError = ytErr?.message || String(ytErr);
                }
            }

            return NextResponse.json({
                ok: true,
                selectedThumbnailUrl: thumbnailUrl,
                youtubeUpdated,
                youtubeError,
            });
        }

        if (action === 'set-ab-test') {
            const enabled = abTesting?.enabled ?? body.enabled;
            const candidates = abTesting?.candidates ?? body.candidates;
            console.log(`[API] Setting A/B testing experiment: enabled=${enabled}, candidates count=${candidates?.length || 0}`);

            const abPayload = {
                videoId,
                enabled: !!enabled,
                candidates: Array.isArray(candidates) ? candidates : [],
                updatedAt: new Date().toISOString(),
            };

            await redis.set('pipeline:thumbnail:ab_test', JSON.stringify(abPayload));
            await redis.hset('pipeline:status:metadata', {
                abTestEnabled: enabled ? 'true' : 'false',
                abTestCandidates: JSON.stringify(candidates || []),
            });

            return NextResponse.json({
                ok: true,
                abTesting: abPayload,
            });
        }

        return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    } catch (error: any) {
        console.error('[API] /api/thumbnail error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
