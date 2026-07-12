import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
// @ts-ignore
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

export class StreamingService {
    private ffmpegPath: string;

    constructor() {
        this.ffmpegPath = ffmpegInstaller.path;
    }

    /**
     * Streams an MP4 file to an RTMP endpoint
     * @param videoPath Path to the MP4 file
     * @param rtmpUrl The RTMP ingestion URL
     * @param streamKey The stream name/key
     */
    async streamVideo(videoPath: string, rtmpUrl: string, streamKey: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const endpoint = `${rtmpUrl}/${streamKey}`;
            console.log(`[StreamingService] Starting FFmpeg to stream to ${rtmpUrl}...`);

            // -re : Read input at native frame rate
            // -i : Input file
            // -c:v copy : Copy video codec (no re-encoding if already h264)
            // -c:a copy : Copy audio codec (no re-encoding if already aac)
            // -f flv : Flash Video format for RTMP
            const args = [
                "-re",
                "-i", videoPath,
                "-c:v", "copy",
                "-c:a", "copy",
                "-f", "flv",
                endpoint
            ];

            const ffmpeg = spawn(this.ffmpegPath, args);

            ffmpeg.stderr.on("data", (data) => {
                // FFmpeg writes everything to stderr, it's mostly progress info
                // Uncomment the line below for verbose ffmpeg logging
                // console.log(`[FFmpeg] ${data}`);
            });

            ffmpeg.on("close", (code) => {
                if (code === 0) {
                    console.log(`[StreamingService] Streaming finished successfully.`);
                    resolve();
                } else {
                    console.error(`[StreamingService] FFmpeg exited with code ${code}`);
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on("error", (err) => {
                console.error(`[StreamingService] Failed to start FFmpeg:`, err);
                reject(err);
            });
        });
    }

    /**
     * Streams multiple scene segment URLs to RTMP as a single uninterrupted broadcast.
     * Uses FFmpeg's concat demuxer so there is NO gap between segments.
     *
     * ⚠️ LIVE STREAMING ONLY — segments must be pre-encoded H.264/AAC MP4 files.
     * @param segmentUrls Ordered array of Cloudinary (or any HTTP) MP4 URLs
     * @param rtmpUrl The RTMP ingestion address (e.g. rtmp://a.rtmp.youtube.com/live2)
     * @param streamKey The YouTube stream name/key
     */
    async streamSegments(segmentUrls: string[], rtmpUrl: string, streamKey: string): Promise<void> {
        if (segmentUrls.length === 0) throw new Error("[StreamingService] No segment URLs provided.");

        // Write an FFmpeg concat list to a temp file
        const concatFile = path.join(os.tmpdir(), `live-concat-${Date.now()}.txt`);
        const concatContent = segmentUrls.map(u => `file '${u}'`).join("\n");
        fs.writeFileSync(concatFile, concatContent);

        const endpoint = `${rtmpUrl}/${streamKey}`;
        console.log(`[StreamingService] Streaming ${segmentUrls.length} segments to ${rtmpUrl}...`);
        console.log(`[StreamingService] Concat list:\n${concatContent}`);

        const args = [
            "-re",
            "-f", "concat",
            "-safe", "0",          // allow http(s) URLs in concat list
            "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
            "-i", concatFile,
            "-c:v", "copy",
            "-c:a", "copy",
            "-f", "flv",
            endpoint,
        ];

        return new Promise((resolve, reject) => {
            const ffmpeg = spawn(this.ffmpegPath, args);

            ffmpeg.stderr.on("data", (_data) => {
                // Uncomment for verbose FFmpeg logs:
                // console.log(`[FFmpeg] ${_data}`);
            });

            ffmpeg.on("close", (code) => {
                fs.rmSync(concatFile, { force: true });
                if (code === 0) {
                    console.log(`[StreamingService] All segments streamed successfully.`);
                    resolve();
                } else {
                    console.error(`[StreamingService] FFmpeg exited with code ${code}`);
                    reject(new Error(`FFmpeg exited with code ${code}`));
                }
            });

            ffmpeg.on("error", (err) => {
                fs.rmSync(concatFile, { force: true });
                console.error(`[StreamingService] Failed to start FFmpeg:`, err);
                reject(err);
            });
        });
    }
}

