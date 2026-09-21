import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { YouTubeDataService, SlotRetentionStat } from '@/lib/youtube-data-service';

const redis = new Redis(process.env.REDIS_URL!);

const SHORTS_TIMES_KEY = 'shorts:publish-times';
const LONG_FORM_TIME_KEY = 'longform:publish-time';
const RETENTION_STATS_KEY = 'shorts:retention-stats';

const DEFAULT_SHORTS_TIMES = [
    '16:30', // Rank 1 (Best)
    '18:00', // Rank 2
    '20:00', // Rank 3
    '12:00', // Rank 4
    '14:00', // Rank 5 (Worst)
];

const DEFAULT_LONG_FORM_TIME = '18:30';

/**
 * GET /api/schedule-times
 * Returns both shorts and long-form schedule times, alongside
 * empirical YouTube Analytics retention statistics for shorts slots.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const forceRefresh = searchParams.get('refresh') === 'true';

        const shortsTimesJson = await redis.get(SHORTS_TIMES_KEY);
        const longFormTime = await redis.get(LONG_FORM_TIME_KEY);

        const shortsTimes: string[] = shortsTimesJson
            ? JSON.parse(shortsTimesJson)
            : DEFAULT_SHORTS_TIMES;

        let retentionStats: Record<string, SlotRetentionStat> = {};

        // Try getting cached retention stats from Redis
        const cachedRetentionJson = await redis.get(RETENTION_STATS_KEY);
        if (cachedRetentionJson && !forceRefresh) {
            try {
                retentionStats = JSON.parse(cachedRetentionJson);
            } catch {
                retentionStats = {};
            }
        }

        // If not cached or refresh requested, compute empirical retention from YouTube Analytics
        if (!cachedRetentionJson || forceRefresh || Object.keys(retentionStats).length === 0) {
            try {
                const ytService = new YouTubeDataService();
                retentionStats = await ytService.fetchShortsRetentionStats(shortsTimes);
                // Cache for 6 hours (21600 seconds)
                await redis.set(RETENTION_STATS_KEY, JSON.stringify(retentionStats), 'EX', 21600);
            } catch (err: any) {
                console.error('⚠️ Could not compute retention stats from YouTube:', err.message || err);
            }
        }

        return NextResponse.json({
            ok: true,
            shortsTimes,
            longFormTime: longFormTime || DEFAULT_LONG_FORM_TIME,
            retentionStats,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}

/**
 * POST /api/schedule-times
 * Updates shorts times (array of 5) or long-form time (string)
 * Body: { shortsTimes?: string[], longFormTime?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { shortsTimes, longFormTime } = body;

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

        // Update shorts times if provided
        if (shortsTimes) {
            if (!Array.isArray(shortsTimes) || shortsTimes.length !== 5) {
                return NextResponse.json({
                    ok: false,
                    error: 'shortsTimes must be an array of exactly 5 times',
                }, { status: 400 });
            }

            // Validate each time
            for (const time of shortsTimes) {
                if (!timeRegex.test(time)) {
                    return NextResponse.json({
                        ok: false,
                        error: `Invalid time format: ${time}. Use HH:MM (24-hour format)`,
                    }, { status: 400 });
                }
            }

            await redis.set(SHORTS_TIMES_KEY, JSON.stringify(shortsTimes));
            // Invalidate retention stats cache so it recalculates for new times
            await redis.del(RETENTION_STATS_KEY);
        }

        // Update long-form time if provided
        if (longFormTime) {
            if (!timeRegex.test(longFormTime)) {
                return NextResponse.json({
                    ok: false,
                    error: 'Invalid time format for longFormTime. Use HH:MM (24-hour format)',
                }, { status: 400 });
            }

            await redis.set(LONG_FORM_TIME_KEY, longFormTime);
        }

        // Return updated values
        const shortsTimesJson = await redis.get(SHORTS_TIMES_KEY);
        const updatedLongFormTime = await redis.get(LONG_FORM_TIME_KEY);

        return NextResponse.json({
            ok: true,
            shortsTimes: shortsTimesJson ? JSON.parse(shortsTimesJson) : DEFAULT_SHORTS_TIMES,
            longFormTime: updatedLongFormTime || DEFAULT_LONG_FORM_TIME,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}
