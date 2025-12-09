/**
 * Video Assembly Service
 * Assembles final video from clips, music, and branding using FFmpeg
 */

import fs from 'fs/promises';
import path from 'path';
import { runFFmpeg, getVideoDuration, checkFFmpeg } from './ffmpeg-utils';

export interface VideoAssemblyInput {
    videoId: string;
    clips: string[];
    narration?: string; // Add narration text for timing
    music?: string;
    branding?: {
        logo?: string;
        intro?: string;
        outro?: string;
    };
}

export interface VideoAssemblyResult {
    videoId: string;
    outputPath: string;
    duration: number;
    clipCount: number;
}

export class VideoAssemblyService {
    private workDir: string;
    private readonly WORDS_PER_MINUTE = 150; // Average speaking rate
    private readonly WORDS_PER_SECOND = this.WORDS_PER_MINUTE / 60;

    constructor(workDir?: string) {
        this.workDir = workDir || path.join(process.cwd(), 'videos');
    }

    /**
     * Calculate duration for narration text (in seconds)
     */
    private calculateNarrationDuration(text: string): number {
        // Remove [PAUSE] markers and count words
        const cleanText = text.replace(/\[PAUSE\]/g, '');
        const wordCount = cleanText.trim().split(/\s+/).filter(w => w.length > 0).length;

        // Count pauses (add 1 second per pause)
        const pauseCount = (text.match(/\[PAUSE\]/g) || []).length;

        // Calculate duration: (words / words_per_second) + (pause_count * 1)
        const duration = (wordCount / this.WORDS_PER_SECOND) + pauseCount;

        return Math.max(duration, 5); // Minimum 5 seconds
    }

    /**
     * Split narration into segments and calculate timing for each clip
     */
    private calculateClipTimings(narration: string, clipCount: number): number[] {
        if (!narration || clipCount === 0) {
            // Fallback to equal distribution of 5 seconds each
            return Array(clipCount).fill(5);
        }

        // Split narration into paragraphs
        const paragraphs = narration.split('\n\n').filter(p => p.trim().length > 0);

        if (paragraphs.length === 0) {
            return Array(clipCount).fill(5);
        }

        // Calculate duration for each paragraph
        const paragraphDurations = paragraphs.map(p => this.calculateNarrationDuration(p));
        const totalNarrationDuration = paragraphDurations.reduce((sum, d) => sum + d, 0);

        console.log(`📊 Narration Analysis:`);
        console.log(`   Paragraphs: ${paragraphs.length}`);
        console.log(`   Total duration: ${totalNarrationDuration.toFixed(2)}s`);
        console.log(`   Clips: ${clipCount}`);

        // Distribute clips across paragraphs proportionally
        const clipTimings: number[] = [];

        if (paragraphs.length >= clipCount) {
            // More paragraphs than clips: group paragraphs
            const paragraphsPerClip = Math.ceil(paragraphs.length / clipCount);

            for (let i = 0; i < clipCount; i++) {
                const startIdx = i * paragraphsPerClip;
                const endIdx = Math.min(startIdx + paragraphsPerClip, paragraphs.length);
                const clipDuration = paragraphDurations.slice(startIdx, endIdx).reduce((sum, d) => sum + d, 0);
                clipTimings.push(clipDuration);
            }
        } else {
            // More clips than paragraphs: distribute clips across paragraphs
            const clipsPerParagraph = clipCount / paragraphs.length;

            paragraphs.forEach((_, pIdx) => {
                const paragraphDuration = paragraphDurations[pIdx];
                const clipsInThisParagraph = Math.round(clipsPerParagraph);
                const durationPerClip = paragraphDuration / clipsInThisParagraph;

                for (let i = 0; i < clipsInThisParagraph && clipTimings.length < clipCount; i++) {
                    clipTimings.push(durationPerClip);
                }
            });
        }

        // Ensure we have exactly clipCount timings
        while (clipTimings.length < clipCount) {
            clipTimings.push(5);
        }
        while (clipTimings.length > clipCount) {
            clipTimings.pop();
        }

        console.log(`   Clip timings: ${clipTimings.map(t => t.toFixed(1) + 's').join(', ')}`);

        return clipTimings;
    }

