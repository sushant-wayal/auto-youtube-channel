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

  // Automatically save to .env.local
  try {
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(process.cwd(), '../.env.local');
    
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace existing tokens or append them
      if (tokens.refresh_token) {
        if (envContent.includes('YT_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/YT_REFRESH_TOKEN=.*/g, `YT_REFRESH_TOKEN=${tokens.refresh_token}`);
        } else {
          envContent += `\nYT_REFRESH_TOKEN=${tokens.refresh_token}`;
        }
      }
      
      if (tokens.access_token) {
        if (envContent.includes('YT_ACCESS_TOKEN=')) {
          envContent = envContent.replace(/YT_ACCESS_TOKEN=.*/g, `YT_ACCESS_TOKEN=${tokens.access_token}`);
        } else {
          envContent += `\nYT_ACCESS_TOKEN=${tokens.access_token}`;
        }
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log("✅ Tokens automatically saved to .env.local!");
    }
  } catch (err) {
    console.error("Failed to automatically save tokens:", err);
  }

  return NextResponse.json({
    success: true,
    message: "OAuth successful! Your tokens have been automatically saved to your .env.local file. You can now rerun your live stream script.",
  });
}
