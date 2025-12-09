/**
 * Clip Downloader Service
 * Downloads stock footage clips and saves them to disk
 */

import fs from 'fs/promises';
import path from 'path';
import { extractKeywords } from './keyword-extractor';
import { fetchClipsForKeyword, StockClip } from './pexels-client';

/**
 * Download a single clip from URL to file path
 */
async function downloadClip(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download clip: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  await fs.writeFile(outputPath, buffer);
}

/**
 * Download stock footage clips for a video based on narration keywords
 * @param videoId - Unique identifier for the video
 * @param narration - Full narration text
 * @param targetCount - Target number of clips to download (default: 10)
 * @returns Array of absolute file paths to downloaded clips
 */
export async function downloadClipsForVideo(
  videoId: string,
  narration: string,
  targetCount: number = 10
): Promise<string[]> {
  console.log(`\n🎬 Starting clip download for video: ${videoId}`);
  console.log(`🎯 Target: ${targetCount} clips`);

  // Extract keywords from narration
  const keywords = extractKeywords(narration, 10);
  console.log(`📝 Extracted keywords:`, keywords);

  if (keywords.length === 0) {
    throw new Error('No keywords could be extracted from narration');
  }

  // Create output directory
  const outputDir = path.join(process.cwd(), 'tmp', 'footage', videoId);
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`📁 Output directory: ${outputDir}`);

  const downloadedPaths: string[] = [];
  let clipCounter = 1;

  // Iterate through keywords and download clips
  for (const keyword of keywords) {
    if (downloadedPaths.length >= targetCount) {
      break;
    }

    const remainingClips = targetCount - downloadedPaths.length;
    const clipsToFetch = Math.min(3, remainingClips);

    // Fetch clips for this keyword
    const clips = await fetchClipsForKeyword(keyword, clipsToFetch);

    // Download each clip
    for (const clip of clips) {
      if (downloadedPaths.length >= targetCount) {
        break;
      }

      try {
        const clipNumber = clipCounter.toString().padStart(3, '0');
        const filename = `clip-${clipNumber}.mp4`;
        const outputPath = path.join(outputDir, filename);

        console.log(`⬇️  Downloading clip ${clipCounter}/${targetCount} (${keyword})...`);
        await downloadClip(clip.url, outputPath);

        downloadedPaths.push(outputPath);
        console.log(`✅ Downloaded: ${filename} (${clip.width}x${clip.height}, ${clip.duration}s)`);

        clipCounter++;
      } catch (error) {
        console.error(`❌ Failed to download clip for "${keyword}":`, error);
        // Continue with next clip
      }
    }

    // Small delay to be nice to the API
    if (downloadedPaths.length < targetCount) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (downloadedPaths.length === 0) {
    throw new Error('Failed to download any clips. Check your PEXELS_API_KEY and network connection.');
  }

  console.log(`\n✅ Successfully downloaded ${downloadedPaths.length} clips`);
  return downloadedPaths;
}
