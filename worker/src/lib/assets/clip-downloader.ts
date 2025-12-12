/**
 * Clip Downloader Service
 * Downloads stock footage clips and saves them to disk
 */

import fs from 'fs/promises';
import path from 'path';
import { KeywordExtractor, KeyPhrase } from './keyword-extractor';
import { fetchClipsForKeyword, StockClip } from './pexels-client';
import { getVideoDuration } from '../video/ffmpeg-utils';
import CloudinaryService from '../../services/cloudinary-service';
import config from '../../config';

/**
 * Result of clip download with timing information
 */
export interface ClipDownloadResult {
  clipUrls: string[];           // Paths to downloaded clips
  clipTimings: number[];         // Pre-calculated duration for each clip (in seconds)
  totalTargetDuration: number;   // Total target duration based on audio
  keyPhrases: KeyPhrase[];       // Key phrases used for each clip
}

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
 * Calculate clip durations based on word coverage and audio duration
 * Each clip's duration is proportional to the words it covers in the narration
 */
function calculateClipDurations(
  keyPhrases: KeyPhrase[],
  audioDuration: number,
  totalWordsCovered: number
): number[] {
  if (keyPhrases.length === 0 || totalWordsCovered === 0) {
    return [];
  }

  // Calculate duration for each clip based on word coverage proportion
  const durations = keyPhrases.map(kp => {
    const proportion = kp.wordsCovered / totalWordsCovered;
    return proportion * audioDuration;
  });

  // Ensure minimum duration of 1 second per clip
  const minDuration = 1.0;
  const adjustedDurations = durations.map(d => Math.max(d, minDuration));

  // Normalize to match total audio duration
  const currentTotal = adjustedDurations.reduce((sum, d) => sum + d, 0);
  if (currentTotal !== audioDuration && currentTotal > 0) {
    const ratio = audioDuration / currentTotal;
    return adjustedDurations.map(d => d * ratio);
  }

  return adjustedDurations;
}

/**
 * Fetch clips with duration preference
 * First tries to find clips with at least 2/3 of target duration to minimize looping
 * Falls back to any available clips if no suitable ones found
 */
async function fetchClipsWithDurationPreference(
  keyPhrase: string,
  targetDuration: number,
  maxClips: number = 3
): Promise<StockClip[]> {
  // Calculate minimum preferred duration (2/3 of target)
  const minPreferredDuration = (targetDuration * 2) / 3;

  console.log(`🎯 Target duration: ${targetDuration.toFixed(2)}s, preferred min: ${minPreferredDuration.toFixed(2)}s`);

  // First attempt: try to find clips meeting duration requirement
  let clips = await fetchClipsForKeyword(keyPhrase, maxClips, minPreferredDuration);

  // If no clips found with duration filter, try without filter
  if (clips.length === 0) {
    console.log(`⚠️ No clips found with duration filter, trying without filter...`);
    clips = await fetchClipsForKeyword(keyPhrase, maxClips);
  }

  // If still no clips, try simplified phrase (first 2 words)
  if (clips.length === 0) {
    const simplifiedPhrase = keyPhrase.split(' ').slice(0, 2).join(' ');
    console.log(`⚠️ No clips found for "${keyPhrase}", trying simplified: "${simplifiedPhrase}"...`);

    // Try simplified with duration filter first
    clips = await fetchClipsForKeyword(simplifiedPhrase, maxClips, minPreferredDuration);

    // Then without filter
    if (clips.length === 0) {
      clips = await fetchClipsForKeyword(simplifiedPhrase, maxClips);
    }
  }

  return clips;
}

/**
 * Download stock footage clips for a video based on narration keywords
 * @param videoId - Unique identifier for the video
 * @param narration - Full narration text
 * @param narrationAudioPath - Path to the narration audio file (to calculate duration)
 * @returns ClipDownloadResult with paths and timing information
 */