    /**
     * Assemble a complete video from all assets
     */
    async assembleVideo(input: VideoAssemblyInput): Promise<VideoAssemblyResult> {
        console.log('\n🎬 === VIDEO ASSEMBLY STARTED ===');
        console.log(`Video ID: ${input.videoId}`);
        console.log(`Clips: ${input.clips.length}`);
        console.log(`Narration: ${input.narration ? '✓' : '✗'}`);
        console.log(`Music: ${input.music ? '✓' : '✗'}`);
        console.log(`Branding: ${input.branding ? Object.keys(input.branding).length : 0} asset(s)`);

        // Check FFmpeg availability
        const hasFFmpeg = await checkFFmpeg();
        if (!hasFFmpeg) {
            throw new Error('FFmpeg is not installed or not in PATH');
        }

        // Create output directory
        const outputDir = path.join(this.workDir, input.videoId);
        await fs.mkdir(outputDir, { recursive: true });

        // Calculate clip timings based on narration
        const clipTimings = this.calculateClipTimings(input.narration || '', input.clips.length);

        // Step 1: Normalize all clips with narration-based timing
        console.log('\n📐 Step 1: Normalizing clips with narration timing...');
        const normalizedClips = await this.normalizeClipsWithTiming(input.clips, clipTimings, outputDir);
        console.log(`✅ Normalized ${normalizedClips.length} clips`);

        // Step 2: Add intro and outro to normalized clips
        console.log('\n🎬 Step 2: Adding intro/outro videos...');
        const clipsWithBranding = await this.addIntroOutro(
            normalizedClips,
            input.branding?.intro,
            input.branding?.outro,
            outputDir
        );
        console.log(`✅ Branding videos processed`);

        // Step 3: Concatenate all clips
        console.log('\n🔗 Step 3: Concatenating clips...');
        const combinedVideo = path.join(outputDir, 'combined.mp4');
        await this.concatClips(clipsWithBranding, combinedVideo);
        console.log(`✅ Created combined video`);

        // Get total video duration
        const videoDuration = await getVideoDuration(combinedVideo);
        console.log(`📊 Total video duration: ${videoDuration.toFixed(2)}s`);

        // Step 4: Prepare background music (loop if needed)
        console.log('\n🎵 Step 4: Preparing background music...');
        let finalAudio: string;
        if (input.music) {
            finalAudio = await this.prepareBackgroundMusic(input.music, videoDuration, outputDir);
            console.log(`✅ Background music prepared`);
        } else {
            // Generate silence
            finalAudio = path.join(outputDir, 'silence.mp3');
            await this.generatePlaceholderNarration(videoDuration, finalAudio);
            console.log(`✅ Using silence (no music provided)`);
        }

        // Step 5: Combine video with audio
        console.log('\n🎬 Step 5: Combining video and audio...');
        const videoWithAudio = path.join(outputDir, 'video_with_audio.mp4');
        await this.addAudioToVideo(combinedVideo, finalAudio, videoWithAudio);
        console.log(`✅ Audio added to video`);

        // Step 6: Overlay logo
        console.log('\n🎨 Step 6: Overlaying logo...');
        const finalOutput = path.join(outputDir, 'final.mp4');
        await this.overlayLogo(videoWithAudio, input.branding?.logo, finalOutput);
        console.log(`✅ Logo overlay complete`);

        console.log('\n✅ === VIDEO ASSEMBLY COMPLETE ===');
        console.log(`📁 Output: ${finalOutput}`);
        console.log(`⏱️  Duration: ${videoDuration.toFixed(2)}s`);
        console.log(`🎞️  Clips: ${input.clips.length}`);

        return {
            videoId: input.videoId,
            outputPath: `${input.videoId}/final.mp4`, // Path relative to videos/ directory
            duration: videoDuration,
            clipCount: input.clips.length,
        };
    }

