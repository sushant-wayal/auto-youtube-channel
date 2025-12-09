import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        // Await params in Next.js 15+
        const resolvedParams = await params;
        const videoPath = resolvedParams.path.join("/");
        const filePath = path.join(process.cwd(), "videos", videoPath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error(`Video not found: ${filePath}`);
            return new NextResponse("Video not found", { status: 404 });
        }

        // Read the video file
        const videoBuffer = fs.readFileSync(filePath);

        // Return the video with proper headers
        return new NextResponse(videoBuffer, {
            status: 200,
            headers: {
                "Content-Type": "video/mp4",
                "Content-Length": videoBuffer.length.toString(),
                "Accept-Ranges": "bytes",
            },
        });
    } catch (error) {
        console.error("Error serving video:", error);
        return new NextResponse("Error serving video", { status: 500 });
    }
}
