/**
 * Video Generation Job Processor
 * Uses internal lib services to process video generation jobs
 * 
 * Flow:
 * 1. Script Generation
 * 2. In Parallel: Voice-over + Assets + Thumbnail
 * 3. Video Assembly (waits for voice-over + assets only)
 * 4. Shorts Generation (ALL shorts run in parallel, each with parallel voice-over + assets)
 */

import path from 'path';
import fs from 'fs/promises';

// Import services from worker's internal lib
import ScriptGenerationService from '../lib/pipeline/script-generation';
import GeminiTTSService from '../lib/audio/gemini-tts-service';
import VideoAssemblyService from '../lib/video/video-assembly';
import { downloadClipsForVideo } from '../lib/assets/clip-downloader';
import { pickBackgroundTrack, getBrandingAssets } from '../lib/assets/music-branding';
import ThumbnailService from '../lib/ai/thumbnail-service';

// Import worker services
import RedisService from '../services/redis-service';
import CloudinaryService from '../services/cloudinary-service';
import config from '../config';

import { VideoGenerationJob, ShortVideoResult, ShortGenerationProgress, ShortStepProgress } from '../types';

// Helper to create initial short step progress
const createInitialStepProgress = (): ShortStepProgress => ({
    status: 'idle',
    progress: 0,
    message: 'Waiting...',
});

// Helper to create initial short generation progress
const createInitialShortProgress = (shortIndex: number): ShortGenerationProgress => ({
    shortIndex,
    status: 'idle',
    voiceOverStep: createInitialStepProgress(),
    assetsStep: createInitialStepProgress(),
    assemblyStep: createInitialStepProgress(),
    uploadStep: createInitialStepProgress(),
});

class JobProcessor {
    private scriptService: ScriptGenerationService;
    private ttsService: GeminiTTSService;
    private assemblyService: VideoAssemblyService;
    private thumbnailService: ThumbnailService;
    private redisService: RedisService;
    private cloudinaryService: CloudinaryService;

    constructor() {
        this.scriptService = new ScriptGenerationService();
        this.ttsService = new GeminiTTSService();
        this.assemblyService = new VideoAssemblyService(config.worker.workDir);
        this.thumbnailService = new ThumbnailService();
        this.redisService = RedisService.getInstance();
        this.cloudinaryService = CloudinaryService.getInstance();
    }

