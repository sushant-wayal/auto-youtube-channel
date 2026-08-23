import Redis from 'ioredis';

const TTL = 60 * 60 * 24 * 7; // 7 days

function getClient(): Redis {
    if (!process.env.REDIS_URL) {
        throw new Error('REDIS_URL is required for pipeline status updates');
    }
    return new Redis(process.env.REDIS_URL);
}

export async function initPipeline(videoId: string, videoTitle?: string, runId?: string) {
    const redis = getClient();
    try {
        // Clear existing status keys
        const keys = await redis.keys('pipeline:status:*');
        if (keys.length > 0) {
            await redis.del(...keys);
        }

        // Set initial state
        const pipeline = redis.multi();
        pipeline.set('pipeline:status:overall', 'running', 'EX', TTL);
        const meta: Record<string, string> = {
            videoId,
            videoTitle: videoTitle || videoId,
            ranAt: new Date().toISOString()
        };
        if (runId) meta.runId = String(runId);
        pipeline.hset('pipeline:status:metadata', meta);
        pipeline.expire('pipeline:status:metadata', TTL);
        await pipeline.exec();
    } finally {
        await redis.quit();
    }
}

export async function setJobStatus(jobKey: string, status: 'running' | 'success' | 'failure' | 'skipped') {
    const redis = getClient();
    try {
        await redis.hset('pipeline:status:jobs', jobKey, status);
        await redis.expire('pipeline:status:jobs', TTL);
    } finally {
        await redis.quit();
    }
}

export async function setMetadata(fields: Record<string, string>) {
    const redis = getClient();
    try {
        await redis.hset('pipeline:status:metadata', fields);
    } finally {
        await redis.quit();
    }
}

export async function pushArrayItem(listKey: string, item: string | object) {
    const redis = getClient();
    try {
        const val = typeof item === 'string' ? item : JSON.stringify(item);
        await redis.rpush(`pipeline:status:${listKey}`, val);
        await redis.expire(`pipeline:status:${listKey}`, TTL);
    } finally {
        await redis.quit();
    }
}

export async function setOverallStatus(status: 'success' | 'failure') {
    const redis = getClient();
    try {
        await redis.set('pipeline:status:overall', status, 'EX', TTL);
    } finally {
        await redis.quit();
    }
}
