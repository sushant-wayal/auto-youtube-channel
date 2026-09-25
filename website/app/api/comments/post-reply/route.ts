import { NextRequest, NextResponse } from 'next/server';
import { CommentStateService } from '@/lib/comment-reply/comment-state-service';
import { YouTubeCommentService } from '@/lib/comment-reply/youtube-comment-service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    let stateService: CommentStateService | null = null;
    try {
        const body = await req.json().catch(() => ({}));
        const { threadId, commentId, replyText, historyId } = body;

        if (!replyText || (!threadId && !commentId)) {
            return NextResponse.json(
                { ok: false, error: 'threadId/commentId and replyText are required' },
                { status: 400 }
            );
        }

        const targetThreadId = String(threadId || commentId);
        const targetCommentId = String(commentId || threadId);
        const targetHistoryId = String(historyId || targetCommentId);

        stateService = new CommentStateService();

        let youtubeReplyId: string | null = null;
        const isMock = targetThreadId.startsWith('th-') || targetCommentId.startsWith('c-') || targetHistoryId.startsWith('mock-');

        if (!isMock && process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN) {
            try {
                const ytService = new YouTubeCommentService();
                youtubeReplyId = await ytService.postReply(targetThreadId, replyText);
            } catch (ytError: any) {
                console.error('[post-reply] Failed to post reply via YouTube API:', ytError?.message || ytError);
                return NextResponse.json(
                    { ok: false, error: ytError?.message || 'Failed to post reply to YouTube' },
                    { status: 500 }
                );
            }
        } else if (!isMock) {
            console.warn('[post-reply] YouTube credentials not fully configured; updating status in Redis');
        }

        // Mark comment as replied in Redis
        if (targetCommentId) {
            await stateService.markCommentReplied(targetCommentId);
        }

        // Update entry status in history list in Redis
        await stateService.updateHistoryEntryStatus(targetHistoryId, 'posted');

        return NextResponse.json({
            ok: true,
            message: 'Comment reply posted and marked as live',
            replyId: youtubeReplyId || `sim-${Date.now()}`,
        });
    } catch (error: any) {
        console.error('[post-reply] Error:', error);
        return NextResponse.json(
            { ok: false, error: error?.message || 'Failed to post reply' },
            { status: 500 }
        );
    } finally {
        await stateService?.close();
    }
}
