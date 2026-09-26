/**
 * GitHub Actions Script: Check Redis Queue and Run Idea Selector if Empty
 * Called by: populate-ideas job
 * 
 * This script:
 * 1. Checks if Redis ideas queue is empty
 * 2. If empty, runs the idea-selector worker to generate a new idea
 * 3. Adds the generated idea to the Redis queue
 */

import Redis from 'ioredis';
import { runIdeaSelector } from '../../workers/idea-selector/src/index';
import { SeriesManager } from '../../shared/services/series-manager';
import { initPipeline, setJobStatus, pushArrayItem } from './utils/status-updater';

const QUEUE_KEY = 'video:ideas';
const TARGET_QUEUE_SIZE = 5; // Target ideas in queue (max 5 unless manually added)
const MAX_SERIES_IN_QUEUE = 2; // At most 2 series episodes out of 5 (ensuring at least 3 standalone ideas)

async function checkQueueAndPopulate(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.error('❌ Error: REDIS_URL not configured');
        process.exit(1);
    }

    const redis = new Redis(redisUrl);
    const seriesManager = new SeriesManager();

    try {
        const shouldInitPipeline = process.env.INIT_PIPELINE === 'true' && !!process.env.GITHUB_RUN_ID;
        if (shouldInitPipeline) {
            await initPipeline('pending...', 'Initializing Pipeline...', process.env.GITHUB_RUN_ID);
            await setJobStatus('populateIdeas', 'running');
        }

        const addedTopics: string[] = [];

        // 1. Audit series performance (shelves poor performers early, protects channel quality)
        try {
            console.error(`📊 Running series performance audit...`);
            await seriesManager.auditSeriesPerformance();
        } catch (auditErr) {
            console.error(`⚠️ Series performance audit non-critical error:`, auditErr);
        }

        // 2. Evaluate if a new series should be auto-initiated by AI Strategist (strictly throttled)
        try {
            console.error(`🧠 Checking series strategist auto-initiation...`);
            await seriesManager.autoInitiateSeriesIfNeeded();
        } catch (stratErr) {
            console.error(`⚠️ Series strategist check failed:`, stratErr);
        }

        // 3. Inspect current queue balance (Series vs Standalone)
        let existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);
        let currentSize = existingIdeas.length;
        console.error(`📊 Initial ideas queue size: ${currentSize} (target: ${TARGET_QUEUE_SIZE})`);

        let currentSeriesCount = 0;
        existingIdeas.forEach((idea, i) => {
            let isSeries = false;
            let label = idea;
            try {
                const parsed = JSON.parse(idea);
                if (parsed.isSeries || parsed.seriesContext) isSeries = true;
                if (parsed.topic) label = parsed.topic;
            } catch {}
            if (isSeries) currentSeriesCount++;
            console.error(`   ${i + 1}. [${isSeries ? 'SERIES' : 'STANDALONE'}] ${label}`);
        });

        const currentStandaloneCount = currentSize - currentSeriesCount;
        console.error(`⚖️ Queue Composition: ${currentSeriesCount} Series, ${currentStandaloneCount} Standalone (Max Series in queue: ${MAX_SERIES_IN_QUEUE})`);

        // 4. Schedule next series episodes ONLY IF currentSeriesCount < MAX_SERIES_IN_QUEUE
        if (currentSeriesCount < MAX_SERIES_IN_QUEUE && currentSize < TARGET_QUEUE_SIZE) {
            const slotsToFill = Math.min(MAX_SERIES_IN_QUEUE - currentSeriesCount, TARGET_QUEUE_SIZE - currentSize);
            console.error(`📚 Scheduling up to ${slotsToFill} series episode(s) to maintain healthy queue balance...`);
            while (currentSeriesCount < MAX_SERIES_IN_QUEUE && currentSize < TARGET_QUEUE_SIZE) {
                try {
                    const scheduledSeries = await seriesManager.scheduleNextEpisode();
                    if (scheduledSeries && typeof scheduledSeries === 'object' && scheduledSeries.topic) {
                        console.error(`✅ Scheduled series episode: "${scheduledSeries.topic}" (Series: ${scheduledSeries.seriesTitle || 'Active'})`);
                        addedTopics.push(scheduledSeries.topic);
                        await pushArrayItem('ideasAdded', scheduledSeries.topic);
                        currentSeriesCount++;
                        currentSize++;
                    } else {
                        break;
                    }
                } catch (seriesErr) {
                    console.error(`⚠️ Error scheduling series episode:`, seriesErr);
                    break;
                }
            }
        } else {
            console.error(`✅ Series quota satisfied (${currentSeriesCount}/${MAX_SERIES_IN_QUEUE}). Reserving all remaining slots for standalone ideas.`);
        }

        console.error(`📊 Queue size after series scheduling: ${currentSize}`);

        // Refresh existing queue ideas to avoid duplicates during standalone generation
        existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);

        // 5. Fill ALL remaining slots with standalone topics using idea-selector
        while (currentSize < TARGET_QUEUE_SIZE) {
            console.error(`\n🚀 Populating standalone idea (${currentSize + 1}/${TARGET_QUEUE_SIZE} queue slots)...`);
            const result = await runIdeaSelector({
                existingQueueIdeas: existingIdeas,
            });

            if (!result.success || !result.selectedTopic) {
                console.error('⚠️ Idea selector did not return a valid topic, stopping standalone replenishment');
                break;
            }

            const topic = result.selectedTopic.topic;
            console.error(`📝 Selected standalone topic: "${topic}"`);
            console.error(`📊 Performance score: ${result.selectedTopic.estimatedPerformance.score}/100`);

            // Add the topic to Redis queue
            await redis.rpush(QUEUE_KEY, topic);
            addedTopics.push(topic);
            await pushArrayItem('ideasAdded', topic);
            console.error(`✅ Added standalone topic to Redis queue (${QUEUE_KEY})`);

            // Refresh existing ideas list so next iteration avoids duplicating this topic
            existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);
            currentSize = existingIdeas.length;
        }

        console.error(`\n✅ Finished idea population. Final queue size: ${currentSize}. New ideas added this run: ${addedTopics.length}`);

        // Output added topics for GitHub Actions pipeline-summary
        console.log(`ideas_added=${JSON.stringify(addedTopics)}`);

        await redis.quit();
        await seriesManager.close();
        if (shouldInitPipeline) {
            await setJobStatus('populateIdeas', 'success');
        }
        console.error(`✅ Ideas queue check & populate completed successfully`);

    } catch (error) {
        await redis.quit();
        await seriesManager.close();
        if (process.env.INIT_PIPELINE === 'true' && !!process.env.GITHUB_RUN_ID) {
            await setJobStatus('populateIdeas', 'failure');
        }
        console.error('❌ Error in check-and-populate-ideas:', error);
        throw error;
    }
}

// Run the script
checkQueueAndPopulate()
    .then(() => {
        console.error('✅ Check and populate completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
