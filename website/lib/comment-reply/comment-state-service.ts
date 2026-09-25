import Redis from 'ioredis';
import { CommentReplySettings, ReplyHistoryEntry, VideoMetadata } from './types';

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

    private getCommentKey(entry: ReplyHistoryEntry): string {
        if (entry.commentId && !entry.commentId.startsWith('c-')) {
            return `cid:${entry.commentId}`;
        }
        if (entry.threadId && !entry.threadId.startsWith('th-')) {
            return `th:${entry.threadId}`;
        }
        const normalizedText = (entry.commentText || '').trim().toLowerCase().slice(0, 80);
        const normalizedAuthor = (entry.authorName || '').trim().toLowerCase();
        return `text:${normalizedAuthor}:${normalizedText}`;
    }

    async pushReplyHistory(entry: ReplyHistoryEntry): Promise<void> {
        try {
            const rawItems = await this.redis.lrange(HISTORY_LIST_KEY, 0, -1);
            const currentEntries: ReplyHistoryEntry[] = [];
            for (const raw of rawItems) {
                try {
                    currentEntries.push(JSON.parse(raw));
                } catch {}
            }

            const targetKey = this.getCommentKey(entry);

            // Filter out existing duplicates for the same comment
            const filtered = currentEntries.filter((existing) => {
                const existingKey = this.getCommentKey(existing);
                if (existingKey === targetKey) {
                    // If existing is already 'posted' and new entry is 'dry_run', discard the new dry run
                    if (existing.status === 'posted' && entry.status === 'dry_run') {
                        return true;
                    }
                    // Otherwise remove the old entry so the new one replaces it
                    return false;
                }
                return true;
            });

            // If the existing entry was 'posted' and we received a 'dry_run', don't add the dry run
            const alreadyPosted = currentEntries.some(
                (existing) => this.getCommentKey(existing) === targetKey && existing.status === 'posted'
            );
            if (!alreadyPosted || entry.status === 'posted') {
                filtered.unshift(entry);
            }

            const trimmed = filtered.slice(0, MAX_HISTORY_ITEMS);
            const multi = this.redis.multi();
            multi.del(HISTORY_LIST_KEY);
            if (trimmed.length > 0) {
                multi.rpush(HISTORY_LIST_KEY, ...trimmed.map((e) => JSON.stringify(e)));
            }
            await multi.exec();
        } catch (error) {
            console.error('⚠️ Redis error pushing reply history entry:', error);
        }
    }

    async getReplyHistory(limit: number = 20): Promise<ReplyHistoryEntry[]> {
        try {
            const rawItems = await this.redis.lrange(HISTORY_LIST_KEY, 0, MAX_HISTORY_ITEMS - 1);
            const parsed: ReplyHistoryEntry[] = [];
            for (const item of rawItems) {
                try {
                    parsed.push(JSON.parse(item));
                } catch {}
            }

            // Deduplicate: if an entry is 'posted', it must strictly take precedence over any 'dry_run'
            const uniqueMap = new Map<string, ReplyHistoryEntry>();
            for (const entry of parsed) {
                const key = this.getCommentKey(entry);
                const existing = uniqueMap.get(key);
                if (!existing) {
                    uniqueMap.set(key, entry);
                } else if (entry.status === 'posted' && existing.status !== 'posted') {
                    uniqueMap.set(key, entry);
                }
            }

            return Array.from(uniqueMap.values()).slice(0, limit);
        } catch (error) {
            console.error('⚠️ Redis error getting reply history:', error);
            return [];
        }
    }

    async updateHistoryEntryStatus(identifier: string, status: 'posted' | 'failed', error?: string): Promise<boolean> {
        try {
            const items = await this.redis.lrange(HISTORY_LIST_KEY, 0, -1);
            let updated = false;
            let targetKey: string | null = null;

            const parsedList: ReplyHistoryEntry[] = [];
            for (const raw of items) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed.id === identifier || parsed.commentId === identifier || parsed.threadId === identifier) {
                        parsed.status = status;
                        if (error) parsed.error = error;
                        updated = true;
                        targetKey = this.getCommentKey(parsed);
                    }
                    parsedList.push(parsed);
                } catch {}
            }

            // If we updated a comment to 'posted', ensure any other duplicate of that comment is removed or also marked 'posted'
            const finalMap = new Map<string, ReplyHistoryEntry>();
            for (const entry of parsedList) {
                const key = this.getCommentKey(entry);
                if (targetKey && key === targetKey) {
                    entry.status = status;
                }
                const existing = finalMap.get(key);
                if (!existing) {
                    finalMap.set(key, entry);
                } else if (entry.status === 'posted' && existing.status !== 'posted') {
                    finalMap.set(key, entry);
                }
            }

            if (updated) {
                const multi = this.redis.multi();
                multi.del(HISTORY_LIST_KEY);
                const resultList = Array.from(finalMap.values()).slice(0, MAX_HISTORY_ITEMS);
                if (resultList.length > 0) {
                    multi.rpush(HISTORY_LIST_KEY, ...resultList.map((e) => JSON.stringify(e)));
                }
                await multi.exec();
            }
            return updated;
        } catch (e) {
            console.error('⚠️ Redis error updating reply history entry status:', e);
            return false;
        }
    }

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

    async close(): Promise<void> {
        try {
            await this.redis.quit();
        } catch {
            // Ignore
        }
    }
}
