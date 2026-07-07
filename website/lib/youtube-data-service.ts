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
}
