import { NextResponse } from 'next/server';
import Redis from 'ioredis';

const QUEUE_KEY = 'video:ideas';

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL not configured');
    return new Redis(redisUrl);
}

export async function GET() {
    let redis: Redis | null = null;
    try {
        redis = getRedisClient();
        const ideas = await redis.lrange(QUEUE_KEY, 0, -1);
        const count = ideas.length;
        return NextResponse.json({ ok: true, ideas, count });
    } catch (err) {
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    } finally {
        if (redis) await redis.quit();
    }
}

export async function POST(request: Request) {
    let redis: Redis | null = null;
    try {
        const body = await request.json();
        const { action, idea, index, newIndex } = body;

        redis = getRedisClient();

        switch (action) {
            case 'add': {
                if (!idea || typeof idea !== 'string') {
                    return NextResponse.json({ ok: false, error: 'Idea is required' }, { status: 400 });
                }
                await redis.rpush(QUEUE_KEY, idea);
                const ideas = await redis.lrange(QUEUE_KEY, 0, -1);
                return NextResponse.json({ ok: true, ideas, count: ideas.length });
            }

            case 'remove': {
                if (typeof index !== 'number') {
                    return NextResponse.json({ ok: false, error: 'Index is required' }, { status: 400 });
                }
                // Get the idea at the index
                const ideaToRemove = await redis.lindex(QUEUE_KEY, index);
                if (!ideaToRemove) {
                    return NextResponse.json({ ok: false, error: 'Idea not found' }, { status: 404 });
                }
                // Remove first occurrence of this idea
                await redis.lrem(QUEUE_KEY, 1, ideaToRemove);
                const ideas = await redis.lrange(QUEUE_KEY, 0, -1);
                return NextResponse.json({ ok: true, ideas, count: ideas.length });
            }

            case 'move': {
                if (typeof index !== 'number' || typeof newIndex !== 'number') {
                    return NextResponse.json({ ok: false, error: 'Index and newIndex are required' }, { status: 400 });
                }

                // Get all ideas
                const ideas = await redis.lrange(QUEUE_KEY, 0, -1);
                if (index < 0 || index >= ideas.length || newIndex < 0 || newIndex >= ideas.length) {
                    return NextResponse.json({ ok: false, error: 'Invalid index' }, { status: 400 });
                }

                // Reorder in memory
                const [removed] = ideas.splice(index, 1);
                ideas.splice(newIndex, 0, removed);

                // Clear the list and repopulate
                await redis.del(QUEUE_KEY);
                if (ideas.length > 0) {
                    await redis.rpush(QUEUE_KEY, ...ideas);
                }

                return NextResponse.json({ ok: true, ideas, count: ideas.length });
            }

            case 'edit': {
                if (typeof index !== 'number') {
                    return NextResponse.json({ ok: false, error: 'Index is required' }, { status: 400 });
                }
                if (!idea || typeof idea !== 'string') {
                    return NextResponse.json({ ok: false, error: 'Idea is required' }, { status: 400 });
                }

                // Get all ideas
                const ideas = await redis.lrange(QUEUE_KEY, 0, -1);
                if (index < 0 || index >= ideas.length) {
                    return NextResponse.json({ ok: false, error: 'Invalid index' }, { status: 400 });
                }

                // Update the idea at the specified index
                ideas[index] = idea;

                // Clear the list and repopulate
                await redis.del(QUEUE_KEY);
                if (ideas.length > 0) {
                    await redis.rpush(QUEUE_KEY, ...ideas);
                }

                return NextResponse.json({ ok: true, ideas, count: ideas.length });
            }

            case 'clear': {
                await redis.del(QUEUE_KEY);
                return NextResponse.json({ ok: true, ideas: [], count: 0 });
            }

            default:
                return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
        }
    } catch (err) {
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    } finally {
        if (redis) await redis.quit();
    }
}
