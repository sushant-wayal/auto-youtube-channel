#!/usr/bin/env node
/**
 * Add video ideas to production queue
 * Usage: REDIS_URL=your_url node add-ideas-to-prod.js
 */

const Redis = require('ioredis');

const IDEAS = [
    "Message Queues and Why APIs are Not Enough?",
    "Why Databse Migrations are Risky?",
    "What happens When you type URL and press Enter?",
    "Why NoSQL Database even Exist?",
    "What is Caching and Why it makes App feel Fast?",
];

async function addIdeas() {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.log('❌ Error: REDIS_URL environment variable not set');
        console.log('Usage: REDIS_URL=redis://... node add-ideas-to-prod.js');
        process.exit(1);
    }

    const redis = new Redis(redisUrl);
    const queueKey = 'video:ideas';

    try {
        console.log('🚀 Adding ideas to production queue...\n');

        for (const idea of IDEAS) {
            await redis.rpush(queueKey, idea);
            console.log(`✅ ${idea}`);
        }

        const totalCount = await redis.llen(queueKey);
        console.log(`\n✅ Added ${IDEAS.length} ideas to production queue`);
        console.log(`📊 Total ideas in production queue: ${totalCount}`);

    } catch (error) {
        console.log('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await redis.quit();
    }
}

addIdeas();
