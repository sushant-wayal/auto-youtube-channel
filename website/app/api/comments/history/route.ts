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

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, replyText } = body;
        if (!id || typeof replyText !== 'string') {
            return NextResponse.json(
                { ok: false, error: 'id and replyText are required' },
                { status: 400 }
            );
        }

        const stateService = new CommentStateService();
        const updated = await stateService.updateReplyText(id, replyText);
        await stateService.close();

        return NextResponse.json({
            ok: true,
            updated,
            message: 'Comment reply updated successfully',
        });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error?.message || 'Failed to update comment reply' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        let id = searchParams.get('id');

        if (!id) {
            try {
                const body = await req.json();
                id = body.id;
            } catch {}
        }

        if (!id) {
            return NextResponse.json(
                { ok: false, error: 'id is required' },
                { status: 400 }
            );
        }

        const stateService = new CommentStateService();
        const deleted = await stateService.deleteReplyHistoryItem(id);
        await stateService.close();

        return NextResponse.json({
            ok: true,
            deleted,
            message: 'Comment history item deleted successfully',
        });
    } catch (error: any) {
        return NextResponse.json(
            { ok: false, error: error?.message || 'Failed to delete comment history item' },
            { status: 500 }
        );
    }
}