    /**
     * Process a video generation job with parallel execution
     */
    async processJob(job: VideoGenerationJob): Promise<void> {
        const { jobId, videoIdea } = job;
        console.log(`\n🎬 === PROCESSING JOB: ${jobId} ===`);
        console.log(`📝 Video Idea: ${videoIdea}`);

        try {
            // ============ Stage 1: Generate Script ============
            await this.redisService.updateJobProgress(
                jobId, 'script_generating', 5, 'Generating video script with AI...'
            );

            const script = await this.scriptService.generateScript(videoIdea, 7);
            console.log(`✅ Script generated: "${script.title}"`);

            await this.redisService.updateJobProgress(
                jobId, 'script_generating', 15, 'Script generated successfully!',
                { script }
            );

            const videoId = `video-${Date.now()}`;
            const audioOutputDir = path.join(config.worker.workDir, videoId);
            await fs.mkdir(audioOutputDir, { recursive: true });

            // ============ Stage 2: Parallel - Voice-over + Assets + Thumbnail ============
            console.log(`\n🚀 Starting parallel generation: Voice-over + Assets + Thumbnail`);

            await this.redisService.updateJobProgress(
                jobId, 'voiceover_generating', 20, 'Starting parallel: Voice-over + Assets + Thumbnail...'
            );

            // Track results
            let voiceOverPath: string | null = null;
            let voiceOverUrl: string | null = null;
            let clipResult: Awaited<ReturnType<typeof downloadClipsForVideo>> | null = null;
            let thumbnailUrl: string | undefined = undefined;

            // Run voice-over, assets, and thumbnail in parallel
            const [voiceOverResult, assetsResult, thumbnailResult] = await Promise.allSettled([
                // Voice-over generation
                (async () => {
                    console.log(`🎙️ Starting voice-over generation...`);
                    const audioOutputPath = path.join(audioOutputDir, 'narration.wav');
                    const path_ = await this.ttsService.generateNarrationAudio(
                        script.narration,
                        audioOutputPath,
                        { voice: 'Puck' }
                    );
                    console.log(`✅ Voice-over generated: ${path_}`);

                    const upload = await this.cloudinaryService.uploadAudio(
                        path_,
                        `${jobId}/audio`,
                        'narration-audio'
                    );
                    console.log(`✅ Voice-over uploaded to Cloudinary: ${upload.secureUrl}`);

                    return { audioPath: path_, cloudUrl: upload.secureUrl };
                })(),

                // Assets generation
                (async () => {
                    console.log(`🎬 Starting assets download...`);
                    // We need voice-over for clip timing, so we generate a temporary estimate
                    // Assets will be downloaded based on narration text
                    const audioOutputPath = path.join(audioOutputDir, 'narration.wav');
                    let voiceOverPathForClips = audioOutputPath;

                    const result = await downloadClipsForVideo(videoId, script.narration, voiceOverPathForClips);
                    console.log(`✅ Downloaded ${result.clipUrls.length} clips`);
                    return result;
                })(),

                // Thumbnail generation
                (async () => {
                    console.log(`🖼️ Starting thumbnail generation...`);
                    const thumbnail = await this.thumbnailService.generateThumbnail(
                        videoId,
                        script.title,
                        script.description,
                        script.narration,
                        script.tags
                    );
                    console.log(`✅ Thumbnail generated: ${thumbnail.thumbnailPath}`);

                    // Upload to Cloudinary
                    const upload = await this.cloudinaryService.uploadImage(
                        thumbnail.thumbnailPath,
                        `${jobId}/thumbnails`,
                        'main-thumbnail'
                    );
                    console.log(`✅ Thumbnail uploaded to Cloudinary`);

                    await fs.unlink(thumbnail.thumbnailPath);
                    console.log(`🗑️ Deleted local file: ${thumbnail.thumbnailPath}`);

                    return { cloudUrl: upload.secureUrl };
                })(),
            ]);

            // Process results
            if (voiceOverResult.status === 'fulfilled') {
                voiceOverPath = voiceOverResult.value.audioPath;
                voiceOverUrl = voiceOverResult.value.cloudUrl;
            } else {
                console.error(`❌ Voice-over failed:`, voiceOverResult.reason);
                throw new Error(`Voice-over generation failed: ${voiceOverResult.reason}`);
            }

            if (assetsResult.status === 'fulfilled') {
                clipResult = assetsResult.value;
            } else {
                console.error(`❌ Assets failed:`, assetsResult.reason);
                throw new Error(`Assets generation failed: ${assetsResult.reason}`);
            }

            if (thumbnailResult.status === 'fulfilled') {
                thumbnailUrl = thumbnailResult.value.cloudUrl;
            } else {
                console.warn(`⚠️ Thumbnail failed (non-critical):`, thumbnailResult.reason);
            }

            await this.redisService.updateJobProgress(
                jobId, 'assets_generating', 50,
                `Parallel complete! Voice-over ✓, ${clipResult.clipUrls.length} clips ✓${thumbnailUrl ? ', Thumbnail ✓' : ''}`,
                { voiceOverUrl, thumbnailUrl }
            );

            // ============ Stage 3: Video Assembly (needs voice-over + assets) ============
            console.log(`\n🎥 Starting video assembly...`);

            await this.redisService.updateJobProgress(
                jobId, 'video_assembling', 55, 'Assembling main video with FFmpeg...'
            );

            let music: string = '';
            try {
                music = pickBackgroundTrack();
            } catch (error) {
                console.warn('⚠️ No background music available');
            }

            const branding = getBrandingAssets();

            const assembledVideo = await this.assemblyService.assembleVideo({
                videoId,
                clips: clipResult.clipUrls,
                clipTimings: clipResult.clipTimings,
                narration: script.narration,
                narrationAudio: voiceOverPath,
                music,
                branding,
                isShort: false,
            });
            console.log(`✅ Main video assembled: ${assembledVideo.duration.toFixed(1)}s`);

            // Upload main video to Cloudinary
            const mainVideoPath = path.join(config.worker.workDir, assembledVideo.outputPath);
            const mainVideoUpload = await this.cloudinaryService.uploadVideo(
                mainVideoPath,
                `${jobId}/videos`,
                'main-video'
            );

            const videoFilesDirPath = path.join(config.worker.workDir, videoId);
            await fs.rm(videoFilesDirPath, { recursive: true, force: true });
            console.log(`🧹 Cleaned up video files directory: ${videoFilesDirPath}`);

            console.log(`🗑️ Deleted local file: ${mainVideoPath}`);

            await this.redisService.updateJobProgress(
                jobId, 'video_assembling', 65, `Main video assembled! Duration: ${assembledVideo.duration.toFixed(0)}s`,
                { mainVideoUrl: mainVideoUpload.secureUrl }
            );

            // ============ Stage 4: Generate ALL Shorts in Parallel ============
            const totalShorts = script.shorts.length;

            const shortsProgress: ShortGenerationProgress[] = script.shorts.map((_, index) =>
                createInitialShortProgress(index)
            );

            // Mark all shorts as starting
            shortsProgress.forEach(sp => sp.status = 'running');

            await this.redisService.updateJobProgress(
                jobId, 'shorts_generating', 70, `Starting parallel generation of ${totalShorts} shorts...`,
                { shortsProgress }
            );

            console.log(`\n🚀 Starting PARALLEL generation of ${totalShorts} shorts...`);

            // Run ALL shorts in parallel
            const shortsPromises = script.shorts.map((short, index) =>
                this.generateShortWithParallelSteps(
                    jobId, videoId, index, short.hook, short.script, script.title,
                    shortsProgress, totalShorts
                )
                    .then(result => {
                        shortsProgress[index].status = 'completed';
                        console.log(`✅ Short ${index + 1}/${totalShorts} completed: ${result.videoUrl}`);
                        return { status: 'fulfilled' as const, value: result, index };
                    })
                    .catch(error => {
                        shortsProgress[index].status = 'error';
                        console.error(`❌ Short ${index + 1}/${totalShorts} failed:`, error);
                        return { status: 'rejected' as const, reason: error, index };
                    })
            );

            const shortsSettled = await Promise.all(shortsPromises);

            // Collect successful results
            const shortsResults: ShortVideoResult[] = shortsSettled
                .filter((result): result is { status: 'fulfilled'; value: ShortVideoResult; index: number } =>
                    result.status === 'fulfilled'
                )
                .map(result => result.value);

            // Log summary
            const failedCount = totalShorts - shortsResults.length;
            if (failedCount > 0) {
                console.warn(`⚠️ ${failedCount}/${totalShorts} shorts failed`);
            }

            await this.redisService.updateJobProgress(
                jobId, 'shorts_generating', 95,
                `Generated ${shortsResults.length}/${totalShorts} shorts in parallel!`,
                { shortsVideos: shortsResults, shortsProgress }
            );

            // ============ Stage 5: Complete ============
            await this.redisService.completeJob(jobId, {
                script,
                voiceOverUrl,
                mainVideoUrl: mainVideoUpload.secureUrl,
                thumbnailUrl,
                shortsVideos: shortsResults,
                shortsProgress,
            });

            console.log(`\n🎉 === JOB COMPLETED: ${jobId} ===`);

        } catch (error) {
            console.error(`❌ Job ${jobId} failed:`, error);
            await this.redisService.failJob(
                jobId,
                error instanceof Error ? error.message : 'Unknown error'
            );
        }
    }

