import config from "../config";
import { AssetsCollectionResult, ThumbnailResult, VideoGenerationResult, VideoScript } from "../types";
import RedisService from "./redis-service";

class VideoGenerationService {
    videoIdea: string;
    videoId: string;
    redis: RedisService;
    private script?: VideoScript;

    constructor(videoIdea?: string) {
        this.videoIdea = videoIdea ?? "";
        this.videoId = `video-${Date.now()}`;
        this.redis = RedisService.getInstance();
    }

    private async pickIdea(): Promise<string> {
        const idea = await this.redis.client.rpop("video:ideas");
        if (!idea) {
            throw new Error("No more video ideas left");
        }
        return idea;
    }


    private async generateScript(): Promise<VideoScript> {
        if (!this.videoIdea) {
            this.videoIdea = await this.pickIdea();
        }
        const response = await fetch(`${config.website.domain}/api/generate-script`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoIdea: this.videoIdea }),
        });
        const data = await response.json() as { error?: string; script: VideoScript };
        if (!response.ok) throw new Error(data.error || "Failed to generate script");
        this.script = data.script;
        console.log(`📝 Generated script for idea: "${this.videoIdea}"`);
        return this.script;
    }

    private async generateThumbnail(shortIdx: number = -1): Promise<ThumbnailResult> {
        // shortIdx -1 means long form video thumbnail
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        if (shortIdx >= this.script.shorts.length) {
            throw new Error("Invalid short index");
        }

        const videoId = shortIdx < 0 ? this.videoId : this.videoId+`short-${shortIdx}`;
        const title = shortIdx < 0 ? this.script.title : this.script.shorts[shortIdx].hook;
        const description = this.script.description;
        const narration = shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].script;
        const tags = this.script.tags;

        const response = await fetch(`${config.website.domain}/api/generate-thumbnail${shortIdx < 0 ? "" : `/shorts`}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                videoId,
                hook : shortIdx < 0 ? this.script.title : this.script.shorts[shortIdx].hook,
                script: shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].script,
                shortIndex: shortIdx,
                title,
                description,
                narration,
                tags,
                style: "vibrant"
            }),
        });
        const data = await response.json() as { error?: string; thumbnail: ThumbnailResult | {
            shortVideoId: string;
            thumbnail: ThumbnailResult;
        } };
        if (!response.ok) throw new Error(data.error || "Failed to generate thumbnail");
        console.log(`🎨 Generated thumbnail for videoId: "${videoId}"`);
        if (typeof data.thumbnail === "object" && "shortVideoId" in data.thumbnail) return data.thumbnail.thumbnail;
        return data.thumbnail;
    };

    private async generateVoiceOver(shortIdx: number = -1) : Promise<string> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const narration = shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].script;
        const jobId = await this.redis.createJob("voiceover", this.videoId, { narration });

        const result = await this.redis.pollJobProgress(jobId);
        
        return (result as any).voiceOverUrl;
    }

    private async collectAssets(shortIdx: number = -1) : Promise<AssetsCollectionResult> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const title = shortIdx < 0 ? this.script.title : this.script.shorts[shortIdx].hook;
        const narration = shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].script;

        const jobId = await this.redis.createJob("assets", this.videoId, { title, narration });

        const result = await this.redis.pollJobProgress(jobId);
        
        return {
            clipsUrls: (result as any).clipsUrls,
            clipTimings: (result as any).clipTimings,
        };
    }

    private async assembleVideo(shortIdx: number = -1, voiceOverUrl: string, clipsUrls: string[], clipTimings: number[]): Promise<string> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const jobId = await this.redis.createJob("assembly", this.videoId, {
            clips: clipsUrls,
            clipTimings: clipTimings,
            narration: shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].script,
            voiceOverUrl: voiceOverUrl,
            isShort: shortIdx >= 0,
        });

        const result = await this.redis.pollJobProgress(jobId);
        
        return (result as any).outputPath;
    }

    private async uploadToYouTube(shortIdx : number = -1, videoUrl : string, thumbnailUrl: string, privacyStatus: "public" | "unlisted" | "private" = "public"): Promise<string> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const title = shortIdx < 0 ? this.script.title : this.script.shorts[shortIdx].hook;

        const jobId = await this.redis.createJob("youtube-upload", this.videoId, {
            videoUrl,
            title,
            description: this.script.description,
            tags: this.script.tags,
            thumbnailUrl,
            privacyStatus,
        });

        const result = await this.redis.pollJobProgress(jobId);
        
        return (result as any).uploadedVideoId;
    }

    private async generateFullVideoAndUploadGivenScript(shortIdx: number = -1): Promise<string> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        // Generate thumbnail
        const thumbnailResultPromise = this.generateThumbnail(shortIdx);

        // Generate voice over
        const voiceOverUrlPromise = this.generateVoiceOver(shortIdx);

        // Collect assets
        const assetsResultPromise = this.collectAssets(shortIdx);

        const [voiceOverUrl, assetsResult] = await Promise.all([voiceOverUrlPromise, assetsResultPromise]);

        // Assemble video
        const videoPathPromise = this.assembleVideo(shortIdx, voiceOverUrl, assetsResult.clipsUrls, assetsResult.clipTimings);

        const [thumbnailResult, videoPath] = await Promise.all([thumbnailResultPromise, videoPathPromise]);

        // Upload to YouTube
        const uploadedVideoId = await this.uploadToYouTube(shortIdx, videoPath, thumbnailResult.thumbnailPath, "public");

        return `https://youtu.be/${uploadedVideoId}`;
    }

    async generateAllVideosAndUpload(): Promise<string[]> {
        // Stage 1: Generate Script
        await this.generateScript();

        const urls: string[] = [];

        // upload long form video
        console.log(`\n🎬 Starting upload for long-form video: ${this.videoId}`);
        const longFormResult = await this.generateFullVideoAndUploadGivenScript();
        urls.push(longFormResult);
        console.log(`✅ Long-form video uploaded: ${longFormResult}`);

        // upload shorts
        if (this.script) {
            for (let i = 0; i < this.script.shorts.length; i++) {
                console.log(`\n🎬 Starting upload for short video ${i+1}/${this.script.shorts.length}: ${this.videoId}short-${i}`);
                const shortResult = await this.generateFullVideoAndUploadGivenScript(i);
                urls.push(shortResult);
                console.log(`✅ Short video uploaded: ${shortResult}`);
            }
        }

        return urls;
    }

}

export default VideoGenerationService;