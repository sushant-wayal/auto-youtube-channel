import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

const SHORTS_TIME_KEY = 'shorts:publish-time';

/**
 * Get the configured shorts publish time from Redis
 * @returns Promise<string> Time in HH:MM format (IST)
 */
export async function getShortsPublishTime(): Promise<string> {
    const time = await redis.get(SHORTS_TIME_KEY);
    return time || '16:30'; // Default to 4:30 PM IST
}

/**
 * Set the shorts publish time in Redis
 * @param time Time in HH:MM format (IST)
 */
export async function setShortsPublishTime(time: string): Promise<void> {
    await redis.set(SHORTS_TIME_KEY, time);
}