    /**
     * Generate a single short video with parallel steps
     * Flow: (Voice-over + Assets + Thumbnail in parallel) → Video Assembly → Upload
     */
    private async generateShortWithParallelSteps(
        jobId: string,
        parentVideoId: string,
        shortIndex: number,
        hook: string,
        script: string,
        parentTitle: string,
        shortsProgress: ShortGenerationProgress[],
        totalShorts: number
    ): Promise<ShortVideoResult> {
        const shortVideoId = `${parentVideoId}-short-${shortIndex}`;
        const fullNarration = `${hook}\n\n${script}`;

        console.log(`\n📱 Generating short ${shortIndex + 1}/${totalShorts} with parallel steps...`);

        const calculateOverallProgress = (stepProgress: number): number => {
            const shortPortionStart = 70 + (shortIndex / totalShorts) * 25;
            const shortPortionSize = 25 / totalShorts;
            return Math.floor(shortPortionStart + (stepProgress / 100) * shortPortionSize);
        };

        const updateShortProgress = async (
            step: 'voiceOverStep' | 'assetsStep' | 'assemblyStep' | 'uploadStep',
            stepProgress: ShortStepProgress,
            message: string
        ) => {
            shortsProgress[shortIndex][step] = stepProgress;
            const overallProgress = calculateOverallProgress(
                this.calculateShortStepCompletion(shortsProgress[shortIndex])
            );
            await this.redisService.updateJobProgress(
                jobId, 'shorts_generating', overallProgress, message,
                { shortsProgress }
            );
        };

        // Create output directory
        const shortOutputDir = path.join(config.worker.workDir, shortVideoId);
        await fs.mkdir(shortOutputDir, { recursive: true });

        // ============ Parallel: Voice-over + Assets ============
        // (Thumbnail for shorts is optional, we use uploadStep for upload progress)

        await updateShortProgress('voiceOverStep', {
            status: 'running',
            progress: 10,
            message: 'Starting parallel: Voice-over + Assets...',
        }, `Short ${shortIndex + 1}: Starting voice-over + assets in parallel...`);

        await updateShortProgress('assetsStep', {
            status: 'running',
            progress: 10,
            message: 'Starting parallel: Voice-over + Assets...',
        }, `Short ${shortIndex + 1}: Starting voice-over + assets in parallel...`);

        let voiceOverPath: string | null = null;
        let clipResult: Awaited<ReturnType<typeof downloadClipsForVideo>> | null = null;

        const audioOutputPath = path.join(shortOutputDir, 'narration.wav');

        const [voiceOverResult, assetsResult] = await Promise.allSettled([
            // Voice-over
            (async () => {
                const path_ = await this.ttsService.generateNarrationAudio(
                    fullNarration,
                    audioOutputPath,
                    { voice: 'Puck' }
                );
                return path_;
            })(),

            // Assets - wait for voice-over file to be created for accurate timing
            (async () => {
                const result = await downloadClipsForVideo(shortVideoId, fullNarration, audioOutputPath);
                return result;
            })(),
        ]);

        // Process voice-over result
        if (voiceOverResult.status === 'fulfilled') {
            voiceOverPath = voiceOverResult.value;
            await updateShortProgress('voiceOverStep', {
                status: 'completed',
                progress: 100,
                message: 'Voice-over ready!',
            }, `Short ${shortIndex + 1}: Voice-over complete`);
        } else {
            await updateShortProgress('voiceOverStep', {
                status: 'error',
                progress: 0,
                message: 'Voice-over failed',
            }, `Short ${shortIndex + 1}: Voice-over failed`);
            throw new Error(`Short voice-over failed: ${voiceOverResult.reason}`);
        }

        // Process assets result
        if (assetsResult.status === 'fulfilled') {
            clipResult = assetsResult.value;
            await updateShortProgress('assetsStep', {
                status: 'completed',
                progress: 100,
                message: `${clipResult.clipPaths.length} clips ready!`,
            }, `Short ${shortIndex + 1}: ${clipResult.clipPaths.length} clips downloaded`);
        } else {
            await updateShortProgress('assetsStep', {
                status: 'error',
                progress: 0,
                message: 'Assets failed',
            }, `Short ${shortIndex + 1}: Assets failed`);
            throw new Error(`Short assets failed: ${assetsResult.reason}`);
        }

        // ============ Video Assembly (after voice-over + assets complete) ============
        await updateShortProgress('assemblyStep', {
            status: 'running',
            progress: 10,
            message: 'Assembling video...',
        }, `Short ${shortIndex + 1}: Assembling video...`);

        let music: string = '';
        try {
            music = pickBackgroundTrack();
        } catch (error) {
            console.warn('⚠️ No background music for short');
        }

        const branding = getBrandingAssets();

        const assembledShort = await this.assemblyService.assembleVideo({
            videoId: shortVideoId,
            clips: clipResult.clipPaths,
            clipTimings: clipResult.clipTimings,
            narration: fullNarration,
            narrationAudio: voiceOverPath,
            music,
            branding,
            isShort: true,
        });

        await updateShortProgress('assemblyStep', {
            status: 'completed',
            progress: 100,
            message: `Video ready! ${assembledShort.duration.toFixed(0)}s`,
        }, `Short ${shortIndex + 1}: Video assembled (${assembledShort.duration.toFixed(0)}s)`);

        // ============ Upload to Cloudinary ============
        await updateShortProgress('uploadStep', {
            status: 'running',
            progress: 10,
            message: 'Uploading to cloud...',
        }, `Short ${shortIndex + 1}: Uploading...`);

        const shortVideoPath = path.join(config.worker.workDir, assembledShort.outputPath);
        const uploadResult = await this.cloudinaryService.uploadVideo(
            shortVideoPath,
            `${jobId}/shorts`,
            `short-${shortIndex}`
        );

        await updateShortProgress('uploadStep', {
            status: 'completed',
            progress: 100,
            message: 'Uploaded!',
        }, `Short ${shortIndex + 1}: Upload complete`);

        return {
            shortIndex,
            shortVideoId,
            videoUrl: uploadResult.secureUrl,
            duration: assembledShort.duration,
        };
    }

    /**
     */
    private calculateShortStepCompletion(shortProgress: ShortGenerationProgress): number {
        const steps = [
            shortProgress.voiceOverStep,
            shortProgress.assetsStep,
            shortProgress.assemblyStep,
            shortProgress.uploadStep,
        ];

        let completion = 0;
        for (const step of steps) {
            if (step.status === 'completed') {
                completion += 25;
            } else if (step.status === 'running') {
                completion += (step.progress / 100) * 25;
            }
        }

        return completion;
    }

    /**
     * Cleanup local files after processing
     */
    private async cleanupLocalFiles(videoId: string): Promise<void> {
        try {
            const videoDir = path.join(config.worker.workDir, videoId);
            await fs.rm(videoDir, { recursive: true, force: true });

            const tmpDir = path.join(config.worker.tmpDir, 'footage', videoId);
            await fs.rm(tmpDir, { recursive: true, force: true });

            console.log(`🧹 Cleaned up local files for ${videoId}`);
        } catch (error) {
            console.warn(`⚠️ Cleanup warning:`, error);
        }
    }
}

export default JobProcessor;
