import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env.local') });

import { SeriesRedisService } from '../shared/services/series-manager/redis-service';
import Redis from 'ioredis';

async function fillQueue() {
    console.log("Starting queue cleanup and fill...");
    
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error("REDIS_URL not configured");
    const r = new Redis(redisUrl);
    const seriesRedis = new SeriesRedisService();

    try {
        // 1. Deduplicate
        const queue = await r.lrange('video:ideas', 0, -1);
        console.log(`Original queue length: ${queue.length}`);
        
        const seen = new Set();
        const cleaned = [];
        
        for (const item of queue) {
            try {
                if (!seen.has(item)) {
                    seen.add(item);
                    if (item.includes('seriesContext')) {
                        const parsed = JSON.parse(item);
                        const id = parsed.seriesContext?.episodeId;
                        if (id) {
                            if (!seen.has(id)) {
                                seen.add(id);
                                cleaned.push(item);
                            }
                        } else {
                            cleaned.push(item);
                        }
                    } else {
                        cleaned.push(item);
                    }
                }
            } catch (e) {
                cleaned.push(item);
            }
        }
        
        console.log(`Cleaned queue length: ${cleaned.length}`);
        
        await r.del('video:ideas');
        if (cleaned.length > 0) {
            await r.rpush('video:ideas', ...cleaned);
        }

        // 2. Fill the queue up to 5
        let currentCount = cleaned.length;
        const targetCount = 5;
        const needed = targetCount - currentCount;
        
        if (needed > 0) {
            console.log(`Need to add ${needed} more ideas to the queue.`);
            
            const activeIds = await seriesRedis.getActiveSeriesIds();
            let addedCount = 0;
            
            for (const id of activeIds) {
                if (addedCount >= needed) break;
                
                await seriesRedis.mutateSeries(id, async (series) => {
                    // Find all pending items
                    const pendingItems = series.learningQueue.filter(item => item.status === 'pending' || !item.status);
                    
                    for (const item of pendingItems) {
                        if (addedCount >= needed) break;
                        
                        item.status = 'in_progress';
                        
                        const payload = {
                            topic: item.topic,
                            isSeries: true,
                            seriesContext: {
                                seriesId: series.id,
                                seriesTitle: series.title,
                                learningGoal: series.learningGoal,
                                episodeId: item.episodeId,
                                topic: item.topic,
                                learningObjective: item.learningObjective
                            }
                        };
                        
                        await seriesRedis.pushToGlobalQueue(payload);
                        console.log(`Scheduled episode "${item.topic}" from series "${series.title}"`);
                        addedCount++;
                    }
                });
            }
            console.log(`Successfully added ${addedCount} ideas.`);
        } else {
            console.log("Queue already has 5 or more ideas.");
        }
        
    } catch(e) {
        console.error(e);
    } finally {
        await r.quit();
        await seriesRedis.close();
    }
}

fillQueue().then(() => process.exit(0)).catch(() => process.exit(1));
