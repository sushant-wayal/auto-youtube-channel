import { NextRequest, NextResponse } from "next/server";
import VideoGenerationPipeline from "@/lib/pipeline";
import path from "path";
import fs from "fs/promises";

export interface ShortAssetsRequest {
    videoId: string;
    shortIndex: number;
    hook: string;
    script: string;
    parentTitle: string;
}

export interface ShortAssetsResult {
    shortVideoId: string;
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
}

export async function POST(request: NextRequest) {
    try {
        const body: ShortAssetsRequest = await request.json();
        const { videoId, shortIndex, hook, script, parentTitle } = body;

        if (!videoId || shortIndex === undefined || !hook || !script) {
            return NextResponse.json(
                { error: "Missing required fields: videoId, shortIndex, hook, script" },
                { status: 400 }
            );
        }

        const shortVideoId = `${videoId}-short-${shortIndex}`;
        console.log(`\n🎬 Generating assets for short #${shortIndex + 1}...`);

        // Create output directory for this short
        const shortOutputDir = path.join(process.cwd(), 'videos', shortVideoId);
        await fs.mkdir(shortOutputDir, { recursive: true });

        // Full narration for the short (hook + script)
        const fullNarration = `${hook}\n\n${script}`;
        const shortTitle = `${parentTitle} - Short ${shortIndex + 1}: ${hook}`;

        // Generate assets
        const pipeline = new VideoGenerationPipeline();
        const assets = await pipeline.generateAssets(shortVideoId, shortTitle, fullNarration);

        console.log(`✅ Assets generated for short #${shortIndex + 1}: ${assets.clips.length} clips`);

        const result: ShortAssetsResult = {
            shortVideoId,
            assets,
        };

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        console.error("❌ Error generating short assets:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to generate assets" },
            { status: 500 }
        );
    }
}

export const maxDuration = 180;
