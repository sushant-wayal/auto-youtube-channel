import { ScriptGenerationService } from "../../../website/lib/pipeline/exports";
import { renderScenes } from "../../video-scene-renderer/src/index";
import { assembleVideo } from "../../video-assembler/src/index";
import { generateVoiceOvers } from "../../voice-over-generation/src/index";
import { YouTubeLiveService } from "./services/youtube-live-service";
import { StreamingService } from "./services/streaming-service";
import { liveConfig } from "./config";
import { config as sharedConfig } from "../../../shared/config";

export class LivePipeline {
    private scriptService: ScriptGenerationService;
    private youtubeLiveService: YouTubeLiveService;
    private streamingService: StreamingService;

    constructor() {
        this.scriptService = new ScriptGenerationService();
        this.youtubeLiveService = new YouTubeLiveService();
        this.streamingService = new StreamingService();
    }

    /**
     * Main orchestrator for Live Streaming Pipeline V1
     */
    async execute(idea: string, durationMinutes: number): Promise<void> {
        try {
            console.log(`\n=============================================`);
            console.log(`🔴 STARTING LIVE STREAM PIPELINE (V1)`);
            console.log(`=============================================`);
            console.log(`Idea: "${idea}" | Duration: ${durationMinutes} mins`);
            
            const videoId = `live-${Date.now()}`;

            // Stage 1: Generate Script
            console.log(`\n[1/6] ✍️ Generating Script...`);
            const script = await this.scriptService.generateScript(idea, durationMinutes, "code");
            console.log(`✅ Script generated: "${script.title}" with ${script.scenes.length} scenes.`);

            // Stage 2: Render Scenes
            console.log(`\n[2/6] 🎨 Rendering Scenes...`);
            const renderResult = await renderScenes({
                scenes: script.scenes,
                videoId,
                isShort: false,
            });
            console.log(`✅ Rendered ${renderResult.urls.length} scenes.`);

            // Stage 2.5: Generate Voiceovers
            console.log(`\n[2.5/6] 🎤 Generating Voiceovers...`);
            const voiceoverResult = await generateVoiceOvers({
                perSceneNarration: script.scenes.map((s: any) => s.narration),
                videoId,
            });
            console.log(`✅ Generated ${voiceoverResult.urls.length} voiceover audios.`);

            // Stage 3: Assemble MP4
            // In V2, we will skip full assembly and start streaming a queue of scenes.
            // For V1, we assemble the MP4 first.
            console.log(`\n[3/6] 🧩 Assembling Video...`);
            const assembled = await assembleVideo({
                jobId: videoId,
                videoId,
                narration: script.narration,
                perSceneNarration: script.scenes.map((s: any) => s.narration),
                narrationAudios: voiceoverResult.urls, // Use generated TTS audios
                clips: renderResult.urls,
                clipTimings: renderResult.timings,
                animationStopTimes: renderResult.animationStopTimes,
                isShort: false,
                voiceoverProvider: sharedConfig.voiceover.provider,
            });
            console.log(`✅ Video assembled successfully: ${assembled.outputUrl}`);
            
            // Note: assembled.outputUrl might be a Cloudinary URL or local path depending on config.
            // But since V2 streams from local generation, let's download it if it's remote, or if it's already local, we can stream it.
            // assembleVideo currently uploads to Cloudinary and returns a secureUrl. We should stream from the secureUrl or a local temp file.
            // FFmpeg can read directly from an http(s) URL!

            // Stage 4: Create Live Event
            console.log(`\n[4/6] 📺 Creating YouTube Live Event...`);
            const broadcastId = await this.youtubeLiveService.createBroadcast(
                script.title,
                script.description,
                liveConfig.privacy
            );
            
            const streamInfo = await this.youtubeLiveService.createStream(script.title);
            await this.youtubeLiveService.bindBroadcast(broadcastId, streamInfo.streamId);
            
            // Since enableAutoStart is true, it might transition itself when we start sending data.
            // But to be safe, we can transition it to testing, or wait for stream to become active.
            // According to YouTube API docs, if enableAutoStart=true, it automatically transitions when data is received.
            console.log(`✅ Live Event ready. Broadcast ID: ${broadcastId}`);

            // Stage 5: Stream to YouTube
            console.log(`\n[5/6] 🚀 Starting Stream...`);
            // We can directly stream the Cloudinary MP4 URL using FFmpeg
            await this.streamingService.streamVideo(assembled.outputUrl, streamInfo.ingestionAddress, streamInfo.streamName);
            console.log(`✅ Streaming finished.`);

            // Stage 6: Complete
            console.log(`\n[6/6] 🏁 Completing Broadcast...`);
            // Wait a few seconds to ensure YouTube processes the end of the stream
            await new Promise(resolve => setTimeout(resolve, 10000));
            // enableAutoStop is true, but we explicitly transition to complete just in case
            try {
                await this.youtubeLiveService.transitionState(broadcastId, "complete");
            } catch (err: any) {
                console.log(`⚠️ Auto-stop might have already completed it. (${err.message})`);
            }
            
            console.log(`\n🎉 Live Stream Pipeline Completed Successfully!`);

        } catch (error) {
            console.error(`\n❌ Pipeline Error:`, error);
            throw error;
        }
    }
}
