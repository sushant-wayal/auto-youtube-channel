import { spawn } from "child_process";
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
}
