import ScriptGenerationService from "./script-generation";
import { VideoScript, GenerationProgress, VideoGenerationResult, VideoAssets } from "./types";
import TTSService from "@/lib/audio/tts-service";
import { downloadClipsForVideo } from "@/lib/assets/clip-downloader";
import { pickBackgroundTrack, getBrandingAssets } from "@/lib/assets/music-branding";
import VideoAssemblyService from "@/lib/video/video-assembly";
import path from "path";

class VideoGenerationPipeline {
    private scriptService: ScriptGenerationService;
    private ttsService: TTSService;
    private assemblyService: VideoAssemblyService;

    constructor() {
        this.scriptService = new ScriptGenerationService();
        this.ttsService = new TTSService();
        this.assemblyService = new VideoAssemblyService();
    }

    /**
     * Main pipeline orchestrator
     * @param videoIdea - The video concept
     * @param onProgress - Callback for progress updates
     */
    async generate(
        videoIdea: string,
        onProgress?: (progress: GenerationProgress) => void
    ): Promise<VideoGenerationResult> {
        const result: VideoGenerationResult = {};

        try {
            // Stage 1: Script Generation
            onProgress?.({
                stage: "script",
                message: "Generating video script with AI...",
                progress: 10,
            });

            const script = await this.scriptService.generateScript(videoIdea, 7);
            result.script = script;

            onProgress?.({
                stage: "script",
                message: "Script generated successfully!",
                progress: 20,
            });

            // Stage 2: Assets Generation (Footage + Music + Branding)
            onProgress?.({
                stage: "assets",
                message: "Downloading stock footage and gathering assets...",
                progress: 30,
            });

            // Generate unique video ID
            const videoId = `video-${Date.now()}`;

            try {
                const assets = await this.generateAssets(videoId, script.title, script.narration);
                result.assets = assets;

                onProgress?.({
                    stage: "assets",
                    message: `Assets ready! Downloaded ${assets.clips.length} clips.`,
                    progress: 50,
                });

                // Stage 3: Video Assembly
                onProgress?.({
                    stage: "assembly",
                    message: "Assembling final video with FFmpeg...",
                    progress: 60,
                });

                try {
                    const video = await this.assemblyService.assembleVideo({
                        videoId: assets.videoId,
                        clips: assets.clips,
                        music: assets.music,
                        branding: assets.branding,
                    });
                    result.video = video;

                    onProgress?.({
                        stage: "assembly",
                        message: `Video assembled! Duration: ${video.duration.toFixed(0)}s`,
                        progress: 80,
                    });
                } catch (error) {
                    console.error("Video assembly error:", error);
                    onProgress?.({
                        stage: "assembly",
                        message: "⚠️ Video assembly failed, check FFmpeg installation...",
                        progress: 80,
                    });
                }
            } catch (error) {
                console.error("Assets generation error:", error);
                onProgress?.({
                    stage: "assets",
                    message: "⚠️ Assets generation failed, continuing without footage...",
                    progress: 50,
                });
            }

            // Skip Stage 4: Audio Generation (paused for now)
            console.log("⏭️  Skipping audio generation step (paused)");

            // TODO: Stage 5: Visual Generation
            // onProgress?.({
            //     stage: "visuals",
            //     message: "Preparing video composition...",
            //     progress: 60,
            // });
            // await this.visualService.generateVisuals(script.scenes);

            // TODO: Stage 6: Video Editing
            // onProgress?.({
            //     stage: "editing",
            //     message: "Editing and compositing video...",
            //     progress: 70,
            // });
            // await this.editingService.composeVideo(script, audio, visuals);

            onProgress?.({
                stage: "complete",
                message: "Video generation complete!",
                progress: 100,
            });

            return result;
        } catch (error) {
            console.error("Pipeline error:", error);
            result.error = error instanceof Error ? error.message : "Unknown error occurred";
            return result;
        }
    }

    /**
     * Generate only the script (for testing or preview)
     */
    async generateScriptOnly(videoIdea: string): Promise<VideoScript> {
        return await this.scriptService.generateScript(videoIdea, 7);
    }

    /**
     * Generate assets for a video (footage, music, branding)
     * @param videoId - Unique identifier for the video
     * @param title - Video title
     * @param narration - Full narration text
     * @returns VideoAssets object with all asset paths
     */
    async generateAssets(
        videoId: string,
        title: string,
        narration: string
    ): Promise<VideoAssets> {
        console.log("\n🎬 === ASSETS GENERATION STARTED ===");
        console.log(`Video ID: ${videoId}`);
        console.log(`Title: ${title}`);

        // Download stock footage clips
        console.log("\n📹 Step 1: Downloading stock footage clips...");
        const clips = await downloadClipsForVideo(videoId, narration);
        console.log(`✅ Downloaded ${clips.length} clips`);

        // Select background music
        console.log("\n🎵 Step 2: Selecting background music...");
        let music: string;
        try {
            music = pickBackgroundTrack();
        } catch (error) {
            console.warn("⚠️  No background music available:", error);
            music = "";
        }

        // Get branding assets
        console.log("\n🎨 Step 3: Gathering branding assets...");
        const branding = getBrandingAssets();

        console.log("\n✅ === ASSETS GENERATION COMPLETE ===");
        console.log(`📊 Summary:`);
        console.log(`  - Clips: ${clips.length}`);
        console.log(`  - Music: ${music ? '✓' : '✗'}`);
        console.log(`  - Branding: ${Object.keys(branding).length} asset(s)`);

        return {
            videoId,
            clips,
            music,
            branding,
        };
    }

    /**
     * Generate audio from script using Hugging Face SpeechT5
     * (Currently paused - not in use)
     */
    async generateAudio(script: VideoScript): Promise<string> {
        try {
            // Generate unique filename
            const timestamp = Date.now();
            const filename = `voiceover-${timestamp}.flac`;
            const outputPath = path.join(process.cwd(), "public", "generated", filename);

            console.log("🎙️ Starting audio generation with Hugging Face SpeechT5...");

            // Generate audio from narration
            await this.ttsService.generateLongFormSpeech(
                script.narration,
                outputPath
            );

            // Return the public URL
            const publicUrl = `/generated/${filename}`;
            console.log("✅ Audio generation complete:", publicUrl);

            return publicUrl;
        } catch (error) {
            console.error("Error in audio generation pipeline:", error);
            throw new Error(`Failed to generate audio: ${error}`);
        }
    }
}

export default VideoGenerationPipeline;
