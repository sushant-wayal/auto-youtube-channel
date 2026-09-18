import { NextRequest, NextResponse } from 'next/server';
import { CommentStateService } from '@/lib/comment-reply/comment-state-service';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '30', 10);

        const stateService = new CommentStateService();
        const history = await stateService.getReplyHistory(limit);
        const settings = await stateService.getSettings();
        await stateService.close();

        const stats = {
            totalLiveReplies: history.filter((h) => h.status === 'posted').length,
            totalDryRunReplies: history.filter((h) => h.status === 'dry_run').length,
            totalFailed: history.filter((h) => h.status === 'failed').length,
        };

        return NextResponse.json({
            ok: true,
            settings,
            stats,
            history,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                ok: false,
                error: error?.message || 'Failed to fetch comment reply history',
            },
            { status: 500 }
        );
    }
}
