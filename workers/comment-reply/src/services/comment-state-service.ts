import Redis from 'ioredis';
import { CommentReplySettings, ReplyHistoryEntry, VideoMetadata } from '../types';

const REPLIED_SET_KEY = 'youtube:comments:replied';
const REPLIED_KEY_PREFIX = 'youtube:comment:replied:';
const REPLIED_TTL_SECONDS = 86400 * 30; // 30 days
const SETTINGS_KEY = 'settings:auto_comment_reply';
const HISTORY_LIST_KEY = 'comments:reply_history';
const VIDEO_META_PREFIX = 'youtube:video:meta:';
const MAX_HISTORY_ITEMS = 100;
const VIDEO_META_TTL_SECONDS = 86400; // 24 hours

export const DEFAULT_SETTINGS: CommentReplySettings = {
    enabled: true,
    dryRun: false,
    maxRepliesPerRun: 5,
    tone: 'friendly',
    replyToQuestionsOnly: false,
    customInstructions: 'Be friendly, concise, authentic, and genuinely helpful. Never speak like an AI or use generic boilerplate.',
};

export class CommentStateService {
    private redis: Redis;

    constructor(redisUrl?: string) {
        const url = redisUrl || process.env.REDIS_URL;
        if (!url) {
            throw new Error('REDIS_URL is required for CommentStateService');
        }
        this.redis = new Redis(url);
    }

    /**
     * Check if comment has already been replied to (idempotency check)
     */
    async isCommentReplied(commentId: string): Promise<boolean> {
        try {
            const exists = await this.redis.exists(`${REPLIED_KEY_PREFIX}${commentId}`);
            if (exists === 1) return true;

            const isMember = await this.redis.sismember(REPLIED_SET_KEY, commentId);
            return isMember === 1;
        } catch (error) {
            console.error(`⚠️ Redis error checking replied status for ${commentId}:`, error);
            return false;
        }
    }

    /**
     * Mark comment as replied in Redis with 30-day TTL
     */
    async markCommentReplied(commentId: string): Promise<void> {
        try {
            await this.redis.set(
                `${REPLIED_KEY_PREFIX}${commentId}`,
                '1',
                'EX',
                REPLIED_TTL_SECONDS
            );
        } catch (error) {
            console.error(`⚠️ Redis error marking comment ${commentId} as replied:`, error);
        }
    }

    /**
     * Get auto comment reply settings from Redis
     */
    async getSettings(): Promise<CommentReplySettings> {
        try {
            const data = await this.redis.get(SETTINGS_KEY);
            if (!data) {
                return DEFAULT_SETTINGS;
            }
            return {
                ...DEFAULT_SETTINGS,
                ...JSON.parse(data),
            };
        } catch (error) {
            console.error('⚠️ Redis error getting comment reply settings:', error);
            return DEFAULT_SETTINGS;
        }
    }

    /**
     * Update auto comment reply settings in Redis
     */
    async updateSettings(settings: Partial<CommentReplySettings>): Promise<CommentReplySettings> {
        try {
            const current = await this.getSettings();
            const updated: CommentReplySettings = {
                ...current,
                ...settings,
            };
            await this.redis.set(SETTINGS_KEY, JSON.stringify(updated));
            return updated;
        } catch (error) {
            console.error('⚠️ Redis error updating comment reply settings:', error);
            throw error;
        }
    }

    /**
     * Append a reply event to the audit history feed
     */
    async pushReplyHistory(entry: ReplyHistoryEntry): Promise<void> {
        try {
            const serialized = JSON.stringify(entry);
            const multi = this.redis.multi();
            multi.lpush(HISTORY_LIST_KEY, serialized);
            multi.ltrim(HISTORY_LIST_KEY, 0, MAX_HISTORY_ITEMS - 1);
            await multi.exec();
        } catch (error) {
            console.error('⚠️ Redis error pushing reply history entry:', error);
        }
    }

    /**
     * Retrieve recent reply history entries
     */
    async getReplyHistory(limit: number = 20): Promise<ReplyHistoryEntry[]> {
        try {
            const entries = await this.redis.lrange(HISTORY_LIST_KEY, 0, Math.min(limit, MAX_HISTORY_ITEMS) - 1);
            return entries.map((item) => JSON.parse(item) as ReplyHistoryEntry);
        } catch (error) {
            console.error('⚠️ Redis error getting reply history:', error);
            return [];
        }
    }

    /**
     * Get cached video metadata to conserve YouTube API quota
     */
    async getCachedVideoMeta(videoId: string): Promise<VideoMetadata | null> {
        try {
            const data = await this.redis.get(`${VIDEO_META_PREFIX}${videoId}`);
            if (!data) return null;
            return JSON.parse(data) as VideoMetadata;
        } catch (error) {
            console.error(`⚠️ Redis error reading video metadata for ${videoId}:`, error);
            return null;
        }
    }

    /**
     * Cache video metadata
     */
    async setCachedVideoMeta(metadata: VideoMetadata): Promise<void> {
        try {
            await this.redis.set(
                `${VIDEO_META_PREFIX}${metadata.id}`,
                JSON.stringify(metadata),
                'EX',
                VIDEO_META_TTL_SECONDS
            );
        } catch (error) {
            console.error(`⚠️ Redis error caching video metadata for ${metadata.id}:`, error);
        }
    }

    /**
     * Get cached video transcript
     */
    async getCachedTranscript(videoId: string): Promise<string | null> {
        try {
            return await this.redis.get(`video:transcript:${videoId}`);
        } catch (error) {
            console.error(`⚠️ Redis error reading video transcript for ${videoId}:`, error);
            return null;
        }
    }

    /**
     * Cache video transcript (30 days TTL)
     */
    async setCachedTranscript(videoId: string, transcript: string): Promise<void> {
        try {
            await this.redis.set(`video:transcript:${videoId}`, transcript, 'EX', 86400 * 30);
        } catch (error) {
            console.error(`⚠️ Redis error caching video transcript for ${videoId}:`, error);
        }
    }

    /**
     * Cleanly close Redis connection
     */
    async close(): Promise<void> {
        try {
            await this.redis.quit();
        } catch {
            // Ignore on shutdown
        }
    }
}
