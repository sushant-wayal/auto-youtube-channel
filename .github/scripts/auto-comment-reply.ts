/**
 * Standalone & GitHub Actions Script: Auto Comment Reply
 * Dispatches YouTube comment checks, filters spam, generates Gemini AI responses,
 * and posts replies to YouTube while tracking state in Redis.
 *
 * Usage:
 *   npx tsx .github/scripts/auto-comment-reply.ts [--dry-run] [--force] [--limit <number>]
 */

import { validateConfig } from '../../shared/config';
import { runCommentReplyWorker } from '../../workers/comment-reply/src/index';

async function main() {
    validateConfig(['commentReply']);

    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run');
    const isForce = args.includes('--force');

    let limit: number | undefined;
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1], 10);
    }

    console.log('🚀 Running Auto Comment Reply Pipeline...');
    if (isDryRun) console.log('🧪 DRY-RUN MODE: Replies will be generated and logged, but NOT posted to YouTube.');

    try {
        const result = await runCommentReplyWorker({
            dryRun: isDryRun,
            force: isForce,
            maxReplies: limit,
        });

        console.log('\n=============================================');
        console.log('📈 COMMENT REPLY EXECUTION SUMMARY:');
        console.log(`   Total Threads Scanned: ${result.totalChecked}`);
        console.log(`   Live Replies Sent:     ${result.repliesSent}`);
        console.log(`   Dry-Run Replies:       ${result.repliesDryRun}`);
        console.log(`   Comments Skipped:      ${result.repliesSkipped}`);
        console.log(`   Errors Encountered:    ${result.errors.length}`);
        console.log('=============================================\n');

        if (result.processedReplies.length > 0) {
            console.log('📝 Processed Comments:');
            result.processedReplies.forEach((r, i) => {
                console.log(`   ${i + 1}. [${r.status.toUpperCase()}] "${r.authorName}" on "${r.videoTitle}":`);
                console.log(`      Comment: "${r.commentText.slice(0, 70)}..."`);
                console.log(`      Reply:   "${r.replyText}"`);
            });
        }

        if (result.errors.length > 0) {
            console.warn('\n⚠️ Errors encountered during execution:');
            result.errors.forEach((e) => console.warn(`   - ${e}`));
        }

        process.exit(result.success ? 0 : 1);
    } catch (err: any) {
        console.error('❌ Auto comment reply execution failed:', err?.message || err);
        process.exit(1);
    }
}

main();
