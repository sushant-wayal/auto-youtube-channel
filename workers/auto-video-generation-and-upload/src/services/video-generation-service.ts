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
        const narration = shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].narration;
        const tags = this.script.tags;

        const response = await fetch(`${config.website.domain}/api/generate-thumbnail${shortIdx < 0 ? "" : `/shorts`}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                videoId,
                hook : shortIdx < 0 ? this.script.title : this.script.shorts[shortIdx].hook,
                script: shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].narration,
                shortIndex: shortIdx,
                title,
                description,
                narration,
                tags,
                style: "minimal"
            }),
        });
        const data = await response.json() as { error?: string; thumbnail: ThumbnailResult} | {
            error?: string;
            result: {
                shortVideoId: string;
                thumbnail: ThumbnailResult;
            }
        };
        if (!response.ok) throw new Error(data.error || "Failed to generate thumbnail");
        console.log(`🎨 Generated thumbnail for videoId: "${videoId}"`);
        if (typeof data === "object" && "thumbnail" in data) return data.thumbnail;
        return data.result.thumbnail;
    };

    private async generateVoiceOver(shortIdx: number = -1) : Promise<string[]> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const perSceneNarration = shortIdx < 0 ? this.script.scenes.map(scene => scene.narration) : [this.script.shorts[shortIdx].narration];
        const jobId = await this.redis.createJob("voiceover", this.videoId, { perSceneNarration });

        const result = await this.redis.pollJobProgress(jobId);
        
        return (result as any).voiceOverUrls;
    }

    private async collectAssets(shortIdx: number = -1) : Promise<AssetsCollectionResult> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const scenes = shortIdx < 0 ? this.script.scenes : [{
            id: this.script.shorts[shortIdx].id,
            baseDuration: this.script.shorts[shortIdx].baseDuration,
            holdDuration: this.script.shorts[shortIdx].holdDuration || 0,
            actions: this.script.shorts[shortIdx].actions
        }];

        const jobId = await this.redis.createJob("assets", this.videoId, { scenes, isShort: shortIdx >= 0 });

        const result = await this.redis.pollJobProgress(jobId);
        
        return {
            clipsUrls: (result as any).clipsUrls,
            clipTimings: (result as any).clipTimings,
        };
    }

    private async assembleVideo(shortIdx: number = -1, voiceOverUrls: string[], clipsUrls: string[], clipTimings: number[]): Promise<string> {
        if (!this.script) {
            throw new Error("Script not generated yet");
        }

        const jobId = await this.redis.createJob("assembly", this.videoId, {
            clips: clipsUrls,
            clipTimings: clipTimings,
            narration: shortIdx < 0 ? this.script.narration : this.script.shorts[shortIdx].narration,
            perSceneNarration: shortIdx >= 0 ? [this.script.shorts[shortIdx].narration] : this.script.scenes.map(scene => scene.narration),
            voiceOverUrls: voiceOverUrls,
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
            isShort: shortIdx >= 0,
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
        let thumbnailResultPromise;
        if (config.thumbnail.enabled) {
            thumbnailResultPromise = this.generateThumbnail(shortIdx);
        } else {
            thumbnailResultPromise = Promise.resolve(null);
        }

        // Generate voice over
        const voiceOverUrlsPromise = this.generateVoiceOver(shortIdx);

        // Collect assets
        const assetsResultPromise = this.collectAssets(shortIdx);

        const [voiceOverUrls, assetsResult] = await Promise.all([voiceOverUrlsPromise, assetsResultPromise]);

        // Assemble video
        const videoPathPromise = this.assembleVideo(shortIdx, voiceOverUrls, assetsResult.clipsUrls, assetsResult.clipTimings);

        const [thumbnailResult, videoPath] = await Promise.all([thumbnailResultPromise, videoPathPromise]);

        // Upload to YouTube
        let uploadedVideoId: string | undefined;
        if (
            config.thumbnail.enabled &&
            thumbnailResult !== null &&
            thumbnailResult !== undefined &&
            typeof thumbnailResult.thumbnailPath === "string"
        ) {
            uploadedVideoId = await this.uploadToYouTube(shortIdx, videoPath, thumbnailResult.thumbnailPath);
            return uploadedVideoId;
        } else {
            uploadedVideoId = await this.uploadToYouTube(shortIdx, videoPath, "", "public");
            return uploadedVideoId;
        }
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