import { google, Auth, youtube_v3 } from 'googleapis';
import { YouTubeCommentThread, VideoMetadata, YouTubeComment } from '../types';

export class YouTubeCommentService {
    private youtube: youtube_v3.Youtube;
    private oauth2Client: Auth.OAuth2Client;
    private cachedChannelId: string | null = null;

    constructor() {
        const clientId = process.env.YT_CLIENT_ID;
        const clientSecret = process.env.YT_CLIENT_SECRET;
        const refreshToken = process.env.YT_REFRESH_TOKEN;

        if (!clientId || !clientSecret || !refreshToken) {
            throw new Error('YouTube credentials (YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN) are required');
        }

        this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        this.oauth2Client.setCredentials({ refresh_token: refreshToken });

        this.youtube = google.youtube({
            version: 'v3',
            auth: this.oauth2Client,
        });
    }

    /**
     * Get the channel owner ID to detect and skip own comments/replies
     */
    async getChannelId(): Promise<string> {
        if (this.cachedChannelId) {
            return this.cachedChannelId;
        }

        try {
            const res = await this.youtube.channels.list({
                part: ['id', 'snippet'],
                mine: true,
            });

            const channelId = res.data.items?.[0]?.id;
            if (!channelId) {
                throw new Error('Could not identify channel ID for authenticated user');
            }

            this.cachedChannelId = channelId;
            return channelId;
        } catch (error: any) {
            console.error('❌ Error fetching YouTube channel ID:', error?.message || error);
            throw error;
        }
    }

    /**
     * Fetch unreplied comment threads across the channel
     */
    async fetchRecentCommentThreads(maxResults: number = 30): Promise<YouTubeCommentThread[]> {
        const channelId = await this.getChannelId();
        console.error(`🔍 Fetching recent comment threads for channel ${channelId}...`);

        let rawItems: youtube_v3.Schema$CommentThread[] = [];

        try {
            // Primary method: fetch all comment threads related to the channel
            const res = await this.youtube.commentThreads.list({
                part: ['snippet', 'replies'],
                allThreadsRelatedToChannelId: channelId,
                order: 'time',
                maxResults: Math.min(maxResults, 100),
            });

            rawItems = res.data.items || [];
        } catch (error: any) {
            console.warn(`⚠️ allThreadsRelatedToChannelId query failed: ${error?.message}. Trying video-by-video fallback...`);
            rawItems = await this.fetchCommentsPerRecentVideo(30, maxResults);
        }

        // If primary returned 0 comments, try the video-by-video scan as well
        if (rawItems.length === 0) {
            console.warn('⚠️ No threads returned by channel query; checking recent videos directly...');
            rawItems = await this.fetchCommentsPerRecentVideo(30, maxResults);
        }

        const parsedThreads: YouTubeCommentThread[] = [];

        for (const item of rawItems) {
            const topLevel = item.snippet?.topLevelComment;
            if (!topLevel || !topLevel.id || !topLevel.snippet) continue;

            const videoId = item.snippet?.videoId;
            if (!videoId) continue; // Skip channel-level comments with no associated video

            const authorChannelId = topLevel.snippet.authorChannelId?.value;
            // Ignore comments made by the channel owner
            if (authorChannelId && authorChannelId === channelId) {
                continue;
            }

            const replies: YouTubeComment[] = (item.replies?.comments || []).map((c) => ({
                id: c.id || '',
                authorDisplayName: c.snippet?.authorDisplayName || 'Unknown',
                authorChannelId: c.snippet?.authorChannelId?.value || undefined,
                authorProfileImageUrl: c.snippet?.authorProfileImageUrl || undefined,
                textOriginal: c.snippet?.textOriginal || c.snippet?.textDisplay || '',
                likeCount: c.snippet?.likeCount || 0,
                publishedAt: c.snippet?.publishedAt || new Date().toISOString(),
                updatedAt: c.snippet?.updatedAt || new Date().toISOString(),
            }));

            // If the channel owner already replied to this thread, skip it!
            const hasChannelReply = replies.some((r) => r.authorChannelId === channelId);
            if (hasChannelReply) {
                continue;
            }

            parsedThreads.push({
                threadId: item.id!,
                videoId,
                totalReplyCount: item.snippet?.totalReplyCount || 0,
                canReply: item.snippet?.canReply ?? true,
                topLevelComment: {
                    id: topLevel.id,
                    authorDisplayName: topLevel.snippet.authorDisplayName || 'Unknown',
                    authorChannelId,
                    authorProfileImageUrl: topLevel.snippet.authorProfileImageUrl || undefined,
                    textOriginal: topLevel.snippet.textOriginal || topLevel.snippet.textDisplay || '',
                    likeCount: topLevel.snippet.likeCount || 0,
                    publishedAt: topLevel.snippet.publishedAt || new Date().toISOString(),
                    updatedAt: topLevel.snippet.updatedAt || new Date().toISOString(),
                },
                existingReplies: replies,
            });
        }

        console.error(`✅ Found ${parsedThreads.length} eligible comment threads to review`);
        return parsedThreads;
    }

