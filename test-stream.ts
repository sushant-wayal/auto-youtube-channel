import { YouTubeLiveService } from "./workers/live-streaming/src/services/youtube-live-service";
import { StreamingService } from "./workers/live-streaming/src/services/streaming-service";
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    try {
        const youtubeLiveService = new YouTubeLiveService();
        const streamingService = new StreamingService();

        const videoUrl = "https://res.cloudinary.com/divc1cuwa/video/upload/v1783833386/video-gen/live-1783831740426/videos/main-video.mp4";
        const title = "The Hidden Trap in Your API Calls";

        console.log(`\n[4/6] 📺 Creating YouTube Live Event...`);
        const broadcastId = await youtubeLiveService.createBroadcast(
            title,
            "A quick test",
            "private"
        );
        
        const streamInfo = await youtubeLiveService.createStream(title);
        await youtubeLiveService.bindBroadcast(broadcastId, streamInfo.streamId);
        console.log(`✅ Live Event ready. Broadcast ID: ${broadcastId}`);

        console.log(`\n[5/6] 🚀 Starting Stream...`);
        await streamingService.streamVideo(videoUrl, streamInfo.ingestionAddress, streamInfo.streamName);
        console.log(`✅ Streaming finished.`);

        console.log(`\n[6/6] 🏁 Completing Broadcast...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        try {
            await youtubeLiveService.transitionState(broadcastId, "complete");
        } catch (err: any) {
            console.log(`⚠️ Auto-stop might have already completed it. (${err.message})`);
        }
        
        console.log(`\n🎉 Live Stream Pipeline Completed Successfully!`);
    } catch(e) {
        console.error(e);
    }
}

run();
