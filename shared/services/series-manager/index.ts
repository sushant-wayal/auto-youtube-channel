import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../../.env.local') });

import { SeriesRedisService } from './redis-service';
import { SeriesAIService } from './ai-service';
import { SeriesState } from './types';

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
     * Finds the next series that should be scheduled and pushes an episode to the global queue
     */
    async scheduleNextEpisode(): Promise<boolean> {
        const activeIds = await this.redis.getActiveSeriesIds();
        if (activeIds.length === 0) {
            return false;
        }

        let selectedSeriesId: string | null = null;
        let selectedPriority = -1;
        let selectedTimestamp = "9999-12-31";

        // Find the series to schedule
        for (const id of activeIds) {
            const series = await this.redis.getSeries(id);
            if (!series || series.status !== 'active') continue;
            
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
                console.log(`Series ${series.id} queue is empty, expanding...`);
                const newEpisodes = await this.ai.generateNextEpisodes(series, 3);
                series.learningQueue.push(...newEpisodes);
            }

            // Find the first pending or in_progress item
            const nextItem = series.learningQueue.find(item => item.status === 'pending' || item.status === 'in_progress');
            
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
        console.log(`Scheduled episode "${nextItemPayload.topic}" (ID: ${nextItemPayload.seriesContext.episodeId}) for series "${nextItemPayload.seriesContext.seriesTitle}"`);
        return true;
    }

    /**
     * Called when an episode finishes uploading
     */
    async completeEpisode(seriesId: string, episodeId: string, topic: string, videoId: string): Promise<void> {
        let queueLengthAfter = 0;

        await this.redis.mutateSeries(seriesId, (series) => {
            // Idempotency check: Is it already in history?
            if (series.history.some(h => h.episodeId === episodeId)) {
                console.log(`Episode ${episodeId} already marked as completed. Skipping.`);
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

            series.uploadCount++;
            series.lastUploadTimestamp = new Date().toISOString();
            
            queueLengthAfter = series.learningQueue.length;
        });

        // If queue is getting low (e.g. <= 1 item left), expand it in the background
        // Doing this outside of mutateSeries so AI API calls don't block the optimistic lock
        if (queueLengthAfter > 0 && queueLengthAfter <= 1) {
            this.expandQueue(seriesId).catch(err => {
                console.error(`Background queue expansion failed for ${seriesId}:`, err);
            });
        }
    }

    /**
     * Generates more items for the learningQueue based on progress
     */
    async expandQueue(seriesId: string): Promise<void> {
        console.log(`Expanding queue for series ${seriesId}...`);
        
        // We get the series to send history to AI, but we don't hold a lock during AI generation.
        const currentSeries = await this.redis.getSeries(seriesId);
        if (!currentSeries) throw new Error(`Series ${seriesId} not found`);

        const newEpisodes = await this.ai.generateNextEpisodes(currentSeries, 3);
        
        // Now mutate atomically to add them
        await this.redis.mutateSeries(seriesId, (series) => {
            series.learningQueue.push(...newEpisodes);
        });
        
        console.log(`Added ${newEpisodes.length} new episodes to ${seriesId} queue.`);
    }

    async close() {
        await this.redis.close();
    }
}
