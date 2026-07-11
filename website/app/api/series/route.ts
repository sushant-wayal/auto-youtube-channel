import { NextResponse } from 'next/server';
import Redis from 'ioredis';

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL not configured');
    return new Redis(redisUrl);
}

export async function GET() {
    let redis: Redis | null = null;
    try {
        redis = getRedisClient();
        const ids = await redis.smembers('series:all');
        if (ids.length === 0) return NextResponse.json({ ok: true, series: [] });
        
        const keys = ids.map(id => `series:${id}`);
        const data = await redis.mget(keys);
        
        let series = data.filter((d): d is string => d !== null).map(d => JSON.parse(d));
        
        // Sort active first, then by priority, then by id
        series.sort((a, b) => {
            if (a.status === 'active' && b.status !== 'active') return -1;
            if (b.status === 'active' && a.status !== 'active') return 1;
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.id.localeCompare(b.id);
        });

        return NextResponse.json({ ok: true, series });
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
        const { action, id, title, learningGoal, status } = body;
        redis = getRedisClient();

        if (action === 'create') {
            if (!title || !learningGoal) {
                return NextResponse.json({ ok: false, error: 'Title and learning goal required' }, { status: 400 });
            }
            
            const newId = id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const newSeries = {
                id: newId,
                title,
                learningGoal,
                status: 'active',
                version: 1,
                priority: 1,
                uploadCount: 0,
                lastUploadTimestamp: new Date().toISOString(),
                learningQueue: [],
                history: []
            };

            await redis.set(`series:${newId}`, JSON.stringify(newSeries));
            await redis.sadd('series:all', newId);
            await redis.sadd('series:active', newId);

            return NextResponse.json({ ok: true, series: newSeries });
        } 
        else if (action === 'updateStatus') {
            if (!id || !status) return NextResponse.json({ ok: false, error: 'Missing id or status' }, { status: 400 });
            
            const data = await redis.get(`series:${id}`);
            if (!data) return NextResponse.json({ ok: false, error: 'Series not found' }, { status: 404 });
            
            const series = JSON.parse(data);
            series.status = status;
            series.version = (series.version || 0) + 1;
            
            const multi = redis.multi();
            multi.set(`series:${id}`, JSON.stringify(series));
            
            if (status === 'active') {
                multi.sadd('series:active', id);
            } else {
                multi.srem('series:active', id);
            }
            await multi.exec();
            
            return NextResponse.json({ ok: true, series });
        }
        else if (action === 'delete') {
            if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
            
            await redis.del(`series:${id}`);
            await redis.srem('series:all', id);
            await redis.srem('series:active', id);
            
            return NextResponse.json({ ok: true });
        }

        return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });

    } catch (err) {
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
    } finally {
        if (redis) await redis.quit();
    }
}
