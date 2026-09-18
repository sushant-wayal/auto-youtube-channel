import { NextRequest, NextResponse } from 'next/server';
import { processCommentReplies } from '@/lib/comment-reply';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { dryRun, maxReplies, force } = body;

        const result = await processCommentReplies({
            dryRun,
            maxReplies,
            force: force ?? true, // Manual trigger defaults to force=true
        });

        return NextResponse.json({
            ok: result.success,
            result,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                ok: false,
                error: error?.message || 'Failed to process comment replies',
            },
            { status: 500 }
        );
    }
}
