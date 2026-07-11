import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import Redis from 'ioredis';
import { SeriesManager } from '../shared/services/series-manager';

async function manualFairQueue() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL not configured");
    const r = new Redis(redisUrl);
    const seriesManager = new SeriesManager();
    const QUEUE_KEY = 'video:ideas';
    const TARGET_SIZE = 5;

    try {
        console.log("Manually populating the queue up to 5 items (fairly)...");
        
        let currentQueue = await r.lrange(QUEUE_KEY, 0, -1);
        console.log(`Initial queue size: ${currentQueue.length}`);

        // Try to schedule series episodes first (max 1 per series)
        while (currentQueue.length < TARGET_SIZE) {
            const scheduled = await seriesManager.scheduleNextEpisode();
            if (scheduled) {
                console.log("✅ Scheduled an episode from an active series");
                currentQueue = await r.lrange(QUEUE_KEY, 0, -1);
            } else {
                console.log("No more series episodes can be scheduled right now.");
                break;
            }
        }

        // If still under 5, fill with some standalone mock ideas to save Gemini API limits
        const mockStandaloneIdeas = [
            "The Psychology of Code: How UX Design Affects Developer Productivity",
            "Why We're All Building the Same SaaS: The Standardization of Tech",
            "The Untold History of the Null Pointer Exception",
            "Why Microservices are a Trap for 90% of Startups",
            "Are You a Coder or an Engineer? The Difference Matters"
        ];
        
        let mockIndex = 0;
        while (currentQueue.length < TARGET_SIZE) {
            const mockIdea = mockStandaloneIdeas[mockIndex % mockStandaloneIdeas.length];
            await r.rpush(QUEUE_KEY, mockIdea);
            console.log(`✅ Added standalone idea (mocked to save API): "${mockIdea}"`);
            mockIndex++;
            currentQueue = await r.lrange(QUEUE_KEY, 0, -1);
        }

        console.log(`\n🎉 Queue successfully filled to ${currentQueue.length} items!`);
        currentQueue.forEach((idea, i) => {
            console.log(`${i + 1}: ${idea}`);
        });

    } catch(e) {
        console.error(e);
    } finally {
        await r.quit();
        await seriesManager.close();
    }
}

manualFairQueue().then(() => process.exit(0)).catch(() => process.exit(1));
