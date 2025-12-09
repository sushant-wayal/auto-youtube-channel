import { NextRequest, NextResponse } from "next/server";
import GeminiTTSService from "@/lib/audio/gemini-tts-service";
import path from "path";
import fs from "fs/promises";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { videoId, narration } = body;

        if (!videoId || !narration) {
            return NextResponse.json(
                { error: "Missing required fields: videoId and narration" },
                { status: 400 }
            );
        }

        console.log("\n🎙️ === VOICE-OVER GENERATION STARTED ===");
        console.log(`Video ID: ${videoId}`);
        console.log(`Narration length: ${narration.length} characters`);

        // Create output directory
        const audioOutputDir = path.join(process.cwd(), 'videos', videoId);
        await fs.mkdir(audioOutputDir, { recursive: true });
        
        const audioOutputPath = path.join(audioOutputDir, 'narration.wav');
        
        // Generate voice-over with Gemini TTS
        const ttsService = new GeminiTTSService();
        const voiceOverPath = await ttsService.generateNarrationAudio(
            narration,
            audioOutputPath,
            { voice: "Puck" } // Friendly, warm voice
        );

        console.log(`✅ Voice-over generated successfully: ${voiceOverPath}`);
        console.log("✅ === VOICE-OVER GENERATION COMPLETE ===\n");

        // Return relative path from videos/ directory
        const relativePath = path.relative(path.join(process.cwd(), 'videos'), voiceOverPath);

        return NextResponse.json({
            success: true,
            voiceOverPath: relativePath,
            videoId,
        });
    } catch (error) {
        console.error("❌ Error in generate-voiceover API:", error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to generate voice-over",
            },
            { status: 500 }
        );
    }
}

export const maxDuration = 300; // 5 minutes timeout for voice-over generation
