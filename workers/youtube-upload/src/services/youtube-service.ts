import { google } from "googleapis";
import fs from 'fs';
import path from "path";
import { pipeline } from "stream/promises";

type UploadCommonArgs = {
  videoUrl: string;          // Cloudinary video URL
  isShort?: boolean;        // Whether the video is a YouTube Short
  title: string;
  description: string;
  tags?: string[];
  thumbnailUrl?: string;     // Optional Cloudinary thumbnail URL
  privacyStatus?: "public" | "unlisted" | "private";
  scheduledPublishTime?: string; // ISO 8601 timestamp for scheduled publishing
};

export class YouTubeService {
  private youtube;

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

  /* -------------------- PUBLIC METHODS -------------------- */

  async upload({
    jobId,
    videoUrl,
    isShort,
    title,
    description,
    tags = [],
    thumbnailUrl,
    privacyStatus = "public",
    scheduledPublishTime
  }: { jobId: string } & UploadCommonArgs): Promise<string> {

    const tmpDir = "/tmp/youtube";
    await fs.promises.mkdir(tmpDir, { recursive: true });

    const videoPath = path.join(tmpDir, `${Date.now()}.mp4`);
    const thumbnailPath = thumbnailUrl
      ? path.join(tmpDir, `${Date.now()}-thumb.jpg`)
      : null;

    try {
      /* 1️⃣ Download video */
      console.error(`📥 Downloading video from Cloudinary...`);
      await this.downloadFile(videoUrl, videoPath);
      console.error(`✅ Video downloaded successfully`);

      if (thumbnailUrl && thumbnailPath) {
        console.error(`📥 Downloading thumbnail from Cloudinary...`);
        await this.downloadFile(thumbnailUrl, thumbnailPath);
        console.error(`✅ Thumbnail downloaded successfully`);
      }

      console.error("🚀 Starting YouTube upload...");

      /* 2️⃣ Upload video to YouTube */
      const videoId = await this.uploadVideoToYouTube(videoPath, isShort ?? false, title, description, tags, privacyStatus, scheduledPublishTime);

      console.error(`✅ Video uploaded successfully! Video ID: ${videoId}`);
      console.error(`🔗 YouTube URL: https://youtube.com/watch?v=${videoId}`);

      /* 3️⃣ Upload thumbnail (optional) */
      if (!isShort && thumbnailUrl && thumbnailPath) {
        console.error("🖼️  Uploading custom thumbnail to YouTube...");

        await this.youtube.thumbnails.set({
          videoId,
          media: {
            body: fs.createReadStream(thumbnailPath),
          },
        });

        console.error(`✅ Thumbnail uploaded successfully`);
      }

      return videoId;
    } finally {
      /* 4️⃣ Cleanup local files */
      console.error(`🧹 Cleaning up temporary files...`);
      await this.safeDelete(videoPath);
      if (thumbnailPath) {
        await this.safeDelete(thumbnailPath);
      }
      console.error(`✅ Cleanup complete`);
    }
  }

  /* -------------------- HELPERS -------------------- */

  private async uploadVideoToYouTube(
    videoPath: string,
    isShort: boolean,
    title: string,
    description: string,
    tags: string[],
    privacyStatus: string,
    scheduledPublishTime?: string
  ): Promise<string> {
    console.error(`📹 Preparing video metadata...`);
    console.error(`   Title: ${title}`);
    console.error(`   Type: ${isShort ? 'YouTube Short' : 'Regular Video'}`);
    console.error(`   Privacy: ${privacyStatus}`);
    if (scheduledPublishTime) {
      console.error(`   Scheduled Publish: ${scheduledPublishTime}`);
    }

    const snippet: any = {
      title,
      description,
      tags,
      categoryId: "28", // Science & Technology
    };

    // Add #Shorts tag for YouTube Shorts
    if (isShort) {
      snippet.tags = [...(tags || []), "Shorts"];
      if (!description.includes("#Shorts")) {
        snippet.description = `${description}\n\n#Shorts`;
      }
    }

    const status: any = {
      privacyStatus,
      selfDeclaredMadeForKids: false,
    };

    // Add publishAt for scheduled videos (requires private status)
    if (scheduledPublishTime && privacyStatus === 'private') {
      status.publishAt = scheduledPublishTime;
    }

    console.error(`📤 Uploading video to YouTube API...`);
    const response = await this.youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet,
        status,
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    console.error(`✅ YouTube API upload completed`);
    return response.data.id!;
  }

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
