import { YouTubeCommentService } from './youtube-comment-service';
import { AIReplyService } from './ai-reply-service';
import { CommentStateService } from './comment-state-service';
import { evaluateSpamRules } from './spam-filter';
import { CommentReplyWorkerResult, ReplyHistoryEntry } from './types';

export * from './types';
export { CommentStateService } from './comment-state-service';
export { YouTubeCommentService } from './youtube-comment-service';
export { AIReplyService } from './ai-reply-service';

export interface RunCommentReplyOptions {
    dryRun?: boolean;
    maxReplies?: number;
    force?: boolean;
    threadsToScan?: number;
}

export async function processCommentReplies(
    options: RunCommentReplyOptions = {}
): Promise<CommentReplyWorkerResult> {
    console.log('\n💬 === AUTO COMMENT REPLY STARTED ===');

    const stateService = new CommentStateService();
    const result: CommentReplyWorkerResult = {
        success: true,
        totalChecked: 0,
        repliesSent: 0,
        repliesDryRun: 0,
        repliesSkipped: 0,
        errors: [],
        processedReplies: [],
    };

    try {
        const settings = await stateService.getSettings();

        if (!settings.enabled && !options.force) {
            console.log('⏸️ Auto comment reply is currently disabled in settings.');
            await stateService.close();
            return result;
        }

        const isDryRun = options.dryRun !== undefined ? options.dryRun : settings.dryRun;
        const maxReplies = options.maxReplies || settings.maxRepliesPerRun || 5;
        const threadsToScan = options.threadsToScan || 30;

        const ytService = new YouTubeCommentService();
        const aiService = new AIReplyService();

        const threads = await ytService.fetchRecentCommentThreads(threadsToScan);
        result.totalChecked = threads.length;

        let repliesProcessedCount = 0;

        const existingHistory = await stateService.getReplyHistory(100);
        const existingCommentIds = new Set(
            existingHistory.map((h) => h.commentId).concat(existingHistory.map((h) => h.threadId))
        );

        for (const thread of threads) {
            if (repliesProcessedCount >= maxReplies) {
                break;
            }

            const comment = thread.topLevelComment;

            const alreadyRepliedInRedis = await stateService.isCommentReplied(comment.id);
            if (alreadyRepliedInRedis || existingCommentIds.has(comment.id) || existingCommentIds.has(thread.threadId)) {
                result.repliesSkipped++;
                continue;
            }

            const spamCheck = evaluateSpamRules(comment.textOriginal);
            if (spamCheck.isSpam) {
                result.repliesSkipped++;
                await stateService.markCommentReplied(comment.id);
                continue;
            }

            let videoMeta = await stateService.getCachedVideoMeta(thread.videoId);
            if (!videoMeta) {
                videoMeta = await ytService.getVideoMetadata(thread.videoId);
                if (videoMeta) {
                    await stateService.setCachedVideoMeta(videoMeta);
                }
            }

            if (!videoMeta) {
                videoMeta = {
                    id: thread.videoId,
                    title: 'YouTube Video',
                    description: '',
                };
            }

            if (!videoMeta.transcript) {
                let transcript = await stateService.getCachedTranscript(thread.videoId);
                if (!transcript) {
                    transcript = await ytService.getVideoTranscript(thread.videoId);
                    if (transcript) {
                        await stateService.setCachedTranscript(thread.videoId, transcript);
                    }
                }
                videoMeta.transcript = transcript;
            }

            const decision = await aiService.generateReply({
                commentText: comment.textOriginal,
                authorName: comment.authorDisplayName,
                videoMeta,
                settings,
            });

            if (!decision.shouldReply || !decision.replyText) {
                result.repliesSkipped++;
                await stateService.markCommentReplied(comment.id);
                continue;
            }

            const historyEntry: ReplyHistoryEntry = {
                id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                threadId: thread.threadId,
                commentId: comment.id,
                videoId: thread.videoId,
                videoTitle: videoMeta.title,
                authorName: comment.authorDisplayName,
                commentText: comment.textOriginal,
                replyText: decision.replyText,
                category: decision.category,
                sentiment: decision.sentiment,
                status: isDryRun ? 'dry_run' : 'posted',
                timestamp: new Date().toISOString(),
            };

            if (isDryRun) {
                result.repliesDryRun++;
                result.processedReplies.push(historyEntry);
                await stateService.pushReplyHistory(historyEntry);
                repliesProcessedCount++;
            } else {
                try {
                    await ytService.postReply(thread.threadId, decision.replyText);
                    await stateService.markCommentReplied(comment.id);
                    await stateService.pushReplyHistory(historyEntry);

                    result.repliesSent++;
                    result.processedReplies.push(historyEntry);
                    repliesProcessedCount++;

                    await new Promise((res) => setTimeout(res, 2000));
                } catch (postError: any) {
                    historyEntry.status = 'failed';
                    historyEntry.error = postError?.message || String(postError);
                    await stateService.pushReplyHistory(historyEntry);
                    result.errors.push(`Failed to reply to ${comment.authorDisplayName}: ${postError?.message || postError}`);
                }
            }
        }
    } catch (error: any) {
        console.error('❌ Error processing comment replies:', error);
        result.success = false;
        result.errors.push(error?.message || String(error));
    } finally {
        await stateService.close();
    }

    return result;
}
