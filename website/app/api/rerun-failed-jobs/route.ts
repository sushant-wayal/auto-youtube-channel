import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

function getRedisClient() {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) return null;
    return new Redis(redisUrl);
}

export async function POST(req: NextRequest) {
    const owner = process.env.GITHUB_OWNER || 'sushant-wayal';
    const repo = process.env.GITHUB_REPO || 'auto-youtube-channel';
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
        return NextResponse.json(
            { ok: false, error: 'GITHUB_TOKEN is not configured in server environment' },
            { status: 500 }
        );
    }

    let targetRunId: string | number | null = null;

    try {
        const body = await req.json().catch(() => ({}));
        if (body && body.runId) {
            targetRunId = body.runId;
        }
    } catch {
        // Body parsing failed or empty
    }

    let redis: Redis | null = null;
    try {
        redis = getRedisClient();

        // 1. If runId wasn't provided in the request, try Redis metadata
        if (!targetRunId && redis) {
            const savedRunId = await redis.hget('pipeline:status:metadata', 'runId');
            if (savedRunId) {
                targetRunId = savedRunId;
            }
        }

        // 2. If still no runId, fetch the latest workflow run from GitHub API
        if (!targetRunId) {
            console.log('[rerun-failed-jobs] Fetching latest workflow run from GitHub Actions...');
            const runsResponse = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/actions/workflows/main.yml/runs?per_page=1`,
                {
                    headers: {
                        Authorization: `Bearer ${githubToken}`,
                        Accept: 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                    cache: 'no-store',
                }
            );

            if (!runsResponse.ok) {
                const errText = await runsResponse.text();
                return NextResponse.json(
                    { ok: false, error: `GitHub API error fetching runs: ${runsResponse.status} ${errText}` },
                    { status: runsResponse.status }
                );
            }

            const runsData = await runsResponse.json();
            const latestRun = runsData.workflow_runs?.[0];
            if (!latestRun) {
                return NextResponse.json(
                    { ok: false, error: 'No workflow runs found on GitHub' },
                    { status: 404 }
                );
            }

            targetRunId = latestRun.id;
        }

        console.log(`[rerun-failed-jobs] Triggering rerun for run #${targetRunId}...`);

        // 3. Call GitHub API to rerun failed jobs
        const rerunResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/actions/runs/${targetRunId}/rerun-failed-jobs`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${githubToken}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({ enable_debug_logging: false }),
            }
        );

        if (!rerunResponse.ok) {
            const errData = await rerunResponse.json().catch(() => ({ message: rerunResponse.statusText }));
            console.error('[rerun-failed-jobs] GitHub API rerun failed:', errData);
            return NextResponse.json(
                {
                    ok: false,
                    error: errData.message || `GitHub returned HTTP ${rerunResponse.status}`,
                },
                { status: rerunResponse.status }
            );
        }

        // 4. Update Redis status to 'running' so UI immediately reflects the rerun
        if (redis) {
            await redis.set('pipeline:status:overall', 'running', 'EX', 60 * 60 * 24 * 7);

            // Reset failed jobs to 'running'
            const existingJobs = await redis.hgetall('pipeline:status:jobs');
            for (const [jobName, jobStatus] of Object.entries(existingJobs)) {
                if (jobStatus === 'failure') {
                    await redis.hset('pipeline:status:jobs', jobName, 'running');
                }
            }
        }

        return NextResponse.json({
            ok: true,
            message: `Successfully triggered rerun for failed jobs in run #${targetRunId}`,
            runId: targetRunId,
        });
    } catch (err: any) {
        console.error('[rerun-failed-jobs] Exception:', err);
        return NextResponse.json(
            { ok: false, error: err.message || 'Internal server error' },
            { status: 500 }
        );
    } finally {
        await redis?.quit();
    }
}
