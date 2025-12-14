import { NextRequest, NextResponse } from "next/server";
import ThumbnailService from "@/lib/ai/thumbnail-service";
import path from "path";
import fs from "fs/promises";

export interface ShortThumbnailRequest {
    videoId: string;
    shortIndex: number;
    hook: string;
    script: string;
}

export interface ShortThumbnailResult {
    shortVideoId: string;
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
        const body: ShortThumbnailRequest = await request.json();
        const { videoId, shortIndex, hook, script } = body;

        if (!videoId || shortIndex === undefined || !hook || !script) {
            return NextResponse.json(
                { error: "Missing required fields: videoId, shortIndex, hook, script" },
                { status: 400 }
            );
        }

        const shortVideoId = `${videoId}-short-${shortIndex}`;
        console.log(`\n🖼️ Generating thumbnail for short #${shortIndex + 1}...`);

        // Create output directory for this short
        const shortOutputDir = path.join(process.cwd(), 'videos', shortVideoId);
        await fs.mkdir(shortOutputDir, { recursive: true });

        // Full narration for the short
        const fullNarration = `${hook}\n\n${script}`;

        // Generate thumbnail using individual arguments
        const thumbnailService = new ThumbnailService();
        const thumbnail = await thumbnailService.generateThumbnail(
            shortVideoId,
            hook,
            script,
            fullNarration,
            ['shorts', 'viral'],
            { style: 'vibrant' }
        );

        console.log(`✅ Thumbnail generated for short #${shortIndex + 1}`);

        const result: ShortThumbnailResult = {
            shortVideoId,
            thumbnail,
        };

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error("❌ Error generating short thumbnail:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate thumbnail" },
            { status: 500 }
        );
    }
}

export const maxDuration = 120;
