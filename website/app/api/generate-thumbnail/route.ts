import { NextRequest, NextResponse } from "next/server";
import ThumbnailService from "@/lib/ai/thumbnail-service";
import type { ThumbnailProvider } from "@/lib/ai/thumbnail-service";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { videoId, title, description, narration, tags, style, provider, model } = body;

        // Validate required fields
        if (!videoId || !title || !narration) {
            return NextResponse.json(
                { error: "Missing required fields: videoId, title, and narration are required" },
                { status: 400 }
            );
        }

        console.log(`\n🎨 === THUMBNAIL GENERATION API ===`);
        console.log(`📹 Video ID: ${videoId}`);
        console.log(`📝 Title: ${title}`);
        console.log(`🎯 Style: ${style || "minimal"}`);
        console.log(`🔧 Provider: ${provider || "default (from env)"}`);

        const thumbnailService = new ThumbnailService();

        const result = await thumbnailService.generateThumbnail(
            videoId,
            title,
            description || "",
            narration,
            tags || [],
            {
                style: style || "minimal",
                provider: provider as ThumbnailProvider | undefined,
                model: model,
            }
        );

        console.log(`✅ Thumbnail generated: ${result.thumbnailPath}`);
        console.log(`🔧 Used provider: ${result.provider}`);

        return NextResponse.json({
            success: true,
            thumbnail: result,
        });

    } catch (error: any) {
        console.error("❌ Thumbnail generation error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to generate thumbnail" },
            { status: 500 }
        );
    }
}
