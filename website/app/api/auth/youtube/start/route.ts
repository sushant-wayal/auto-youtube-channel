import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID!,
    process.env.YT_CLIENT_SECRET!,
    process.env.YT_REDIRECT_URI!
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",        // REQUIRED
    prompt: "consent",             // REQUIRED (forces refresh_token)
    scope: [
      // For uploading videos (existing functionality)
      "https://www.googleapis.com/auth/youtube.upload",

      // For idea-selector: read channel videos and playlists
      "https://www.googleapis.com/auth/youtube.readonly",

      // For idea-selector: read video analytics (views, CTR, retention)
      "https://www.googleapis.com/auth/yt-analytics.readonly",

      // Optional: full YouTube access (includes all above + modifications)
      "https://www.googleapis.com/auth/youtube",

      // For YouTube Live
      "https://www.googleapis.com/auth/youtube.force-ssl",
    ],
  });

  return NextResponse.redirect(authUrl);
}
