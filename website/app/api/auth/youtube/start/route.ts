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
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });

  return NextResponse.redirect(authUrl);
}