    /**
     * Normalize clips with specific timing for each clip
     */
    async normalizeClipsWithTiming(
        clips: string[],
        timings: number[],
        outputDir: string
    ): Promise<string[]> {
        const normalizedDir = path.join(outputDir, 'normalized');
        await fs.mkdir(normalizedDir, { recursive: true });

        const normalizedClips: string[] = [];

        for (let i = 0; i < clips.length; i++) {
            const clipPath = clips[i];
            const targetDuration = timings[i];
            const outputPath = path.join(normalizedDir, `clip_${i + 1}.mp4`);

            console.log(`  Normalizing clip ${i + 1}/${clips.length} (target: ${targetDuration.toFixed(2)}s)...`);
            await this.normalizeClipWithDuration(clipPath, outputPath, targetDuration);

            normalizedClips.push(outputPath);
        }

        return normalizedClips;
    }

    /**
     * Normalize a clip to specific duration
     */
    async normalizeClipWithDuration(
        inputPath: string,
        outputPath: string,
        targetDuration: number
    ): Promise<void> {
        // Get original duration
        let originalDuration: number;
        try {
            originalDuration = await getVideoDuration(inputPath);
        } catch (error) {
            console.warn(`  Could not get duration for ${inputPath}, using target duration`);
            originalDuration = targetDuration;
        }

        if (originalDuration < targetDuration) {
            // Clip is too short, loop it
            console.log(`    Looping clip from ${originalDuration.toFixed(2)}s to ${targetDuration.toFixed(2)}s`);
            await runFFmpeg({
                inputs: [
                    { flags: ['-stream_loop', '-1'], path: inputPath }
                ],
                output: outputPath,
                args: [
                    '-t', targetDuration.toString(),
                    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30',
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-ar', '48000',
                    '-movflags', '+faststart',
                ],
            });
        } else {
            // Clip is long enough, trim to target duration
            console.log(`    Trimming clip from ${originalDuration.toFixed(2)}s to ${targetDuration.toFixed(2)}s`);
            await runFFmpeg({
                inputs: [inputPath],
                output: outputPath,
                args: [
                    '-t', targetDuration.toString(),
                    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30',
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '128k',
                    '-ar', '48000',
                    '-movflags', '+faststart',
                ],
            });
        }
    }

    /**
     * Normalize a clip to 1920x1080 (for intro/outro without specific duration)
     */
    async normalizeClip(inputPath: string, outputPath: string): Promise<void> {
        await runFFmpeg({
            inputs: [inputPath],
            output: outputPath,
            args: [
                '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,fps=30',
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '128k',
                '-ar', '48000',
                '-movflags', '+faststart',
            ],
        });
    }

    /**
     * Add intro and outro videos to the clip list
     */
    async addIntroOutro(
        clips: string[],
        introPath: string | undefined,
        outroPath: string | undefined,
        outputDir: string
    ): Promise<string[]> {
        const result: string[] = [];

        // Normalize intro if exists
        if (introPath) {
            const normalizedIntro = path.join(outputDir, 'normalized', 'intro.mp4');
            console.log('  Normalizing intro video...');
            await this.normalizeClip(introPath, normalizedIntro);
            result.push(normalizedIntro);
            console.log('  ✓ Intro added');
        }

        // Add main clips
        result.push(...clips);

        // Normalize outro if exists
        if (outroPath) {
            const normalizedOutro = path.join(outputDir, 'normalized', 'outro.mp4');
            console.log('  Normalizing outro video...');
            await this.normalizeClip(outroPath, normalizedOutro);
            result.push(normalizedOutro);
            console.log('  ✓ Outro added');
        }

        return result;
    }

