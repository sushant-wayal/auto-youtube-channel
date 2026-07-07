import { google } from "googleapis";
import fs from 'fs';
import path from "path";
import { pipeline } from "stream/promises";
import { getShortsPublishTimes } from "../../../../shared/services/shorts-publish-time-service";

/**
 * Calculate the publish time based on configured IST time
 * @param timeIST Time in HH:MM format (IST timezone)
 * @param dayOffset Number of days to offset from today (0 = today, 1 = tomorrow)
 */
function getPublishTimeFromISTTime(timeIST: string, dayOffset: number = 0): string {
  const [hours, minutes] = timeIST.split(':').map(Number);

  const now = new Date();

  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
  const istNow = new Date(now.getTime() + istOffset);

  // Set to specified time in IST
  const targetIST = new Date(istNow);
  targetIST.setHours(hours, minutes, 0, 0);

  // Add day offset
  targetIST.setDate(targetIST.getDate() + dayOffset);

  // Convert back to UTC for YouTube API
  const utcPublishTime = new Date(targetIST.getTime() - istOffset);

  return utcPublishTime.toISOString();
}

type UploadCommonArgs = {
  videoUrl: string;          // Cloudinary video URL
  isShort?: boolean;        // Whether the video is a YouTube Short
  title: string;
  description: string;
  tags?: string[];
  thumbnailUrl?: string;     // Optional Cloudinary thumbnail URL
  privacyStatus?: "public" | "unlisted" | "private";
  scheduledPublishTime?: string; // ISO 8601 timestamp for scheduled publishing
  seriesTitle?: string;
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
    scheduledPublishTime,
    seriesTitle
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

      // For shorts without explicit scheduledPublishTime, fetch from config and set privacy to private
      // NOTE: In production, GitHub Actions scripts (.github/scripts/process-shorts.ts) 
      // provide explicit scheduledPublishTime, so this fallback is rarely used
      let finalScheduledTime = scheduledPublishTime;
      let finalPrivacyStatus = privacyStatus;

      if (isShort && !scheduledPublishTime) {
        const configuredTimes = await getShortsPublishTimes();
        const bestTime = configuredTimes[0]; // Use Rank 1 (best) time as fallback
        finalScheduledTime = getPublishTimeFromISTTime(bestTime, 0);
        finalPrivacyStatus = 'private'; // Required for scheduled publishing
        console.error(`⏰ Using fallback shorts publish time (Rank 1): ${bestTime} IST (${finalScheduledTime})`);
      }

      // Playlist logic
      let finalDescription = description;
      let targetPlaylistId: string | null = null;
      if (seriesTitle) {
        console.error(`📺 Series detected: ${seriesTitle}. Managing playlist...`);
        try {
          targetPlaylistId = await this.getOrCreatePlaylist(seriesTitle, finalPrivacyStatus);
          if (targetPlaylistId) {
            finalDescription += `\n\n📺 Watch the full ${seriesTitle} series here: https://www.youtube.com/playlist?list=${targetPlaylistId}`;
          }
        } catch (err) {
          console.error(`⚠️ Failed to setup playlist:`, err);
        }
      }

      console.error("🚀 Starting YouTube upload...");

      /* 2️⃣ Upload video to YouTube */
      const videoId = await this.uploadVideoToYouTube(
        videoPath,
        isShort ?? false,
        title,
        finalDescription,
        tags,
        finalPrivacyStatus,
        finalScheduledTime
      );

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

      /* 4️⃣ Add to Playlist (if applicable) */
      if (targetPlaylistId) {
        try {
          console.error(`📺 Adding video to playlist...`);
          await this.addToPlaylist(videoId, targetPlaylistId);
          console.error(`✅ Video added to playlist successfully`);
        } catch (err) {
          console.error(`⚠️ Failed to add video to playlist:`, err);
        }
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

  private async getOrCreatePlaylist(seriesTitle: string, privacyStatus: string): Promise<string | null> {
    try {
      // Search for existing playlist
      const response = await this.youtube.playlists.list({
        part: ["snippet"],
        mine: true,
        maxResults: 50,
      });

      const existingPlaylist = response.data.items?.find(
        (p) => p.snippet?.title === seriesTitle
      );

      if (existingPlaylist?.id) {
        console.error(`✅ Found existing playlist: ${existingPlaylist.id}`);
        return existingPlaylist.id;
      }

      // Create new playlist
      console.error(`🆕 Creating new playlist for series: ${seriesTitle}`);
      const createResponse = await this.youtube.playlists.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: seriesTitle,
            description: `All episodes for the series: ${seriesTitle}`,
          },
          status: {
            privacyStatus: privacyStatus === 'private' ? 'private' : 'public',
          },
        },
      });

      if (createResponse.data.id) {
        console.error(`✅ Created new playlist: ${createResponse.data.id}`);
        return createResponse.data.id;
      }

      return null;
    } catch (error) {
      console.error("Error managing playlist:", error);
      return null;
    }
  }

  private async addToPlaylist(videoId: string, playlistId: string): Promise<void> {
    await this.youtube.playlistItems.insert({
      part: ["snippet"],
      requestBody: {
        snippet: {
          playlistId: playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId: videoId,
          },
        },
      },
    });
  }

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
