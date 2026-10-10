/**
 * Cloudinary Cleanup Script
 * Cleans up old / historical assets accumulated in Cloudinary to free up storage and credits.
 * 
 * Usage:
 *   npx tsx scripts/cleanup-cloudinary.ts [--dry-run] [--execute] [--keep-hours=48] [--active-id=video-123]
 */

import dotenv from 'dotenv';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import Redis from 'ioredis';

// Load .env.local if present
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--execute');
const keepHoursArg = process.argv.find(a => a.startsWith('--keep-hours='));
const keepHours = keepHoursArg ? parseInt(keepHoursArg.split('=')[1], 10) : 48;

const activeIdArg = process.argv.find(a => a.startsWith('--active-id='));
let activeVideoId = activeIdArg ? activeIdArg.split('=')[1] : '';

const cutoffTime = new Date(Date.now() - keepHours * 60 * 60 * 1000).toISOString();

async function resolveActiveVideoId(): Promise<string> {
  if (activeVideoId) return activeVideoId;

  // Try to read active videoId from Redis
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL, { connectTimeout: 3000, maxRetriesPerRequest: 1 });
      const savedId = await redis.hget('pipeline:status:metadata', 'videoId');
      await redis.quit();
      if (savedId && savedId !== 'generating...') {
        console.log(`📌 Detected active videoId from Redis: ${savedId}`);
        return savedId;
      }
    } catch {
      // Redis not reachable, non-fatal
    }
  }

  return '';
}

async function cleanupResourceType(resourceType: 'video' | 'image') {
  console.log(`\n📦 Scanning ${resourceType.toUpperCase()} resources in video-gen/...`);

  let nextCursor: string | null = null;
  let totalFound = 0;
  let totalKept = 0;
  let toDeleteIds: string[] = [];
  let totalBytesFreed = 0;
  let totalDeletedCount = 0;

  do {
    const res: any = await cloudinary.api.resources({
      resource_type: resourceType,
      type: 'upload',
      prefix: 'video-gen/',
      max_results: 500,
      next_cursor: nextCursor,
    });

    totalFound += res.resources.length;

    for (const r of res.resources) {
      const isRecent = r.created_at >= cutoffTime;
      const isActive = activeVideoId && r.public_id.includes(activeVideoId);

      if (isRecent || isActive) {
        totalKept++;
      } else {
        toDeleteIds.push(r.public_id);
        totalBytesFreed += r.bytes || 0;
      }
    }

    // Process deletions in chunks of 100 to avoid large payloads & optimize API calls
    while (toDeleteIds.length >= 100) {
      const batch = toDeleteIds.splice(0, 100);
      if (!isDryRun) {
        await cloudinary.api.delete_resources(batch, { resource_type: resourceType });
      }
      totalDeletedCount += batch.length;
      console.log(`  🗑️  Deleted ${totalDeletedCount} ${resourceType}s (${(totalBytesFreed / (1024 * 1024)).toFixed(1)} MB so far)...`);
    }

    nextCursor = res.next_cursor;
  } while (nextCursor);

  // Clean up any remaining in toDeleteIds
  if (toDeleteIds.length > 0) {
    if (!isDryRun) {
      await cloudinary.api.delete_resources(toDeleteIds, { resource_type: resourceType });
    }
    totalDeletedCount += toDeleteIds.length;
    console.log(`  🗑️  Deleted final batch of ${toDeleteIds.length} ${resourceType}s...`);
  }

  console.log(`✅ ${resourceType.toUpperCase()} summary: Found ${totalFound}, Kept ${totalKept}, Deleted ${totalDeletedCount} (~${(totalBytesFreed / (1024 * 1024 * 1024)).toFixed(2)} GB freed)`);
  return { found: totalFound, kept: totalKept, deleted: totalDeletedCount, bytes: totalBytesFreed };
}

async function cleanupEmptyFolders() {
  console.log('\n📁 Scanning and cleaning up empty subfolders in video-gen/...');
  try {
    let nextCursor: string | null = null;
    let deletedFolders = 0;
    do {
      const sub: any = await cloudinary.api.sub_folders('video-gen', { max_results: 500, next_cursor: nextCursor });
      for (const folder of sub.folders) {
        // Skip active run folder
        if (activeVideoId && folder.path.includes(activeVideoId)) {
          continue;
        }
        try {
          if (!isDryRun) {
            await cloudinary.api.delete_folder(folder.path);
            deletedFolders++;
          }
        } catch {
          // Folder not empty or other error, safe to ignore
        }
      }
      nextCursor = sub.next_cursor;
    } while (nextCursor);
    console.log(`✅ Cleaned up ${deletedFolders} empty subfolders.`);
  } catch (err: any) {
    console.log(`ℹ️ Folder cleanup: ${err.message}`);
  }
}

async function main() {
  activeVideoId = await resolveActiveVideoId();

  console.log('='.repeat(70));
  console.log('🧹 CLOUDINARY CLEANUP UTILITY');
  console.log('='.repeat(70));
  console.log(`Mode:           ${isDryRun ? '🔍 DRY RUN (no files will be deleted)' : '⚡ LIVE EXECUTION (deleting garbage files)'}`);
  console.log(`Keep cutoff:    ${cutoffTime} (past ${keepHours} hours)`);
  console.log(`Active run ID:  ${activeVideoId || 'None'} (preserved)`);
  console.log('='.repeat(70));

  const startTime = Date.now();

  const videoStats = await cleanupResourceType('video');
  const imageStats = await cleanupResourceType('image');

  await cleanupEmptyFolders();

  const totalBytes = videoStats.bytes + imageStats.bytes;
  const totalDeleted = videoStats.deleted + imageStats.deleted;

  console.log('\n' + '='.repeat(70));
  console.log('🎉 CLEANUP COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total files deleted: ${totalDeleted}`);
  console.log(`Total storage freed: ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB (${(totalBytes / (1024 * 1024)).toFixed(1)} MB)`);
  console.log(`Time taken:          ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Fetch updated usage
  try {
    const usage = await cloudinary.api.usage();
    console.log('\n📊 Updated Cloudinary Usage:');
    console.log(`Storage:      ${(usage.storage.usage / (1024 * 1024 * 1024)).toFixed(2)} GB (Credits: ${usage.storage.credits_usage})`);
    console.log(`Credits Used: ${usage.credits.usage} / ${usage.credits.limit} (${usage.credits.used_percent}% used)`);
    console.log(`API Calls Left: ${usage.rate_limit_remaining} / ${usage.rate_limit_allowed}`);
  } catch (err: any) {
    console.log('ℹ️ Usage check notice:', err.message);
  }
}

main().catch(err => {
  console.error('❌ Fatal cleanup error:', err);
  process.exit(1);
});
