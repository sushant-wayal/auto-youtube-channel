import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env.local') });

import { SeriesRedisService } from './redis-service';
import { SeriesAIService } from './ai-service';
import { SeriesState } from './types';
import { YouTubeDataService } from '../youtube-data-service';

export class SeriesManager {
    private redis: SeriesRedisService;
    private ai: SeriesAIService;

    constructor() {
        this.redis = new SeriesRedisService();
        this.ai = new SeriesAIService();
    }

    /**
     * Initializes a new series by generating the first set of episodes
     */
    async initializeSeries(id: string, title: string, learningGoal: string): Promise<SeriesState> {
        const initialState: SeriesState = {
            id,
            title,
            learningGoal,
            status: "active",
            version: 1,
            priority: 1,
            uploadCount: 0,
            lastUploadTimestamp: new Date().toISOString(),
            learningQueue: [],
            history: []
        };

        const initialEpisodes = await this.ai.generateNextEpisodes(initialState, 3);
        initialState.learningQueue = initialEpisodes;

        await this.redis.saveSeries(initialState);
        return initialState;
    }

    /**
     * Checks if a new series should be initiated based on constraints and channel context.
     */
    async autoInitiateSeriesIfNeeded(): Promise<boolean> {
        const activeIds = await this.redis.getActiveSeriesIds();
        const activeCount = activeIds.length;

        if (activeCount >= 10) {
            console.error(`[SeriesManager] Active series count is ${activeCount} (max 10). Skipping series strategist.`);
            return false;
        }

        console.error(`[SeriesManager] Running Series Strategist AI (Active Series: ${activeCount})...`);

        // 1. Fetch historical series context
        const allSeries = await this.redis.getAllSeries();

        // 2. Fetch channel analytics (recent long-form videos)
        const youtubeDataService = new YouTubeDataService();
        let analytics: any[] = [];
        try {
            console.error(`[SeriesManager] Fetching channel performance data...`);
            const recentVideos = await youtubeDataService.fetchRecentVideos(30);
            const longFormVideos = recentVideos.filter(v => !v.isShort);
            if (longFormVideos.length > 0) {
                analytics = await youtubeDataService.fetchVideoAnalytics(longFormVideos, 90);
            }
        } catch (error) {
            console.error(`[SeriesManager] Failed to fetch YouTube analytics:`, error);
            // Continue without analytics if it fails, the AI will use other context
        }

        // 3. Ask AI
        const decision = await this.ai.decideAndInventNewSeries(allSeries, activeCount, analytics);

        if (decision.shouldCreate && decision.id && decision.title && decision.learningGoal) {
            console.error(`[SeriesManager] 🚀 AI Strategist decided to launch NEW SERIES: "${decision.title}"`);
            await this.initializeSeries(decision.id, decision.title, decision.learningGoal);
            return true;
        }

        console.error(`[SeriesManager] AI Strategist decided NOT to launch a new series at this time.`);
        return false;
    }

