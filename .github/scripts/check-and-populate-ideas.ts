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

        console.error(`⚠️  Queue is below threshold (${queueSize}/${MIN_QUEUE_SIZE}), running idea-selector worker...`);

        // Fetch existing queue ideas to avoid duplicates
        let existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);
        if (existingIdeas.length > 0) {
            console.error(`📋 Existing queue ideas (${existingIdeas.length}):`);
            existingIdeas.forEach((idea, i) => {
                console.error(`   ${i + 1}. ${idea}`);
            });
        }

        // Loop until the queue reaches MIN_QUEUE_SIZE
        let currentSize = queueSize;
        while (currentSize < MIN_QUEUE_SIZE) {
            console.error(`\n🚀 Running idea-selector worker (${currentSize}/${MIN_QUEUE_SIZE} ideas)...`);

            const result = await runIdeaSelector({
                existingQueueIdeas: existingIdeas,
            });

            if (!result.success || !result.selectedTopic) {
                throw new Error('Idea selector did not return a valid topic');
            }

            const topic = result.selectedTopic.topic;
            console.error(`📝 Selected topic: "${topic}"`);
            console.error(`📊 Performance score: ${result.selectedTopic.estimatedPerformance.score}/100`);

            // Add the topic to Redis queue
            await redis.rpush(QUEUE_KEY, topic);
            console.error(`✅ Added topic to Redis queue (${QUEUE_KEY})`);

            // Refresh existing ideas list so next iteration avoids duplicating this topic
            existingIdeas = await redis.lrange(QUEUE_KEY, 0, -1);
            currentSize = existingIdeas.length;
        }

        console.error(`\n✅ Queue filled to ${currentSize} ideas`);

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
