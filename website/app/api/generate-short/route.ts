import { NextRequest, NextResponse } from "next/server";
import VideoGenerationPipeline from "@/lib/pipeline";
import GeminiTTSService from "@/lib/audio/gemini-tts-service";
import path from "path";
import fs from "fs/promises";

export interface ShortGenerationRequest {
    videoId: string;
    shortIndex: number;
    hook: string;
    script: string;
    parentTitle: string;
}

// Phase 1 result - everything except video assembly
export interface ShortPhase1Result {
    videoId: string;
    shortVideoId: string;
    shortIndex: number;
    voiceOverPath: string;
    fullNarration: string;
    assets: {
        videoId: string;
        clips: string[];
        clipTimings?: number[];
        music: string;
        branding: {
            logo?: string;
            intro?: string;
            outro?: string;
        };
    };
    thumbnail: {
        thumbnailPath: string;
        prompt: string;
        videoId: string;
        provider: "gemini" | "huggingface";
        model?: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: ShortGenerationRequest = await request.json();
        const { videoId, shortIndex, hook, script, parentTitle } = body;

        if (!videoId || shortIndex === undefined || !hook || !script) {
            return NextResponse.json(
                { error: "Missing required fields: videoId, shortIndex, hook, script" },
                { status: 400 }
            );
        }

        const shortVideoId = `${videoId}-short-${shortIndex}`;
        console.log(`\n🎬 === GENERATING SHORT #${shortIndex + 1} (Phase 1: Assets) ===`);
        console.log(`Short ID: ${shortVideoId}`);
        console.log(`Hook: ${hook}`);

        // Create output directory for this short
        const shortOutputDir = path.join(process.cwd(), 'videos', shortVideoId);
        await fs.mkdir(shortOutputDir, { recursive: true });

        // Full narration for the short (hook + script)
        const fullNarration = `${hook}\n\n${script}`;
        const shortTitle = `${parentTitle} - Short ${shortIndex + 1}: ${hook}`;

        // Phase 1: Run voice-over, assets, and thumbnail generation IN PARALLEL
        console.log(`\n⚡ Starting parallel generation: Voice-over + Assets + Thumbnail...`);

        const ttsService = new GeminiTTSService();
        const pipeline = new VideoGenerationPipeline();
        const audioOutputPath = path.join(shortOutputDir, 'narration.wav');

        // Start all three tasks in parallel
        const [voiceOverResult, assetsResult, thumbnailResult] = await Promise.all([
            // Voice-over generation
            (async () => {
                console.log(`🎙️ Generating voice-over for short #${shortIndex + 1}...`);
                const voiceOverPath = await ttsService.generateNarrationAudio(
                    fullNarration,
                    audioOutputPath,
                    { voice: "Puck" }
                );
                const relativePath = path.relative(path.join(process.cwd(), 'videos'), voiceOverPath);
                console.log(`✅ Voice-over generated: ${relativePath}`);
                return { voiceOverPath, relativePath };
            })(),

            // Assets generation
            (async () => {
                console.log(`🎬 Generating assets for short #${shortIndex + 1}...`);
                const assets = await pipeline.generateAssets(shortVideoId, shortTitle, fullNarration);
                console.log(`✅ Assets generated: ${assets.clips.length} clips`);
                return assets;
            })(),

            // Thumbnail generation
            (async () => {
                console.log(`🖼️ Generating thumbnail for short #${shortIndex + 1}...`);
                try {
                    const thumbnailResponse = await fetch(new URL('/api/generate-thumbnail', request.url).toString(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            videoId: shortVideoId,
                            title: hook,
                            description: script,
                            narration: fullNarration,
                            tags: ['shorts', 'viral'],
                            style: 'vibrant',
                        }),
                    });

                    if (thumbnailResponse.ok) {
                        const thumbnailData = await thumbnailResponse.json();
                        console.log(`✅ Thumbnail generated`);
                        return thumbnailData.thumbnail;
                    }
                } catch (error) {
                    console.warn(`⚠️ Thumbnail generation failed:`, error);
                }

                // Fallback thumbnail
                console.log(`⚠️ Using fallback thumbnail`);
                return {
                    thumbnailPath: '',
                    prompt: hook,
                    videoId: shortVideoId,
                    provider: 'gemini' as const,
                };
            })(),
        ]);

        console.log(`\n✅ Phase 1 complete! Voice-over, assets, and thumbnail ready.`);
        console.log(`⏳ Video assembly will be triggered separately...\n`);

        const result: ShortPhase1Result = {
            videoId,
            shortVideoId,
            shortIndex,
            voiceOverPath: voiceOverResult.relativePath,
            fullNarration,
            assets: assetsResult,
            thumbnail: thumbnailResult,
        };

        return NextResponse.json({
            success: true,
            phase: 1,
            result,
        });
    } catch (error) {
        console.error("❌ Error generating short (Phase 1):", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to generate short assets",
            },
            { status: 500 }
        );
    }
}

export const maxDuration = 300; // 5 minutes timeout per short