    /**
     * Finds the next series that should be scheduled and pushes an episode to the global queue
     */
    async scheduleNextEpisode(): Promise<{ scheduled: true; topic: string; seriesTitle?: string } | false> {
        const activeIds = await this.redis.getActiveSeriesIds();
        if (activeIds.length === 0) {
            return false;
        }

        let selectedSeriesId: string | null = null;
        let selectedPriority = -1;
        let selectedTimestamp = "9999-12-31";

        // Fetch current global queue to verify genuinely in-progress items
        const globalQueue = await this.redis.getGlobalQueue();
        const queuedEpisodeIds = new Set<string>();
        const queuedTopics = new Set<string>();
        for (const raw of globalQueue) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.seriesContext?.episodeId) queuedEpisodeIds.add(parsed.seriesContext.episodeId);
                if (parsed.topic) queuedTopics.add(parsed.topic.toLowerCase().trim());
            } catch {
                queuedTopics.add(raw.toLowerCase().trim());
            }
        }

        // Find the series to schedule
        for (const id of activeIds) {
            const series = await this.redis.getSeries(id);
            if (!series || series.status !== 'active') continue;
            
            // Check if series already has an episode in progress
            const inProgressItem = series.learningQueue.find(item => item.status === 'in_progress');
            if (inProgressItem) {
                // Verify if it is genuinely in the global queue
                const isGenuinelyQueued = queuedEpisodeIds.has(inProgressItem.episodeId) ||
                    queuedTopics.has(inProgressItem.topic.toLowerCase().trim());

                if (isGenuinelyQueued) {
                    // Truly in progress in the production queue, skip this series
                    continue;
                } else {
                    // Ghost in_progress state (item was popped or removed from video:ideas)
                    // Auto-heal by resetting it back to pending
                    console.error(`[SeriesManager] Auto-healing ghost in_progress episode "${inProgressItem.topic}" in series "${series.title}"`);
                    await this.redis.mutateSeries(id, async (s) => {
                        const ep = s.learningQueue.find(i => i.episodeId === inProgressItem.episodeId);
                        if (ep && ep.status === 'in_progress') {
                            ep.status = 'pending';
                        }
                    });
                }
            }

            if (series.priority > selectedPriority) {
                selectedSeriesId = id;
                selectedPriority = series.priority;
                selectedTimestamp = series.lastUploadTimestamp;
            } else if (series.priority === selectedPriority) {
                if (series.lastUploadTimestamp < selectedTimestamp) {
                    selectedSeriesId = id;
                    selectedTimestamp = series.lastUploadTimestamp;
                }
            }
        }

        if (!selectedSeriesId) return false;

        let nextItemPayload: any = null;

        await this.redis.mutateSeries(selectedSeriesId, async (series) => {
            if (series.learningQueue.length === 0) {
                console.error(`Series ${series.id} queue is empty, expanding...`);
                const newEpisodes = await this.ai.generateNextEpisodes(series, 3);
                series.learningQueue.push(...newEpisodes);
            }

            // Find the first pending item
            const nextItem = series.learningQueue.find(item => item.status === 'pending' || !item.status);
            
            if (!nextItem) {
                return; // Nothing to schedule
            }

            nextItem.status = 'in_progress';
            
            nextItemPayload = {
                topic: nextItem.topic,
                isSeries: true,
                seriesContext: {
                    seriesId: series.id,
                    seriesTitle: series.title,
                    learningGoal: series.learningGoal,
                    episodeId: nextItem.episodeId,
                    topic: nextItem.topic,
                    learningObjective: nextItem.learningObjective
                }
            };
        });

        if (!nextItemPayload) {
            return false;
        }

        // Push to global video:ideas queue
        await this.redis.pushToGlobalQueue(nextItemPayload);
        console.error(`Scheduled episode "${nextItemPayload.topic}" (ID: ${nextItemPayload.seriesContext.episodeId}) for series "${nextItemPayload.seriesContext.seriesTitle}"`);
        return {
            scheduled: true,
            topic: nextItemPayload.topic,
            seriesTitle: nextItemPayload.seriesContext?.seriesTitle,
        };
    }

    /**
     * Called when an episode finishes uploading
     */
    async completeEpisode(seriesId: string, episodeId: string, topic: string, videoId: string): Promise<void> {
        let shouldAutoExpand = false;
        await this.redis.mutateSeries(seriesId, (series) => {
            // Idempotency check: Is it already in history?
            if (series.history.some(h => h.episodeId === episodeId)) {
                console.error(`Episode ${episodeId} already marked as completed. Skipping.`);
                return;
            }

            const episodeNum = series.history.length + 1;
            series.history.push({
                episodeId,
                episodeNum,
                topic,
                videoId
            });

            // Remove it from the learningQueue now that it's complete
            series.learningQueue = series.learningQueue.filter(q => q.episodeId !== episodeId);

            series.uploadCount = (series.uploadCount || 0) + 1;
            series.lastUploadTimestamp = new Date().toISOString();
            
            // Check if queue has run out of pending episodes
            const remainingPending = series.learningQueue.filter(q => q.status === 'pending');
            if (series.learningQueue.length === 0 || remainingPending.length === 0) {
                // If this series is performing well, IT MUST NOT STOP! Auto-expand with next season.
                if (series.performanceRating === 'high') {
                    console.error(`🌟 Series "${series.title}" is a HIGH PERFORMER! Syllabus finished, but auto-renewing next batch.`);
                    shouldAutoExpand = true;
                } else {
                    // Underperforming or average track with finished syllabus concludes gracefully
                    series.status = 'completed';
                    series.statusReason = 'curriculum_completed';
                    console.error(`🎉 Series "${series.title}" has concluded its syllabus (${series.uploadCount} episodes total, rating: ${series.performanceRating || 'average'}).`);
                }
            }
        });

        if (shouldAutoExpand) {
            try {
                await this.expandQueue(seriesId);
            } catch (err) {
                console.error(`Failed to auto-expand high-performing series ${seriesId}:`, err);
            }
        }
    }

    /**
     * Reactivates or revives a completed/paused series (e.g. extending for a new season or resumed on demand)
     */
    async reactivateSeries(seriesId: string, addEpisodes: boolean = true): Promise<SeriesState | null> {
        console.error(`[SeriesManager] Reactivating series ${seriesId}...`);
        const currentSeries = await this.redis.getSeries(seriesId);
        if (!currentSeries) throw new Error(`Series ${seriesId} not found`);

        let newEpisodes: any[] = [];
        const pendingCount = currentSeries.learningQueue.filter(q => q.status === 'pending').length;
        if (addEpisodes && pendingCount === 0) {
            console.error(`[SeriesManager] Generating next season/curriculum for reactivated series "${currentSeries.title}"...`);
            newEpisodes = await this.ai.generateNextEpisodes(currentSeries, 3);
        }

        return await this.redis.mutateSeries(seriesId, (series) => {
            series.status = 'active';
            series.statusReason = 'reactivated';
            if (newEpisodes.length > 0) {
                series.learningQueue.push(...newEpisodes);
            }
        });
    }

    /**
     * Evaluates active series based on YouTube performance metrics.
     * Poorly performing series can be sunset/shelved early, while high performers are kept going and auto-expanded.
     */
    async auditSeriesPerformance(): Promise<{ audited: number; shelved: string[]; healthy: string[] }> {
        console.error(`[SeriesManager] 📊 Auditing active series performance...`);
        const activeIds = await this.redis.getActiveSeriesIds();
        if (activeIds.length === 0) {
            return { audited: 0, shelved: [], healthy: [] };
        }

        const youtubeDataService = new YouTubeDataService();
        let analytics: any[] = [];
        try {
            const recentVideos = await youtubeDataService.fetchRecentVideos(50);
            const longFormVideos = recentVideos.filter(v => !v.isShort);
            if (longFormVideos.length > 0) {
                analytics = await youtubeDataService.fetchVideoAnalytics(longFormVideos, 90);
            }
        } catch (err) {
            console.error(`[SeriesManager] Could not fetch YouTube analytics for audit:`, err);
            return { audited: 0, shelved: [], healthy: [] };
        }

        if (analytics.length === 0) {
            console.error(`[SeriesManager] No video analytics available to benchmark series.`);
            return { audited: 0, shelved: [], healthy: [] };
        }

        // Calculate channel median views for long-form videos
        const viewsList = analytics.map(a => a.views).filter(v => typeof v === 'number').sort((a, b) => a - b);
        const medianViews = viewsList.length > 0 ? viewsList[Math.floor(viewsList.length / 2)] : 0;
        const lowPerformanceThreshold = Math.max(15, Math.floor(medianViews * 0.35)); // Below 35% of median views

        console.error(`[SeriesManager] Benchmark stats: Median Views = ${medianViews}, Shelve Threshold = ${lowPerformanceThreshold}`);

        const shelved: string[] = [];
        const healthy: string[] = [];

        for (const id of activeIds) {
            const series = await this.redis.getSeries(id);
            if (!series || series.status !== 'active') continue;

            // Only audit series that have at least 1 uploaded episode with videoId
            const uploadedWithVideo = series.history.filter(h => h.videoId);
            if (uploadedWithVideo.length === 0) {
                healthy.push(series.title);
                continue;
            }

            // Find analytics for this series' videos
            const videoIds = new Set(uploadedWithVideo.map(h => h.videoId));
            const seriesAnalytics = analytics.filter(a => videoIds.has(a.videoId));

            if (seriesAnalytics.length === 0) {
                // Too recent for analytics data yet
                healthy.push(series.title);
                continue;
            }

            const avgViews = seriesAnalytics.reduce((acc, v) => acc + (v.views || 0), 0) / seriesAnalytics.length;
            const avgRetention = seriesAnalytics.reduce((acc, v) => acc + (v.averageViewPercentage || 0), 0) / seriesAnalytics.length;

            console.error(`[SeriesManager] Series "${series.title}": ${uploadedWithVideo.length} eps, Avg Views: ${Math.round(avgViews)}, Avg Retention: ${avgRetention.toFixed(1)}%`);

            // If series has >= 1 uploaded episode and avg views is critically below channel benchmark
            if (uploadedWithVideo.length >= 1 && avgViews < lowPerformanceThreshold && medianViews > 50) {
                console.error(`[SeriesManager] 📉 Shelving underperforming series "${series.title}" early (Avg views ${Math.round(avgViews)} < threshold ${lowPerformanceThreshold})`);
                await this.redis.mutateSeries(id, (s) => {
                    s.status = 'completed';
                    s.statusReason = 'performance_sunset';
                    s.performanceRating = 'underperforming';
                    s.lastAuditedAt = new Date().toISOString();
                    // Reset any pending ghost in_progress to pending
                    s.learningQueue.forEach(item => {
                        if (item.status === 'in_progress') item.status = 'pending';
                    });
                });
                shelved.push(series.title);
            } else {
                const isHigh = avgViews >= medianViews;
                await this.redis.mutateSeries(id, (s) => {
                    s.performanceRating = isHigh ? 'high' : 'average';
                    s.lastAuditedAt = new Date().toISOString();
                });
                healthy.push(series.title);

                // High performing series must continue! If pending queue is low (<= 1), auto-expand
                const pendingCount = series.learningQueue.filter(q => q.status === 'pending').length;
                if (isHigh && pendingCount <= 1) {
                    console.error(`[SeriesManager] 🚀 High-performing series "${series.title}" has low pending queue (${pendingCount}). Auto-expanding with new episodes!`);
                    try {
                        await this.expandQueue(id);
                    } catch (err) {
                        console.error(`[SeriesManager] Failed to auto-expand high-performing series ${id}:`, err);
                    }
                }
            }
        }

        // Check previously completed series for revival if views have surged
        try {
            const allSeries = await this.redis.getAllSeries();
            for (const series of allSeries) {
                if (series.status !== 'completed') continue;
                const uploadedWithVideo = series.history.filter(h => h.videoId);
                if (uploadedWithVideo.length === 0) continue;

                const videoIds = new Set(uploadedWithVideo.map(h => h.videoId));
                const seriesAnalytics = analytics.filter(a => videoIds.has(a.videoId));
                if (seriesAnalytics.length === 0) continue;

                const avgViews = seriesAnalytics.reduce((acc, v) => acc + (v.views || 0), 0) / seriesAnalytics.length;
                if (avgViews >= medianViews && medianViews > 50) {
                    console.error(`[SeriesManager] 🔄 Audience revival: Series "${series.title}" views surged (${Math.round(avgViews)} >= median ${medianViews})! Auto-reviving with new season.`);
                    await this.reactivateSeries(series.id, true);
                }
            }
        } catch (err) {
            console.error(`[SeriesManager] Revival check failed (non-fatal):`, err);
        }

        console.error(`[SeriesManager] Audit complete. ${shelved.length} series shelved early, ${healthy.length} active/healthy.`);
        return { audited: activeIds.length, shelved, healthy };
    }

    /**
     * Generates more items for the learningQueue based on progress
     */
    async expandQueue(seriesId: string): Promise<void> {
        console.error(`Expanding queue for series ${seriesId}...`);
        
        // We get the series to send history to AI, but we don't hold a lock during AI generation.
        const currentSeries = await this.redis.getSeries(seriesId);
        if (!currentSeries) throw new Error(`Series ${seriesId} not found`);

        const newEpisodes = await this.ai.generateNextEpisodes(currentSeries, 3);
        
        // Now mutate atomically to add them
        await this.redis.mutateSeries(seriesId, (series) => {
            series.learningQueue.push(...newEpisodes);
        });
        
        console.error(`Added ${newEpisodes.length} new episodes to ${seriesId} queue.`);
    }

    async close() {
        await this.redis.close();
    }
}
