import { google, Auth } from "googleapis";

export interface YouTubeVideo {
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    tags?: string[];
    duration: string; // ISO 8601 duration
    isShort: boolean;
}

export interface YouTubeAnalytics {
    videoId: string;
    title: string;
    views: number;
    impressions: number;
    ctr: number; // click-through rate
    averageViewDuration: number; // seconds
    averageViewPercentage: number; // retention %
    comments: number;
    likes: number;
    publishedAt: string;
    isShort: boolean;
}

export interface SlotRetentionStat {
    estimatedRetention: number;
    sampleCount: number;
    hasHistory?: boolean;
    isCalibrating?: boolean;
}

/**
 * YouTube Data API Service
 * Fetches channel videos and analytics automatically
 */
export class YouTubeDataService {
    private youtube;
    private youtubeAnalytics;
    private oauth2Client: Auth.OAuth2Client;

    constructor() {
        this.oauth2Client = new google.auth.OAuth2(
            process.env.YT_CLIENT_ID,
            process.env.YT_CLIENT_SECRET
        );

        this.oauth2Client.setCredentials({
            refresh_token: process.env.YT_REFRESH_TOKEN,
        });

        this.youtube = google.youtube({
            version: "v3",
            auth: this.oauth2Client,
        });

        this.youtubeAnalytics = google.youtubeAnalytics({
            version: "v2",
            auth: this.oauth2Client,
        });
    }

    /**
     * Fetch channel statistics overview
     */
    async fetchChannelOverview(): Promise<{
        title: string;
        subscriberCount: number;
        viewCount: number;
        videoCount: number;
    }> {
        try {
            const response = await this.youtube.channels.list({
                part: ['snippet', 'statistics'],
                mine: true,
            });

            const channel = response.data.items?.[0];
            return {
                title: channel?.snippet?.title || '',
                subscriberCount: Number(channel?.statistics?.subscriberCount) || 0,
                viewCount: Number(channel?.statistics?.viewCount) || 0,
                videoCount: Number(channel?.statistics?.videoCount) || 0,
            };
        } catch (error) {
            console.error('❌ Error fetching channel overview:', error);
            throw error;
        }
    }