export async function downloadClipsForVideo(
  videoId: string,
  narration: string,
  narrationAudioPath?: string
): Promise<ClipDownloadResult> {

  const cloudinaryService = CloudinaryService.getInstance();

  console.log(`\n🎬 Starting clip download for video: ${videoId}`);

  // Get audio duration if path is provided
  let audioDuration: number = 0;
  if (narrationAudioPath) {
    try {
      audioDuration = await getVideoDuration(narrationAudioPath);
      console.log(`🎵 Audio duration: ${audioDuration.toFixed(2)}s`);
    } catch (error) {
      console.warn('⚠️  Could not determine audio duration, using default keyword count');
      audioDuration = 60; // Default to 60 seconds if we can't determine
    }
  } else {
    // Estimate duration based on word count (average 150 words per minute)
    const wordCount = narration.split(/\s+/).length;
    audioDuration = (wordCount / 150) * 60;
    console.log(`📊 Estimated audio duration: ${audioDuration.toFixed(2)}s (based on ${wordCount} words)`);
  }

  // Extract key phrases using AI based on content and duration
  // AI decides the optimal number of clips
  const keywordExtractor = new KeywordExtractor();
  const result = await keywordExtractor.extractKeywords(narration, audioDuration);

  console.log(`🎯 AI decided on ${result.clipCount} clips`);
  console.log(`📝 Extracted key phrases:`, result.keyPhrases.map(kp => `"${kp.phrase}" (${kp.wordsCovered} words)`));

  if (result.keyPhrases.length === 0) {
    throw new Error('No key phrases could be extracted from narration');
  }

  // Calculate dynamic clip durations based on word coverage
  const clipDurations = calculateClipDurations(result.keyPhrases, audioDuration, result.totalWordsCovered);
  console.log(`⏱️  Clip durations: ${clipDurations.map(d => d.toFixed(2) + 's').join(', ')}`);

  // Create output directory
  const outputDir = path.join(config.worker.tmpDir, videoId);
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`📁 Output directory: ${outputDir}`);

  const uploadedUrls: string[] = [];
  const downloadedTimings: number[] = [];
  const downloadedKeyPhrases: KeyPhrase[] = [];
  let clipCounter = 1;

  // Iterate through key phrases and download clips
  for (let i = 0; i < result.keyPhrases.length; i++) {
    const keyPhrase = result.keyPhrases[i];
    const targetDuration = clipDurations[i];

    // Fetch clips with duration preference (prefers clips >= 2/3 of target duration)
    const clips = await fetchClipsWithDurationPreference(keyPhrase.phrase, targetDuration, 3);

    if (clips.length === 0) {
      console.warn(`❌ Could not find any clips for "${keyPhrase.phrase}", skipping...`);
      continue;
    }

    // Download the best clip for this phrase (already sorted by duration, longest first)
    for (const clip of clips) {
      try {
        const clipNumber = clipCounter.toString().padStart(3, '0');
        const filename = `clip-${clipNumber}.mp4`;
        const outputPath = path.join(outputDir, filename);

        const loopingNeeded = clip.duration < targetDuration;
        const loopInfo = loopingNeeded
          ? ` ⚠️ will loop ${(targetDuration / clip.duration).toFixed(1)}x`
          : ' ✓ no looping needed';

        console.log(`⬇️  Downloading clip ${clipCounter}/${result.clipCount} for "${keyPhrase.phrase}"`);
        console.log(`   Target: ${targetDuration.toFixed(2)}s, Clip: ${clip.duration}s${loopInfo}`);

        await downloadClip(clip.url, outputPath);

        try {
          const { secureUrl } = await cloudinaryService.uploadVideo(outputPath, `videos/${videoId}/clips/${filename}`, `clip-${clipCounter}`);
          console.log(`☁️ Uploaded to Cloudinary: ${secureUrl}`);
          uploadedUrls.push(secureUrl);

          await fs.unlink(outputPath);
          console.log(`🗑️ Deleted local file: ${outputPath}`);
        } catch (uploadError) {
          console.error(`❌ Failed to upload clip to Cloudinary for "${keyPhrase.phrase}":`, uploadError);
        }

        downloadedTimings.push(targetDuration);
        downloadedKeyPhrases.push(keyPhrase);
        console.log(`✅ Downloaded: ${filename} (${clip.width}x${clip.height})`);

        clipCounter++;
        break; // Only need one clip per key phrase
      } catch (error) {
        console.error(`❌ Failed to download clip for "${keyPhrase.phrase}":`, error);
        // Continue with next clip option
      }
    }

    // Small delay to be nice to the API
    if (i < result.keyPhrases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (uploadedUrls.length === 0) {
    throw new Error('Failed to download any clips. Check your PEXELS_API_KEY and network connection.');
  }

  console.log(`\n✅ Successfully downloaded ${uploadedUrls.length} clips`);
  console.log(`📊 Total target duration: ${downloadedTimings.reduce((a, b) => a + b, 0).toFixed(2)}s`);

  return {
    clipUrls: uploadedUrls,
    clipTimings: downloadedTimings,
    totalTargetDuration: audioDuration,
    keyPhrases: downloadedKeyPhrases,
  };
}

/**
 * Legacy function for backward compatibility - returns just paths
 * @deprecated Use downloadClipsForVideo which returns ClipDownloadResult
 */
export async function downloadClipsForVideoLegacy(
  videoId: string,
  narration: string,
  narrationAudioPath?: string
): Promise<string[]> {
  const result = await downloadClipsForVideo(videoId, narration, narrationAudioPath);
  return result.clipUrls;
}
