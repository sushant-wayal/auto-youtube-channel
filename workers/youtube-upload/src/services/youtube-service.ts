import { google } from "googleapis";
import fs from 'fs';
import path from "path";
import fetch from "node-fetch";
import { pipeline } from "stream/promises";
import config from "../config";
import RedisService from "./redis-service";

type UploadCommonArgs = {
  videoUrl: string;          // Cloudinary video URL
  isShort?: boolean;        // Whether the video is a YouTube Short
  title: string;
  description: string;
  tags?: string[];
  thumbnailUrl?: string;     // Optional Cloudinary thumbnail URL
  privacyStatus?: "public" | "unlisted" | "private";
};

export class YouTubeService {
  private youtube;

  constructor() {
    const oauth2Client = new google.auth.OAuth2(
      config.youtube.clientId,
      config.youtube.clientSecret
    );

    oauth2Client.setCredentials({
      refresh_token: config.youtube.refreshToken,
    });

    this.youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });
  }

  /* -------------------- PUBLIC METHODS -------------------- */

  async upload({
    jobId,
    videoUrl,
    isShort,
    title,
    description,
    tags = [],
    thumbnailUrl,
    privacyStatus = "public"
  }: {jobId : string} & UploadCommonArgs): Promise<string> {
    const redisService = RedisService.getInstance();

    const tmpDir = "/tmp/youtube";
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const videoPath = path.join(tmpDir, `${Date.now()}.mp4`);
    const thumbnailPath = thumbnailUrl
      ? path.join(tmpDir, `${Date.now()}-thumb.jpg`)
      : null;

    try {
      /* 1️⃣ Download video */
      await this.downloadFile(videoUrl, videoPath);
      if (thumbnailUrl && thumbnailPath) {
        await this.downloadFile(thumbnailUrl, thumbnailPath);
      }

      await redisService.updateJobProgress(
        jobId, 
        'processing',
        20, // 20% after download
        "Video downloaded, uploading to YouTube..."
      );

      /* 2️⃣ Upload video */
      const res = await this.youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description,
            tags,
            categoryId: "28", // Science & Technology
          },
          status: {
            privacyStatus,
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(videoPath),
        },
      });

      const videoId = res.data.id;
      if (!videoId) {
        throw new Error("YouTube did not return a videoId");
      }

      // /* 3️⃣ Upload thumbnail (optional) */
      if (!isShort && thumbnailUrl && thumbnailPath) {
        await redisService.updateJobProgress(
          jobId, 
          'processing',
          80, // 80% after upload
          "Video uploaded to YouTube, setting thumbnail..."
        );

        await this.downloadFile(thumbnailUrl, thumbnailPath);

        await this.youtube.thumbnails.set({
          videoId,
          media: {
            body: fs.createReadStream(thumbnailPath),
          },
        });
      }

      return videoId;
    } finally {
      /* 4️⃣ Cleanup local files */
      await this.safeDelete(videoPath);
      if (!isShort && thumbnailPath) {
        await this.safeDelete(thumbnailPath);
      }
    }
  }

  /* -------------------- HELPERS -------------------- */

  private async downloadFile(url: string, outPath: string) {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download file: ${url}`);
    }

    await pipeline(res.body as any, fs.createWriteStream(outPath));
  }

  private async safeDelete(filePath: string) {
    try {
      await fs.promises.unlink(filePath);
    } catch {
      // ignore
    }
  }
}
