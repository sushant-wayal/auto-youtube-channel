import ScriptGenerationService from "./script-generation";
import { VideoScript, GenerationProgress, VideoGenerationResult, VideoAssets } from "./types";
import TTSService from "@/lib/audio/tts-service";
import path from "path";
import { SeriesContext } from "./series-context";

class VideoGenerationPipeline {
    private scriptService: ScriptGenerationService;
    private ttsService: TTSService;

    constructor() {
        this.scriptService = new ScriptGenerationService();
        this.ttsService = new TTSService();
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
    async generateScriptOnly(
        videoIdea: string,
        sceneRenderMethod?: "code" | "ai",
        seriesContext?: SeriesContext
    ): Promise<VideoScript> {
        return await this.scriptService.generateScript(videoIdea, 7, sceneRenderMethod, seriesContext);
    }
}

export default VideoGenerationPipeline;
