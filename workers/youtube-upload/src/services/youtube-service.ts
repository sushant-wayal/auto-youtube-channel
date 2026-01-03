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
    privacyStatus = "public"
  }: { jobId: string } & UploadCommonArgs): Promise<string> {

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

      console.log("Video downloaded, uploading to YouTube...");

      /* 2️⃣ Upload video to YouTube */
      const videoId = await this.uploadVideoToYouTube(videoPath, isShort ?? false, title, description, tags, privacyStatus);

      console.log(`Video uploaded successfully: ${videoId}`);

      /* 3️⃣ Upload thumbnail (optional) */
      if (!isShort && thumbnailUrl && thumbnailPath) {
        console.log("Uploading thumbnail...");

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
      if (thumbnailPath) {
        await this.safeDelete(thumbnailPath);
      }
    }
  }

  /* -------------------- HELPERS -------------------- */

  private async uploadVideoToYouTube(
    videoPath: string,
    isShort: boolean,
    title: string,
    description: string,
    tags: string[],
    privacyStatus: string
  ): Promise<string> {
    const snippet: any = {
      title,
      description,
      tags,
      categoryId: "22", // People & Blogs
    };

    // Add #Shorts tag for YouTube Shorts
    if (isShort) {
      snippet.tags = [...(tags || []), "Shorts"];
      if (!description.includes("#Shorts")) {
        snippet.description = `${description}\n\n#Shorts`;
      }
    }

    const response = await this.youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet,
        status: {
          privacyStatus,
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

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
