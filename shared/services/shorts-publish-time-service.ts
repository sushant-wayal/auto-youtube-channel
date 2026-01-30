import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

const SHORTS_TIMES_KEY = 'shorts:publish-times'; // Ranked times (5 slots)
const LONG_FORM_TIME_KEY = 'longform:publish-time';

// Default times ranked from best to worst performance
const DEFAULT_SHORTS_TIMES = [
    '16:30', // Rank 1 (Best)
    '18:00', // Rank 2
    '20:00', // Rank 3
    '12:00', // Rank 4
    '14:00', // Rank 5 (Worst)
];

const DEFAULT_LONG_FORM_TIME = '18:30';

/**
 * Get all 5 ranked shorts publish times from Redis
 * @returns Promise<string[]> Array of 5 times in HH:MM format (IST), ranked best to worst
 */
export async function getShortsPublishTimes(): Promise<string[]> {
    const timesJson = await redis.get(SHORTS_TIMES_KEY);
    if (timesJson) {
        return JSON.parse(timesJson);
    }
    return DEFAULT_SHORTS_TIMES;
}

/**
 * Set all 5 ranked shorts publish times in Redis
 * @param times Array of 5 times in HH:MM format (IST), ranked best to worst
 */
export async function setShortsPublishTimes(times: string[]): Promise<void> {
    if (times.length !== 5) {
        throw new Error('Must provide exactly 5 publish times');
    }
    await redis.set(SHORTS_TIMES_KEY, JSON.stringify(times));
}

/**
 * Get the appropriate shorts publish time based on rank (0-based index)
 * @param rank 0 = best time, 4 = worst time
 * @returns Promise<string> Time in HH:MM format (IST)
 */
export async function getShortsPublishTimeByRank(rank: number): Promise<string> {
    const times = await getShortsPublishTimes();
    const index = Math.min(Math.max(0, rank), times.length - 1);
    return times[index];
}

/**
 * Get the configured long-form video publish time from Redis
 * @returns Promise<string> Time in HH:MM format (IST)
 */
export async function getLongFormPublishTime(): Promise<string> {
    const time = await redis.get(LONG_FORM_TIME_KEY);
    return time || DEFAULT_LONG_FORM_TIME;
}

/**
 * Set the long-form video publish time in Redis
 * @param time Time in HH:MM format (IST)
 */
export async function setLongFormPublishTime(time: string): Promise<void> {
    await redis.set(LONG_FORM_TIME_KEY, time);
}

/**
 * @deprecated Use getShortsPublishTimes() instead
 * Get the configured shorts publish time from Redis (returns best time)
 * @returns Promise<string> Time in HH:MM format (IST)
 */
export async function getShortsPublishTime(): Promise<string> {
    const times = await getShortsPublishTimes();
    return times[0]; // Return best time for backwards compatibility
}

/**
 * @deprecated Use setShortsPublishTimes() instead
 * Set the shorts publish time in Redis (sets the best time only)
 * @param time Time in HH:MM format (IST)
 */
export async function setShortsPublishTime(time: string): Promise<void> {
    const times = await getShortsPublishTimes();
    times[0] = time;
    await setShortsPublishTimes(times);
}
