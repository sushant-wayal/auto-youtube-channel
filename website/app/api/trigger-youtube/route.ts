import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';
import { verifyJarvisAuth } from '@/lib/jarvis-auth';

async function dispatchWorkflow(videoIdea?: string) {
    const owner = process.env.GITHUB_OWNER || 'sushant-wayal';
    const repo = process.env.GITHUB_REPO || 'auto-youtube-channel';
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        throw new Error('GITHUB_TOKEN is not configured on the server');
    }

    const inputs: Record<string, string> = {};
    if (videoIdea && typeof videoIdea === 'string' && videoIdea.trim()) {
        inputs.video_idea = videoIdea.trim();
    }

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/main.yml/dispatches`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
                ref: 'main',
                ...(Object.keys(inputs).length > 0 ? { inputs } : {}),
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API error (${response.status}): ${errorText}`);
    }

    // Update Redis immediately so Jarvis and Dashboard show running state right away
    if (process.env.REDIS_URL) {
        try {
            const redis = new Redis(process.env.REDIS_URL);
            await redis.set('pipeline:status:overall', 'running', 'EX', 60 * 60 * 24 * 7);
            await redis.hset('pipeline:status:metadata', {
                ranAt: new Date().toISOString(),
                videoTitle: videoIdea ? videoIdea.trim() : 'Automated Pipeline Run',
            });
            await redis.quit();
        } catch (e) {
            console.error('[trigger-youtube] Redis update error:', e);
        }
    }

    return {
        success: true,
        message: 'Pipeline workflow dispatched successfully',
        videoIdea: videoIdea ? videoIdea.trim() : 'next_in_queue',
    };
}

export async function POST(req: NextRequest) {
    const auth = verifyJarvisAuth(req);
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.reason }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const videoIdea = body?.videoIdea;
        const result = await dispatchWorkflow(videoIdea);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[trigger-youtube] POST error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
        const authHeader = req.headers.get('authorization');
        const isCron = authHeader === `Bearer ${cronSecret}` || req.headers.get('x-vercel-cron') === '1';
        const isJarvis = verifyJarvisAuth(req).authorized;
        if (!isCron && !isJarvis) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
    }


    try {
        const result = await dispatchWorkflow();
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[trigger-youtube] GET error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}