    /**
     * Fallback to query comment threads per recent video
     */
    private async fetchCommentsPerRecentVideo(videoCount: number, maxResults: number): Promise<youtube_v3.Schema$CommentThread[]> {
        const results: youtube_v3.Schema$CommentThread[] = [];

        try {
            const channelRes = await this.youtube.channels.list({
                part: ['contentDetails'],
                mine: true,
            });
            const uploadsId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsId) return [];

            const playlistRes = await this.youtube.playlistItems.list({
                part: ['contentDetails'],
                playlistId: uploadsId,
                maxResults: Math.min(videoCount, 50),
            });

            const videoIds = (playlistRes.data.items || [])
                .map((i) => i.contentDetails?.videoId)
                .filter((id): id is string => Boolean(id));

            if (videoIds.length === 0) return [];

            // Batch fetch statistics to find which videos actually have comments
            const statsRes = await this.youtube.videos.list({
                part: ['statistics'],
                id: videoIds,
            });

            const videosWithComments = (statsRes.data.items || [])
                .filter((v) => Number(v.statistics?.commentCount || 0) > 0)
                .map((v) => v.id!);

            console.error(`🔍 Found ${videosWithComments.length} recent videos with comments out of ${videoIds.length} scanned.`);

            for (const vId of videosWithComments) {
                if (results.length >= maxResults) break;
                try {
                    const commentRes = await this.youtube.commentThreads.list({
                        part: ['snippet', 'replies'],
                        videoId: vId,
                        order: 'time',
                        maxResults: 20,
                    });
                    if (commentRes.data.items) {
                        results.push(...commentRes.data.items);
                    }
                } catch {
                    // Video comments might be disabled or empty
                }
            }
        } catch (error) {
            console.error('Failed video-by-video comment fallback:', error);
        }

        return results;
    }

    /**
     * Fetch video metadata (title, description)
     */
    async getVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
        try {
            const res = await this.youtube.videos.list({
                part: ['snippet'],
                id: [videoId],
            });

            const item = res.data.items?.[0];
            if (!item || !item.snippet) return null;

            return {
                id: videoId,
                title: item.snippet.title || '',
                description: item.snippet.description || '',
                publishedAt: item.snippet.publishedAt || '',
                tags: item.snippet.tags || [],
            };
        } catch (error) {
            console.error(`⚠️ Error fetching video metadata for ${videoId}:`, error);
            return null;
        }
    }

    /**
     * Post a reply to a comment thread
     */
    async postReply(threadId: string, replyText: string): Promise<string> {
        try {
            const res = await this.youtube.comments.insert({
                part: ['snippet'],
                requestBody: {
                    snippet: {
                        parentId: threadId,
                        textOriginal: replyText,
                    },
                },
            });

            const createdId = res.data.id;
            if (!createdId) throw new Error('No comment ID returned after insertion');
            return createdId;
        } catch (error: any) {
            console.error(`❌ Failed to post reply to thread ${threadId}:`, error?.message || error);
            throw error;
        }
    }

    /**
     * Download and parse the video transcript/captions
     */
    async getVideoTranscript(videoId: string): Promise<string | null> {
        try {
            const captionsRes = await this.youtube.captions.list({
                part: ['snippet'],
                videoId: videoId,
            });

            const items = captionsRes.data.items || [];
            if (items.length === 0) return null;

            // Prioritize English tracks (standard manual first, then ASR)
            const englishTrack =
                items.find(i => i.snippet?.language === 'en' && i.snippet?.trackKind !== 'asr') ||
                items.find(i => i.snippet?.language === 'en') ||
                items[0];

            if (!englishTrack || !englishTrack.id) return null;

            const dl = await this.youtube.captions.download(
                {
                    id: englishTrack.id,
                    tfmt: 'srt',
                },
                { responseType: 'text' }
            );

            if (!dl.data || typeof dl.data !== 'string') return null;

            return this.cleanSrtTranscript(dl.data);
        } catch (error: any) {
            console.warn(`⚠️ Could not fetch captions for video ${videoId}: ${error?.message || error}`);
            return null;
        }
    }

    /**
     * Convert raw SRT text with timestamps into clean readable prose
     */
    private cleanSrtTranscript(srtText: string): string {
        const lines = srtText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => {
                if (!line) return false;
                if (/^\d+$/.test(line)) return false; // Subtitle index
                if (/^\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(line)) return false; // Timestamp line
                return true;
            });

        const deduped: string[] = [];
        for (const line of lines) {
            const clean = line
                .replace(/<[^>]+>/g, '') // remove inline HTML tags
                .replace(/&amp;/g, '&')
                .replace(/&#39;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');

            if (deduped.length === 0 || deduped[deduped.length - 1] !== clean) {
                deduped.push(clean);
            }
        }

        return deduped.join(' ').replace(/\s+/g, ' ').trim();
    }
}
