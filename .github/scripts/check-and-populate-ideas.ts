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
const MIN_QUEUE_SIZE = 6; // Minimum ideas in queue before triggering selector

async function checkQueueAndPopulate(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.error('❌ Error: REDIS_URL not configured');
        process.exit(1);
    }

    const redis = new Redis(redisUrl);
    const seriesManager = new SeriesManager();

    try {
        await initPipeline('pending...', 'Initializing Pipeline...', process.env.GITHUB_RUN_ID);
        await setJobStatus('populateIdeas', 'running');

        const addedTopics: string[] = [];

        // Check current queue size
        const initialQueueSize = await redis.llen(QUEUE_KEY);
        console.error(`📊 Initial ideas queue size: ${initialQueueSize}`);

        // 1. Always evaluate if a new series should be auto-initiated by AI Strategist
        try {
            console.error(`🧠 Checking series strategist auto-initiation...`);
            await seriesManager.autoInitiateSeriesIfNeeded();
        } catch (stratErr) {
            console.error(`⚠️ Series strategist check failed:`, stratErr);
        }

        // 2. Schedule next episodes from any active series that have pending episodes ready
        console.error(`📚 Checking active series to schedule next episodes into queue...`);
        let scheduleMore = true;
        while (scheduleMore) {
            try {
                const scheduledSeries = await seriesManager.scheduleNextEpisode();
                if (scheduledSeries && typeof scheduledSeries === 'object' && scheduledSeries.topic) {
                    console.error(`✅ Scheduled series episode: "${scheduledSeries.topic}" (Series: ${scheduledSeries.seriesTitle || 'Active'})`);
                    addedTopics.push(scheduledSeries.topic);
                    await pushArrayItem('ideasAdded', scheduledSeries.topic);
                } else {
                    scheduleMore = false;
                }
            } catch (seriesErr) {
                console.error(`⚠️ Error scheduling series episode:`, seriesErr);
                scheduleMore = false;
            }
        }

        // 3. Check queue size after series scheduling
        let currentSize = await redis.llen(QUEUE_KEY);
        console.error(`📊 Queue size after series scheduling: ${currentSize}`);

        // Fetch existing queue ideas to avoid duplicates during standalone generation
        let existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);
        if (existingIdeas.length > 0) {
            console.error(`📋 Current queue topics (${existingIdeas.length}):`);
            existingIdeas.forEach((idea, i) => {
                let label = idea;
                try {
                    const parsed = JSON.parse(idea);
                    if (parsed.topic) label = parsed.topic;
                } catch {}
                console.error(`   ${i + 1}. ${label}`);
            });
        }

        // 4. If the queue is still below MIN_QUEUE_SIZE, populate with standalone topics using idea-selector
        while (currentSize < MIN_QUEUE_SIZE) {
            console.error(`\n🚀 Populating standalone idea (${currentSize}/${MIN_QUEUE_SIZE} ideas)...`);
            const result = await runIdeaSelector({
                existingQueueIdeas: existingIdeas,
            });

            if (!result.success || !result.selectedTopic) {
                console.error('⚠️ Idea selector did not return a valid topic, stopping standalone replenishment');
                break;
            }

            const topic = result.selectedTopic.topic;
            console.error(`📝 Selected topic: "${topic}"`);
            console.error(`📊 Performance score: ${result.selectedTopic.estimatedPerformance.score}/100`);

            // Add the topic to Redis queue
            await redis.rpush(QUEUE_KEY, topic);
            addedTopics.push(topic);
            await pushArrayItem('ideasAdded', topic);
            console.error(`✅ Added topic to Redis queue (${QUEUE_KEY})`);

            // Refresh existing ideas list so next iteration avoids duplicating this topic
            existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);
            currentSize = existingIdeas.length;
        }

        console.error(`\n✅ Finished idea population. Queue size: ${currentSize}. New ideas added this run: ${addedTopics.length}`);

        // Output added topics for GitHub Actions pipeline-summary
        console.log(`ideas_added=${JSON.stringify(addedTopics)}`);

        await redis.quit();
        await seriesManager.close();
        await setJobStatus('populateIdeas', 'success');
        console.error(`✅ Ideas queue check & populate completed successfully`);

    } catch (error) {
        await redis.quit();
        await seriesManager.close();
        await setJobStatus('populateIdeas', 'failure');
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
