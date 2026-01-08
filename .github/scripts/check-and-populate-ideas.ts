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

const QUEUE_KEY = 'video:ideas';
const MIN_QUEUE_SIZE = 6; // Minimum ideas in queue before triggering selector

async function checkQueueAndPopulate(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.error('❌ Error: REDIS_URL not configured');
        process.exit(1);
    }

    const redis = new Redis(redisUrl);

    try {
        // Check current queue size
        const queueSize = await redis.llen(QUEUE_KEY);
        console.error(`📊 Current ideas queue size: ${queueSize}`);

        if (queueSize >= MIN_QUEUE_SIZE) {
            console.error(`✅ Queue has sufficient ideas (${queueSize}), skipping idea generation`);
            await redis.quit();
            return;
        }

        console.error(`⚠️  Queue is empty or below threshold, running idea-selector worker...`);

        // Run idea-selector worker
        console.error(`🚀 Running idea-selector worker...`);

        const result = await runIdeaSelector();

        if (!result.success || !result.selectedTopic) {
            throw new Error('Idea selector did not return a valid topic');
        }

        console.error(`✅ Idea selector worker completed`);

        const topic = result.selectedTopic.topic;
        console.error(`📝 Selected topic: "${topic}"`);

        // Add the topic to Redis queue
        await redis.rpush(QUEUE_KEY, topic);
        console.error(`✅ Added topic to Redis queue (${QUEUE_KEY})`);

        // Log additional context
        console.error(`📊 Performance score: ${result.selectedTopic.estimatedPerformance.score}/100`);
        console.error(`🎬 Target formats: ${result.selectedTopic.targetFormats.longForm ? '1 long-form' : ''}${result.selectedTopic.targetFormats.longForm && result.selectedTopic.targetFormats.shorts ? ' + ' : ''}${result.selectedTopic.targetFormats.shorts} shorts`);

        await redis.quit();
        console.error(`✅ Ideas queue populated successfully`);

    } catch (error) {
        await redis.quit();
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
