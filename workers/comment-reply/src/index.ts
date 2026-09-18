import { YouTubeCommentService } from './services/youtube-comment-service';
import { AIReplyService } from './services/ai-reply-service';
import { CommentStateService } from './services/comment-state-service';
import { evaluateSpamRules } from './utils/spam-filter';
import { CommentReplyWorkerResult, ReplyHistoryEntry } from './types';

export * from './types';
export { CommentStateService } from './services/comment-state-service';
export { YouTubeCommentService } from './services/youtube-comment-service';
export { AIReplyService } from './services/ai-reply-service';

export interface RunCommentReplyOptions {
    dryRun?: boolean;
    maxReplies?: number;
    force?: boolean;
    threadsToScan?: number;
}

/**
 * Pure function: Inspects YouTube channel comments, filters out spam,
 * generates contextual AI replies via Gemini, and posts them to YouTube.
 */
export async function runCommentReplyWorker(
    options: RunCommentReplyOptions = {}
): Promise<CommentReplyWorkerResult> {
    console.error('\n💬 === AUTO COMMENT REPLY WORKER STARTED ===');

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

        // Check if enabled (unless forced via manual trigger)
        if (!settings.enabled && !options.force) {
            console.error('⏸️ Auto comment reply is currently disabled in settings. Skipping run.');
            await stateService.close();
            return result;
        }

        const isDryRun = options.dryRun !== undefined ? options.dryRun : settings.dryRun;
        const maxReplies = options.maxReplies || settings.maxRepliesPerRun || 5;
        const threadsToScan = options.threadsToScan || 30;

        console.error(`⚙️ Run parameters: DryRun=${isDryRun}, MaxReplies=${maxReplies}, ScanLimit=${threadsToScan}`);

        const ytService = new YouTubeCommentService();
        const aiService = new AIReplyService();

        // 1. Fetch eligible threads
        const threads = await ytService.fetchRecentCommentThreads(threadsToScan);
        result.totalChecked = threads.length;

        let repliesProcessedCount = 0;

        for (const thread of threads) {
            if (repliesProcessedCount >= maxReplies) {
                console.error(`🛑 Reached max replies limit of ${maxReplies} for this run.`);
                break;
            }

            const comment = thread.topLevelComment;

            // 2. Check Redis deduplication
            const alreadyRepliedInRedis = await stateService.isCommentReplied(comment.id);
            if (alreadyRepliedInRedis) {
                result.repliesSkipped++;
                continue;
            }

            // 3. Fast rule-based spam check
            const spamCheck = evaluateSpamRules(comment.textOriginal);
            if (spamCheck.isSpam) {
                console.error(`🛡️ Spam rule blocked comment from ${comment.authorDisplayName}: ${spamCheck.reason}`);
                result.repliesSkipped++;
                // Mark in Redis so we don't scan this spam comment again
                await stateService.markCommentReplied(comment.id);
                continue;
            }

            // 4. Fetch & cache video metadata
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

            // 4b. Fetch & cache video transcript
            if (!videoMeta.transcript) {
                let transcript = await stateService.getCachedTranscript(thread.videoId);
                if (!transcript) {
                    transcript = await ytService.getVideoTranscript(thread.videoId);
                    if (transcript) {
                        await stateService.setCachedTranscript(thread.videoId, transcript);
                        console.error(`📝 Cached transcript for "${videoMeta.title}" (${transcript.length} chars)`);
                    }
                }
                videoMeta.transcript = transcript;
            }

            // 5. Query Gemini AI for classification and reply generation
            console.error(`🤖 Evaluating comment from "${comment.authorDisplayName}" on "${videoMeta.title}": "${comment.textOriginal.slice(0, 80)}..."`);
            const decision = await aiService.generateReply({
                commentText: comment.textOriginal,
                authorName: comment.authorDisplayName,
                videoMeta,
                settings,
            });

            if (!decision.shouldReply || !decision.replyText) {
                console.error(`⏩ AI skipped comment: category=${decision.category}, reason=${decision.reason}`);
                result.repliesSkipped++;
                // Mark non-replied comment to prevent re-processing
                await stateService.markCommentReplied(comment.id);
                continue;
            }

            console.error(`✨ AI drafted reply (${decision.category}, ${decision.sentiment}): "${decision.replyText}"`);

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
                console.error(`🧪 [DRY RUN] Simulated reply to ${comment.authorDisplayName}: "${decision.replyText}"`);
                result.repliesDryRun++;
                result.processedReplies.push(historyEntry);
                await stateService.pushReplyHistory(historyEntry);
                repliesProcessedCount++;
            } else {
                try {
                    console.error(`🚀 Posting live reply to YouTube comment thread ${thread.threadId}...`);
                    await ytService.postReply(thread.threadId, decision.replyText);

                    // Mark as replied in Redis
                    await stateService.markCommentReplied(comment.id);
                    await stateService.pushReplyHistory(historyEntry);

                    result.repliesSent++;
                    result.processedReplies.push(historyEntry);
                    repliesProcessedCount++;
                    console.error(`✅ Reply posted successfully!`);

                    // 2-second rate limit pause
                    await new Promise((res) => setTimeout(res, 2000));
                } catch (postError: any) {
                    console.error(`❌ Failed to post reply to YouTube:`, postError?.message || postError);
                    historyEntry.status = 'failed';
                    historyEntry.error = postError?.message || String(postError);
                    await stateService.pushReplyHistory(historyEntry);
                    result.errors.push(`Failed to reply to ${comment.authorDisplayName}: ${postError?.message || postError}`);
                }
            }
        }
    } catch (error: any) {
        console.error('❌ Critical error in comment-reply worker:', error);
        result.success = false;
        result.errors.push(error?.message || String(error));
    } finally {
        await stateService.close();
    }

    console.error(`\n📊 === AUTO COMMENT REPLY WORKER FINISHED ===`);
    console.error(`Checked: ${result.totalChecked} | Sent: ${result.repliesSent} | DryRun: ${result.repliesDryRun} | Skipped: ${result.repliesSkipped} | Errors: ${result.errors.length}\n`);

    return result;
}

// Allow direct execution: `npx tsx workers/comment-reply/src/index.ts`
if (require.main === module) {
    const isDry = process.argv.includes('--dry-run');
    runCommentReplyWorker({ dryRun: isDry, force: true })
        .then((res) => {
            console.log(JSON.stringify(res, null, 2));
            process.exit(res.success ? 0 : 1);
        })
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
