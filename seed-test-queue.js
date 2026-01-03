#!/usr/bin/env node
/**
 * Seed test queue with video ideas
 * Usage: REDIS_URL=your_url node seed-test-queue.js
 */

const Redis = require('ioredis');

const TEST_IDEAS = [
    "How HTTP/3 is Faster Than HTTP/2",
    "Why WebAssembly Will Replace JavaScript",
    "Understanding Docker Containers in 5 Minutes",
    "What Happens When You Git Push",
    "How CDNs Make Websites Faster",
    "Why Microservices Can Be a Bad Idea",
    "Understanding JWT Authentication",
    "How Kubernetes Manages Containers",
    "Why GraphQL is Better Than REST",
    "Understanding Database Indexing",
];

async function seedQueue() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.error('❌ Error: REDIS_URL environment variable not set');
        console.error('Usage: REDIS_URL=redis://... node seed-test-queue.js');
        process.exit(1);
    }

    const redis = new Redis(redisUrl);
    const queueKey = 'video:ideas:test';

    try {
        // Check current queue length
        const currentLength = await redis.llen(queueKey);
        console.error(`📊 Current queue length: ${currentLength}`);

        if (currentLength > 0) {
            console.error(`\n⚠️  Queue already has ${currentLength} ideas.`);
            console.error('Do you want to:');
            console.error('  1. Append new ideas (keep existing)');
            console.error('  2. Replace all ideas (clear and add)');
            console.error('\nTo replace: node seed-test-queue.js --replace');

            if (!process.argv.includes('--replace')) {
                console.error('\n✅ Appending ideas...');
            } else {
                console.error('\n🗑️  Clearing existing queue...');
                await redis.del(queueKey);
            }
        }

        // Add test ideas to queue
        console.error(`\n📝 Adding ${TEST_IDEAS.length} test ideas to queue...`);
        for (const idea of TEST_IDEAS) {
            await redis.rpush(queueKey, idea);
            console.error(`  ✓ ${idea}`);
        }

        // Show final stats
        const finalLength = await redis.llen(queueKey);
        console.error(`\n✅ Queue seeded successfully!`);
        console.error(`📊 Total ideas in queue: ${finalLength}`);
        console.error(`🔑 Queue key: ${queueKey}`);

    } catch (error) {
        console.error('❌ Error seeding queue:', error);
        process.exit(1);
    } finally {
        await redis.quit();
    }
}

seedQueue();
