import { NextRequest, NextResponse } from 'next/server';
import { YouTubeDataService } from '@/lib/youtube-data-service';
import { verifyJarvisAuth } from '@/lib/jarvis-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/analytics
 * Returns YouTube channel overview statistics and recent video metrics.
 * Query Parameters:
 *   - limit: number of recent videos to analyze (default: 10, max: 50)
 *   - daysBack: time window for analytics in days (default: 30)
 */
export async function GET(req: NextRequest) {
    const auth = verifyJarvisAuth(req);
    if (!auth.authorized) {
        return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
    }

    if (!process.env.YT_CLIENT_ID || !process.env.YT_CLIENT_SECRET || !process.env.YT_REFRESH_TOKEN) {
        return NextResponse.json(
            {
                ok: false,
                error: 'YouTube API credentials (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN) are not configured',
            },
            { status: 503 }
        );
    }

    try {
        const { searchParams } = new URL(req.url);
        const limitParam = parseInt(searchParams.get('limit') || '10', 10);
        const daysBackParam = parseInt(searchParams.get('daysBack') || '30', 10);

        const limit = Math.min(Math.max(1, isNaN(limitParam) ? 10 : limitParam), 50);
        const daysBack = Math.min(Math.max(1, isNaN(daysBackParam) ? 30 : daysBackParam), 90);

        const youtubeService = new YouTubeDataService();

        // 1. Fetch channel overview
        let channelOverview = null;
        try {
            channelOverview = await youtubeService.fetchChannelOverview();
        } catch (overviewErr: any) {
            console.error('[analytics] Error fetching channel overview:', overviewErr.message);
        }

        // 2. Fetch recent videos
        const recentVideos = await youtubeService.fetchRecentVideos(limit);

        // 3. Fetch analytics for these videos
        let videoAnalytics: any[] = [];
        try {
            videoAnalytics = await youtubeService.fetchVideoAnalytics(recentVideos, daysBack);
        } catch (analyticsErr: any) {
            console.error('[analytics] Analytics reports query error:', analyticsErr.message);
            // Fallback: return videos without reporting metrics
            videoAnalytics = recentVideos.map(v => ({
                videoId: v.id,
                title: v.title,
                publishedAt: v.publishedAt,
                isShort: v.isShort,
                views: 0,
                likes: 0,
                comments: 0,
            }));
        }

        return NextResponse.json({
            ok: true,
            channel: channelOverview,
            videoCount: recentVideos.length,
            recentVideos: videoAnalytics,
        });
    } catch (err: any) {
        console.error('[analytics] General error:', err);
        return NextResponse.json(
            { ok: false, error: err.message || 'Failed to fetch YouTube analytics' },
            { status: 500 }
        );
    }
}
