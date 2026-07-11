import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { SeriesRedisService } from '../shared/services/series-manager/redis-service';
import Redis from 'ioredis';

async function fixQueue() {
    console.log("Starting queue fix...");
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL not configured");
    const r = new Redis(redisUrl);
    const seriesRedis = new SeriesRedisService();

    try {
        // 1. Clear the queue completely
        console.log("Clearing global video:ideas queue...");
        await r.del('video:ideas');

        // 2. Reset all in_progress episodes back to pending
        console.log("Resetting all series episodes back to 'pending'...");
        const allSeriesIds = await seriesRedis.getActiveSeriesIds();
        
        for (const id of allSeriesIds) {
            await seriesRedis.mutateSeries(id, async (series) => {
                let resetCount = 0;
                for (const item of series.learningQueue) {
                    if (item.status === 'in_progress') {
                        item.status = 'pending';
                        resetCount++;
                    }
                }
                if (resetCount > 0) {
                    console.log(`Reset ${resetCount} episodes in series "${series.title}"`);
                }
            });
        }
        
        console.log("\nQueue and series states are now reset.");
        console.log("The background cron job will naturally fill the queue using fair rules:");
        console.log("- 1 episode per series max");
        console.log("- Falls back to standalone independent AI ideas when all series are queued");
        
    } catch(e) {
        console.error(e);
    } finally {
        await r.quit();
        await seriesRedis.close();
    }
}

fixQueue().then(() => process.exit(0)).catch(() => process.exit(1));
