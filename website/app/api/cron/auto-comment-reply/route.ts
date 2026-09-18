import { NextRequest, NextResponse } from 'next/server';
import { verifyJarvisAuth } from '@/lib/jarvis-auth';
import { CommentStateService } from '@/lib/comment-reply/comment-state-service';

/**
 * Dispatches the auto-comment-reply.yml workflow in GitHub Actions
 */
async function dispatchCommentReplyWorkflow(options?: {
    dryRun?: boolean;
    maxReplies?: number;
    force?: boolean;
}) {
    const owner = process.env.GITHUB_OWNER || 'sushant-wayal';
    const repo = process.env.GITHUB_REPO || 'auto-youtube-channel';
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        throw new Error('GITHUB_TOKEN is not configured on the server');
    }

    const stateService = new CommentStateService();
    const settings = await stateService.getSettings();
    await stateService.close();

    const isForce = options?.force ?? false;

    // If disabled in settings and not forced, skip dispatching
    if (!settings.enabled && !isForce) {
        console.log('⏸️ [auto-comment-reply-cron] Disabled in settings. Skipping GitHub workflow dispatch.');
        return {
            success: true,
            skipped: true,
            message: 'Auto comment reply is disabled in settings. Skipping GitHub Actions dispatch.',
        };
    }

    const dryRun = options?.dryRun !== undefined ? options.dryRun : settings.dryRun;
    const maxReplies = options?.maxReplies ?? settings.maxRepliesPerRun ?? 5;

    const inputs: Record<string, string> = {
        dry_run: dryRun ? 'true' : 'false',
        max_replies: String(maxReplies),
        force: isForce ? 'true' : 'false',
    };

    console.log(`🚀 [auto-comment-reply-cron] Dispatching auto-comment-reply.yml to GitHub Actions (dryRun=${dryRun}, maxReplies=${maxReplies})...`);

    const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/actions/workflows/auto-comment-reply.yml/dispatches`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
            },
            body: JSON.stringify({
                ref: 'main',
                inputs,
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API dispatch error (${response.status}): ${errorText}`);
    }

    console.log('✅ [auto-comment-reply-cron] GitHub Actions workflow dispatched successfully!');

    return {
        success: true,
        message: 'Auto comment reply workflow dispatched successfully on GitHub Actions',
        inputs,
    };
}

/**
 * GET: Triggered by Vercel Cron (schedule in vercel.json)
 */
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
        const result = await dispatchCommentReplyWorkflow();
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[auto-comment-reply-cron] GET error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}

/**
 * POST: Triggered manually from dashboard or Jarvis
 */
export async function POST(req: NextRequest) {
    const auth = verifyJarvisAuth(req);
    if (!auth.authorized) {
        return NextResponse.json({ success: false, error: auth.reason }, { status: 401 });
    }

    try {
        const body = await req.json().catch(() => ({}));
        const result = await dispatchCommentReplyWorkflow({
            dryRun: body?.dryRun,
            maxReplies: body?.maxReplies,
            force: body?.force ?? true,
        });
        return NextResponse.json(result);
    } catch (err: any) {
        console.error('[auto-comment-reply-cron] POST error:', err);
        return NextResponse.json(
            { success: false, error: err.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
