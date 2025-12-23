import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing code" },
      { status: 400 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID!,
    process.env.YT_CLIENT_SECRET!,
    process.env.YT_REDIRECT_URI!
  );

  const { tokens } = await oauth2Client.getToken(code);

  console.log("🔑 ACCESS TOKEN:", tokens.access_token);
  console.log("♻️ REFRESH TOKEN:", tokens.refresh_token);

  // ⛔ SAVE refresh_token somewhere SAFE
  // env var / secret manager / password manager

  return NextResponse.json({
    success: true,
    message: "OAuth successful. Check server logs for refresh token.",
  });
}
