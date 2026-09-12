import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { verifyJarvisAuth } from '@/lib/jarvis-auth';

export const dynamic = 'force-dynamic';

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;
    return new Redis(redisUrl);
}

/**
 * GET /api/history
 * Returns the archive of past video generation pipeline runs.
 * Query parameters:
 *   - limit: number of runs to return (default: 10, max: 50)
 */
export async function GET(req: NextRequest) {
    const auth = verifyJarvisAuth(req);
    if (!auth.authorized) {
        return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
    }

    let redis: Redis | null = null;
    try {
        redis = getRedisClient();
        if (!redis) {
            return NextResponse.json({ ok: false, error: 'Redis is not configured' }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const limitParam = parseInt(searchParams.get('limit') || '10', 10);
        const limit = Math.min(Math.max(1, isNaN(limitParam) ? 10 : limitParam), 50);

        // Fetch history entries
        const rawEntries = await redis.lrange('pipeline:history', 0, limit - 1);
        let runs = rawEntries
            .map((entry) => {
                try {
                    return JSON.parse(entry);
                } catch {
                    return null;
                }
            })
            .filter(Boolean);

        // If history list is empty, include the current run from metadata if present
        if (runs.length === 0) {
            const currentMetadata = await redis.hgetall('pipeline:status:metadata');
            const overall = await redis.get('pipeline:status:overall');
            if (currentMetadata && currentMetadata.videoId) {
                runs = [
                    {
                        videoId: currentMetadata.videoId,
                        videoTitle: currentMetadata.videoTitle || currentMetadata.videoId,
                        overallStatus: overall || 'unknown',
                        youtubeId: currentMetadata.youtubeId || null,
                        videoUrl: currentMetadata.videoUrl || null,
                        thumbnailUrl: currentMetadata.thumbnailUrl || null,
                        ranAt: currentMetadata.ranAt || new Date().toISOString(),
                        runId: currentMetadata.runId || null,
                        errorSummary: currentMetadata.errorSummary || null,
                    },
                ];
            }
        }

        return NextResponse.json({
            ok: true,
            count: runs.length,
            runs,
        });
    } catch (err: any) {
        console.error('[history] Error fetching history:', err);
        return NextResponse.json({ ok: false, error: err.message || 'Internal server error' }, { status: 500 });
    } finally {
        await redis?.quit();
    }
}
