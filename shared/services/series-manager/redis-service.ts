import Redis from 'ioredis';
import { SeriesState } from './types';

export class SeriesRedisService {
    private redis: Redis;

    constructor() {
        const url = process.env.REDIS_URL;
        if (!url) throw new Error("REDIS_URL not configured");
        this.redis = new Redis(url);
    }

    async getActiveSeriesIds(): Promise<string[]> {
        const ids = await this.redis.smembers('series:active');
        return ids;
    }

    async getSeries(id: string): Promise<SeriesState | null> {
        const data = await this.redis.get(`series:${id}`);
        if (!data) return null;
        return JSON.parse(data) as SeriesState;
    }

    async saveSeries(series: SeriesState): Promise<void> {
        series.version = (series.version || 0) + 1;
        await this.redis.set(`series:${series.id}`, JSON.stringify(series));
        
        if (series.status === 'active') {
            await this.redis.sadd('series:active', series.id);
        } else {
            await this.redis.srem('series:active', series.id);
        }
    }

    async mutateSeries(seriesId: string, mutator: (series: SeriesState) => void | Promise<void>): Promise<SeriesState | null> {
        const key = `series:${seriesId}`;
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            await this.redis.watch(key);
            const data = await this.redis.get(key);
            if (!data) {
                await this.redis.unwatch();
                return null;
            }
            
            const series: SeriesState = JSON.parse(data);
            await mutator(series);
            series.version = (series.version || 0) + 1;
            
            const multi = this.redis.multi();
            multi.set(key, JSON.stringify(series));
            if (series.status === 'active') {
                multi.sadd('series:active', series.id);
            } else {
                multi.srem('series:active', series.id);
            }
            
            const results = await multi.exec();
            if (results !== null) {
                return series; // Success
            }
            // Conflict occurred, loop retries
        }
        throw new Error(`Failed to mutate series ${seriesId} after ${maxRetries} attempts due to concurrent modifications.`);
    }

    async pushToGlobalQueue(payload: any): Promise<void> {
        await this.redis.rpush('video:ideas', JSON.stringify(payload));
    }

    async close(): Promise<void> {
        await this.redis.quit();
    }
}