    /**
     * Fetch recent channel videos
     */
    async fetchRecentVideos(maxResults: number = 50): Promise<YouTubeVideo[]> {
        console.error(`📹 Fetching recent ${maxResults} videos from channel...`);

        try {
            // Get channel uploads playlist ID
            const channelResponse = await this.youtube.channels.list({
                part: ['contentDetails'],
                mine: true,
            });

            const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsPlaylistId) {
                throw new Error('Could not find uploads playlist');
            }

            // Fetch videos from uploads playlist
            const playlistResponse = await this.youtube.playlistItems.list({
                part: ['snippet', 'contentDetails'],
                playlistId: uploadsPlaylistId,
                maxResults,
            });

            const videoIds = playlistResponse.data.items
                ?.map(item => item.contentDetails?.videoId)
                .filter(Boolean) as string[];

            if (!videoIds || videoIds.length === 0) {
                console.error('⚠️ No videos found in channel');
                return [];
            }

            // Get detailed video info including duration
            const videosResponse = await this.youtube.videos.list({
                part: ['snippet', 'contentDetails'],
                id: videoIds,
            });

            const videos: YouTubeVideo[] = videosResponse.data.items?.map(item => {
                const duration = item.contentDetails?.duration || 'PT0S';
                const durationSeconds = this.parseDuration(duration);
                const isShort = durationSeconds <= 60; // Shorts are <= 60 seconds

                return {
                    id: item.id!,
                    title: item.snippet?.title || '',
                    description: item.snippet?.description || '',
                    publishedAt: item.snippet?.publishedAt || '',
                    tags: item.snippet?.tags || [],
                    duration,
                    isShort,
                };
            }) || [];

            console.error(`✅ Fetched ${videos.length} videos (${videos.filter(v => v.isShort).length} shorts, ${videos.filter(v => !v.isShort).length} long-form)`);
            return videos;

        } catch (error) {
            console.error('❌ Error fetching videos:', error);
            throw error;
        }
    }

    /**
     * Fetch analytics for videos
     */
    async fetchVideoAnalytics(videos: YouTubeVideo[], daysBack: number = 30): Promise<YouTubeAnalytics[]> {
        console.error(`📊 Fetching analytics for ${videos.length} videos (last ${daysBack} days)...`);

        const analytics: YouTubeAnalytics[] = [];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        try {
            // Batch fetch analytics
            for (const video of videos) {
                try {
                    const response = await this.youtubeAnalytics.reports.query({
                        ids: 'channel==MINE',
                        startDate: startDate.toISOString().split('T')[0],
                        endDate: endDate.toISOString().split('T')[0],
                        metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,cardImpressions,cardClickRate,comments,likes',
                        dimensions: 'video',
                        filters: `video==${video.id}`,
                        sort: '-views',
                    });

                    const row = response.data.rows?.[0];
                    if (row) {
                        analytics.push({
                            videoId: video.id,
                            title: video.title,
                            views: Number(row[1]) || 0,
                            impressions: Number(row[5]) || Number(row[1]) || 0, // cardImpressions or fallback to views
                            ctr: Number(row[6]) || 0, // cardClickRate
                            averageViewDuration: Number(row[3]) || 0,
                            averageViewPercentage: Number(row[4]) || 0,
                            comments: Number(row[7]) || 0,
                            likes: Number(row[8]) || 0,
                            publishedAt: video.publishedAt,
                            isShort: video.isShort,
                        });
                    }
                } catch (error: any) {
                    // Skip videos with no analytics data
                    if (!error.message?.includes('insufficientPermissions')) {
                        console.error(`⚠️ Could not fetch analytics for video ${video.id}:`, error.message);
                    }
                }
            }

            console.error(`✅ Fetched analytics for ${analytics.length} videos`);
            return analytics;

        } catch (error) {
            console.error('❌ Error fetching analytics:', error);
            throw error;
        }
    }

    /**
     * Parse ISO 8601 duration to seconds
     */
    private parseDuration(duration: string): number {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return 0;

        const hours = parseInt(match[1] || '0');
        const minutes = parseInt(match[2] || '0');
        const seconds = parseInt(match[3] || '0');

        return hours * 3600 + minutes * 60 + seconds;
    }

    /**
     * Fetch empirical retention percentage for shorts published within ±30 mins of target slot times.
     * Computes the average retention of the last up to 30 shorts published in that time window.
     */
    async fetchShortsRetentionStats(slotTimes: string[]): Promise<Record<string, SlotRetentionStat>> {
        const results: Record<string, SlotRetentionStat> = {};

        // Default all slots with 0 samples and hasHistory: false
        for (const slot of slotTimes) {
            results[slot] = {
                estimatedRetention: 0,
                sampleCount: 0,
                hasHistory: false,
                isCalibrating: false,
            };
        }

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 120);
            const endDate = new Date();
            // 2 days ago to account for YouTube Analytics 24-48h reporting latency
            endDate.setDate(endDate.getDate() - 2);

            // Fetch video analytics in bulk (single request for up to 200 videos)
            const analyticsRes = await this.youtubeAnalytics.reports.query({
                ids: 'channel==MINE',
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                metrics: 'views,averageViewPercentage',
                dimensions: 'video',
                maxResults: 200,
                sort: '-views',
            });

            const rows = analyticsRes.data.rows || [];
            if (rows.length === 0) {
                return results;
            }

            const videoIds = rows.map((r: any[]) => r[0]).filter(Boolean);

            // Fetch video metadata in chunks of 50 to get duration and publishedAt
            const chunks: string[][] = [];
            for (let i = 0; i < videoIds.length; i += 50) {
                chunks.push(videoIds.slice(i, i + 50));
            }

            const vidsResponses = await Promise.all(
                chunks.map(chunk =>
                    this.youtube.videos.list({
                        part: ['contentDetails', 'snippet'],
                        id: chunk,
                    })
                )
            );

            const allVideos = vidsResponses.flatMap(res => res.data.items || []);
            const analyticsMap = new Map(rows.map((r: any[]) => [r[0], { views: Number(r[1]) || 0, retention: Number(r[2]) || 0 }]));

            // Filter to Shorts (duration <= 60 seconds)
            const shorts = allVideos.filter(v => {
                const dur = v.contentDetails?.duration || '';
                const seconds = this.parseDuration(dur);
                return seconds > 0 && seconds <= 60;
            });

            for (const slotTime of slotTimes) {
                const parts = slotTime.split(':').map(Number);
                if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;

                const slotMin = parts[0] * 60 + parts[1];
                const matching: { publishedAt: string; retention: number }[] = [];

                for (const short of shorts) {
                    if (!short.snippet?.publishedAt) continue;
                    const pub = new Date(short.snippet.publishedAt);
                    // Convert UTC to IST (+5:30 = 330 minutes)
                    const istMin = (pub.getUTCHours() * 60 + pub.getUTCMinutes() + 330) % 1440;
                    let diff = Math.abs(istMin - slotMin);
                    if (diff > 720) diff = 1440 - diff;

                    // Window of ±35 minutes around slot time
                    if (diff <= 35) {
                        const ana = analyticsMap.get(short.id!);
                        if (ana && ana.retention > 0) {
                            matching.push({
                                publishedAt: short.snippet.publishedAt,
                                retention: ana.retention,
                            });
                        }
                    }
                }

                // Sort newest to oldest
                matching.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

                // Take last up to 30 shorts
                const sample = matching.slice(0, 30);

                if (sample.length > 0) {
                    const avg = sample.reduce((acc, s) => acc + s.retention, 0) / sample.length;
                    results[slotTime] = {
                        estimatedRetention: Math.round(avg * 10) / 10,
                        sampleCount: sample.length,
                        hasHistory: true,
                        isCalibrating: false,
                    };
                } else {
                    results[slotTime] = {
                        estimatedRetention: 0,
                        sampleCount: 0,
                        hasHistory: false,
                        isCalibrating: false,
                    };
                }
            }

            return results;
        } catch (error) {
            console.error('❌ Error computing shorts retention stats:', error);
            throw error;
        }
    }
}
