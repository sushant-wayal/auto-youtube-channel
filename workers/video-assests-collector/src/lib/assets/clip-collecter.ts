/**
 * Clip collecter Service
 * collects stock footage clips and saves them to disk
 */

import fs from 'fs/promises';
import path from 'path';
import { KeywordExtractor, KeyPhrase } from './keyword-extractor';
import { fetchClipsForKeyword, StockClip } from './pexels-client';
import config from '../../config';
import RedisService from '../../services/redis-service';

/**
 * Result of clip collect with timing information
 */
export interface ClipCollectResult {
  clipUrls: string[];           // Paths to founded clips
  clipTimings: number[];         // Pre-calculated duration for each clip (in seconds)
  totalTargetDuration: number;   // Total target duration based on audio
  keyPhrases: KeyPhrase[];       // Key phrases used for each clip
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
 * collect stock footage clips for a video based on narration keywords
 * @param videoId - Unique identifier for the video
 * @param narration - Full narration text
 * @param narrationAudioPath - Path to the narration audio file (to calculate duration)
 * @returns ClipcollectResult with paths and timing information
 */
export async function collectClipsForVideo(
  jobId: string,
  videoId: string,
  narration: string
): Promise<ClipCollectResult> {

  const redisService = RedisService.getInstance();

  console.log(`\n🎬 Starting clip collect for video: ${videoId}`);

  // Get audio duration if path is provided
  let audioDuration: number = 0;
  // Estimate duration based on word count (average 150 words per minute)
  const wordCount = narration.split(/\s+/).length;
  audioDuration = (wordCount / 150) * 60;
  console.log(`📊 Estimated audio duration: ${audioDuration.toFixed(2)}s (based on ${wordCount} words)`);

  // Extract key phrases using AI based on content and duration
  // AI decides the optimal number of clips
  const keywordExtractor = new KeywordExtractor();
  const result = await keywordExtractor.extractKeywords(narration, audioDuration);

  await redisService.updateJobProgress(
    jobId, 'processing', 30, 'Calculating clip timings based on key phrases...'
  );

  console.log(`🎯 AI decided on ${result.clipCount} clips`);
  console.log(`📝 Extracted key phrases:`, result.keyPhrases.map(kp => `"${kp.phrase}" (${kp.wordsCovered} words)`));

  if (result.keyPhrases.length === 0) {
    throw new Error('No key phrases could be extracted from narration');
  }

  // Calculate dynamic clip durations based on word coverage
  const clipDurations = calculateClipDurations(result.keyPhrases, audioDuration, result.totalWordsCovered);
  console.log(`⏱️  Clip durations: ${clipDurations.map(d => d.toFixed(2) + 's').join(', ')}`);

  const collectedUrls: string[] = [];
  const collectedTimings: number[] = [];
  const collectedKeyPhrases: KeyPhrase[] = [];
  let clipCounter = 1;

  await redisService.updateJobProgress(
    jobId, 'processing', 50, 'Collecting stock footage clips...'
  );

  // Iterate through key phrases and collect clips
  for (let i = 0; i < result.keyPhrases.length; i++) {
    const keyPhrase = result.keyPhrases[i];
    const targetDuration = clipDurations[i];

    // Fetch clips with duration preference (prefers clips >= 2/3 of target duration)
    const clips = await fetchClipsWithDurationPreference(keyPhrase.phrase, targetDuration, 3);

    if (clips.length === 0) {
      console.warn(`❌ Could not find any clips for "${keyPhrase.phrase}", skipping...`);
      continue;
    }

    // collect the best clip for this phrase (already sorted by duration, longest first)

    const bestClip = clips.reduce((prev, curr) =>
      Math.abs(curr.duration - targetDuration) < Math.abs(prev.duration - targetDuration) ? curr : prev
    );
    
    try {
      const loopingNeeded = bestClip.duration < targetDuration;
      const loopInfo = loopingNeeded
        ? ` ⚠️ will loop ${(targetDuration / bestClip.duration).toFixed(1)}x`
        : ' ✓ no looping needed';

      console.log(`⬇️  collecting clip ${clipCounter}/${result.clipCount} for "${keyPhrase.phrase}"`);
      console.log(`   Target: ${targetDuration.toFixed(2)}s, Clip: ${bestClip.duration}s${loopInfo}`);
      collectedTimings.push(targetDuration);
      collectedKeyPhrases.push(keyPhrase);
      collectedUrls.push(bestClip.url);

      clipCounter++;
    } catch (error) {
      console.error(`❌ Failed to collect clip for "${keyPhrase.phrase}":`, error);
      // Continue with next clip option
    }

    await redisService.updateJobProgress(
      jobId, 'processing', 50 + Math.floor(((i + 1) / result.keyPhrases.length) * 40), `Collecting clips... (${i + 1}/${result.keyPhrases.length})`
    );

    // Small delay to be nice to the API
    if (i < result.keyPhrases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  if (collectedUrls.length === 0) {
    throw new Error('Failed to collect any clips. Check your PEXELS_API_KEY and network connection.');
  }

  console.log(`\n✅ Successfully collected ${collectedUrls.length} clips`);
  console.log(`📊 Total target duration: ${collectedTimings.reduce((a, b) => a + b, 0).toFixed(2)}s`);

  return {
    clipUrls: collectedUrls,
    clipTimings: collectedTimings,
    totalTargetDuration: audioDuration,
    keyPhrases: collectedKeyPhrases,
  };
}