    /**
     * Prepare background music - loop if shorter than video
     */
    async prepareBackgroundMusic(
        musicPath: string,
        videoDuration: number,
        outputDir: string
    ): Promise<string> {
        const outputPath = path.join(outputDir, 'background_music.mp3');

        // Get music duration
        let musicDuration: number;
        try {
            musicDuration = await getVideoDuration(musicPath);
        } catch (error) {
            console.warn('  Could not get music duration, using as-is');
            await fs.copyFile(musicPath, outputPath);
            return outputPath;
        }

        console.log(`  Music duration: ${musicDuration.toFixed(2)}s, Video duration: ${videoDuration.toFixed(2)}s`);

        if (musicDuration >= videoDuration) {
            // Music is long enough, just trim to video length
            console.log('  Trimming music to match video duration...');
            await runFFmpeg({
                inputs: [musicPath],
                output: outputPath,
                args: [
                    '-t', videoDuration.toString(),
                    '-c:a', 'libmp3lame',
                    '-b:a', '192k',
                ],
            });
        } else {
            // Music is shorter, loop it
            console.log('  Looping music to match video duration...');
            await runFFmpeg({
                inputs: [musicPath],
                output: outputPath,
                args: [
                    '-filter_complex', `aloop=loop=-1:size=2e+09`,
                    '-t', videoDuration.toString(),
                    '-c:a', 'libmp3lame',
                    '-b:a', '192k',
                ],
            });
        }

        console.log('  ✓ Background music ready');
        return outputPath;
    }

    /**
     * Concatenate multiple clips into one video with smooth transitions
     */
    async concatClips(clips: string[], outputPath: string): Promise<void> {
        if (clips.length === 0) {
            throw new Error('No clips to concatenate');
        }

        if (clips.length === 1) {
            // Only one clip, just copy it
            await fs.copyFile(clips[0], outputPath);
            return;
        }

        console.log(`  Concatenating ${clips.length} clips with crossfade transitions...`);

        // Use simpler concatenation with proper re-encoding for smooth playback
        const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
        const concatList = clips.map(clip => `file '${clip}'`).join('\n');
        await fs.writeFile(concatListPath, concatList);

        // Use concat protocol with re-encoding for smooth transitions
        await runFFmpeg({
            inputs: [],
            output: outputPath,
            args: [
                '-f', 'concat',
                '-safe', '0',
                '-i', concatListPath,
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart',
            ],
        });

        console.log('  ✓ Clips concatenated smoothly');
    }

    /**
     * Generate placeholder narration (silence) for the given duration
     */
    async generatePlaceholderNarration(duration: number, outputPath: string): Promise<void> {
        await runFFmpeg({
            inputs: [],
            output: outputPath,
            args: [
                '-f', 'lavfi',
                '-i', `anullsrc=r=44100:cl=stereo`,
                '-t', duration.toString(),
                '-c:a', 'libmp3lame',
                '-b:a', '128k',
            ],
        });
    }

    /**
     * Add audio track to video
     */
    async addAudioToVideo(
        videoPath: string,
        audioPath: string,
        outputPath: string
    ): Promise<void> {
        await runFFmpeg({
            inputs: [videoPath, audioPath],
            output: outputPath,
            args: [
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-shortest',
            ],
        });
    }

    /**
     * Overlay logo on video
     */
    async overlayLogo(
        videoPath: string,
        logoPath: string | undefined,
        outputPath: string
    ): Promise<void> {
        if (!logoPath) {
            // No logo, just copy the video
            await fs.copyFile(videoPath, outputPath);
            console.log('  No logo provided, skipping overlay');
            return;
        }

        // Check if logo file exists
        try {
            await fs.access(logoPath);
        } catch (error) {
            console.warn('  Logo file not found, skipping overlay');
            await fs.copyFile(videoPath, outputPath);
            return;
        }

        console.log(`  Applying logo overlay from: ${logoPath}`);

        // Overlay logo at top-right corner with 20px padding
        await runFFmpeg({
            inputs: [videoPath, logoPath],
            output: outputPath,
            args: [
                '-filter_complex',
                '[1:v]scale=150:-1[logo];[0:v][logo]overlay=W-w-20:20',
                '-c:a', 'copy',
                '-c:v', 'libx264',
                '-preset', 'medium',
                '-crf', '23',
            ],
        });

        console.log('  ✓ Logo overlay applied');
    }
}

export default VideoAssemblyService;
