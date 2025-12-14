import { NextRequest, NextResponse } from "next/server";
import GeminiTTSService from "@/lib/audio/gemini-tts-service";
import path from "path";
import fs from "fs/promises";

export interface ShortVoiceOverRequest {
    videoId: string;
    shortIndex: number;
    hook: string;
    script: string;
}

export interface ShortVoiceOverResult {
    shortVideoId: string;
    voiceOverPath: string;
    fullNarration: string;
}

export async function POST(request: NextRequest) {
    try {
        const body: ShortVoiceOverRequest = await request.json();
        const { videoId, shortIndex, hook, script } = body;

        if (!videoId || shortIndex === undefined || !hook || !script) {
            return NextResponse.json(
                { error: "Missing required fields: videoId, shortIndex, hook, script" },
                { status: 400 }
            );
        }

        const shortVideoId = `${videoId}-short-${shortIndex}`;
        console.log(`\n🎙️ Generating voice-over for short #${shortIndex + 1}...`);

        // Create output directory for this short
        const shortOutputDir = path.join(process.cwd(), 'videos', shortVideoId);
        await fs.mkdir(shortOutputDir, { recursive: true });

        // Full narration for the short (hook + script)
        const fullNarration = `${hook}\n\n${script}`;
        const audioOutputPath = path.join(shortOutputDir, 'narration.wav');

        // Generate voice-over
        const ttsService = new GeminiTTSService();
        const voiceOverPath = await ttsService.generateNarrationAudio(
            fullNarration,
            audioOutputPath,
            { voice: "Puck" }
        );

        const relativePath = path.relative(path.join(process.cwd(), 'videos'), voiceOverPath);
        console.log(`✅ Voice-over generated for short #${shortIndex + 1}: ${relativePath}`);

        const result: ShortVoiceOverResult = {
            shortVideoId,
            voiceOverPath: relativePath,
            fullNarration,
        };

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error("❌ Error generating short voice-over:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate voice-over" },
            { status: 500 }
        );
    }
}

export const maxDuration = 120;
