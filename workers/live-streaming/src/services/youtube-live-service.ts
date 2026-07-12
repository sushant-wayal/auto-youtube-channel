import { google, youtube_v3 } from "googleapis";

export class YouTubeLiveService {
    private youtube: youtube_v3.Youtube;

    constructor() {
        const oauth2Client = new google.auth.OAuth2(
            process.env.YT_CLIENT_ID,
            process.env.YT_CLIENT_SECRET
        );

        oauth2Client.setCredentials({
            refresh_token: process.env.YT_REFRESH_TOKEN,
        });

        this.youtube = google.youtube({
            version: "v3",
            auth: oauth2Client,
        });
    }

    /**
     * Create a YouTube Live Broadcast
     */
    async createBroadcast(title: string, description: string, privacyStatus: string): Promise<string> {
        console.log(`[YouTubeLiveService] Creating broadcast: ${title}`);
        
        const response = await this.youtube.liveBroadcasts.insert({
            part: ["snippet", "status", "contentDetails"],
            requestBody: {
                snippet: {
                    title,
                    description,
                    scheduledStartTime: new Date().toISOString(), // Start immediately
                },
                status: {
                    privacyStatus,
                    selfDeclaredMadeForKids: false,
                },
                contentDetails: {
                    enableAutoStart: true,
                    enableAutoStop: true,
                    monitorStream: { enableMonitorStream: false },
                },
            },
        });

        const broadcastId = response.data.id;
        if (!broadcastId) throw new Error("Failed to create broadcast. No ID returned.");
        
        console.log(`[YouTubeLiveService] Broadcast created: ${broadcastId}`);
        return broadcastId;
    }

    /**
     * Create a YouTube Live Stream (Ingestion point)
     */
    async createStream(title: string, resolution: string = "1080p", frameRate: string = "30fps"): Promise<{ streamId: string, ingestionAddress: string, streamName: string }> {
        console.log(`[YouTubeLiveService] Creating stream...`);

        const response = await this.youtube.liveStreams.insert({
            part: ["snippet", "cdn", "contentDetails"],
            requestBody: {
                snippet: {
                    title: `${title} - Stream`,
                },
                cdn: {
                    resolution: resolution,
                    frameRate: frameRate,
                    ingestionType: "rtmp",
                },
            },
        });

        const streamId = response.data.id;
        const cdn = response.data.cdn;

        if (!streamId || !cdn || !cdn.ingestionInfo) {
            throw new Error("Failed to create stream or missing ingestion info.");
        }

        console.log(`[YouTubeLiveService] Stream created: ${streamId}`);
        return {
            streamId,
            ingestionAddress: cdn.ingestionInfo.ingestionAddress || "",
            streamName: cdn.ingestionInfo.streamName || "",
        };
    }

    /**
     * Bind Broadcast to Stream
     */
    async bindBroadcast(broadcastId: string, streamId: string): Promise<void> {
        console.log(`[YouTubeLiveService] Binding broadcast ${broadcastId} to stream ${streamId}`);
        await this.youtube.liveBroadcasts.bind({
            id: broadcastId,
            streamId,
            part: ["id", "contentDetails"],
        });
        console.log(`[YouTubeLiveService] Bound successfully.`);
    }

    /**
     * Transition Broadcast State
     */
    async transitionState(broadcastId: string, status: "testing" | "live" | "complete"): Promise<void> {
        console.log(`[YouTubeLiveService] Transitioning broadcast ${broadcastId} to ${status}...`);
        await this.youtube.liveBroadcasts.transition({
            id: broadcastId,
            broadcastStatus: status,
            part: ["id", "status"],
        });
        console.log(`[YouTubeLiveService] Transition successful.`);
    }
}
