import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import Redis from "ioredis";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>OAuth Error</title></head>
        <body style="font-family: -apple-system, sans-serif; background: #09090b; color: #fff; padding: 24px; text-align: center;">
          <h2 style="color: #ef4444;">Authorization Canceled or Failed</h2>
          <p style="color: #a1a1aa;">${error}</p>
        </body>
      </html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YT_CLIENT_ID!,
      process.env.YT_CLIENT_SECRET!,
      process.env.YT_REDIRECT_URI!
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let channelTitle = "YouTube Channel";
    let channelHandle = "";
    let avatarUrl = "";

    try {
      const youtube = google.youtube({ version: "v3", auth: oauth2Client });
      const channelRes = await youtube.channels.list({
        part: ["snippet"],
        mine: true,
      });

      const channel = channelRes.data.items?.[0];
      if (channel) {
        channelTitle = channel.snippet?.title || channelTitle;
        channelHandle = channel.snippet?.customUrl || "";
        avatarUrl = channel.snippet?.thumbnails?.default?.url || "";
      }
    } catch (e) {
      console.warn("Could not fetch channel details:", e);
    }

    const refreshToken = tokens.refresh_token || "";

    // Save channel metadata to Redis
    if (process.env.REDIS_URL) {
      try {
        const redis = new Redis(process.env.REDIS_URL);
        if (refreshToken) {
          await redis.set("youtube:refresh_token", refreshToken);
        }
        await redis.set(
          "youtube:channel_info",
          JSON.stringify({
            title: channelTitle,
            handle: channelHandle,
            avatarUrl,
            updatedAt: new Date().toISOString(),
            hasRefreshToken: Boolean(refreshToken),
          })
        );
        await redis.quit();
      } catch (redisErr) {
        console.warn("Failed to cache YouTube channel info in Redis:", redisErr);
      }
    }

    // Check if client expects JSON
    if (req.headers.get("accept")?.includes("application/json")) {
      return NextResponse.json({
        success: true,
        channel: { title: channelTitle, handle: channelHandle, avatarUrl },
        refreshToken: refreshToken || undefined,
      });
    }

    // Return friendly HTML for mobile browser
    const html = `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>YouTube Connected</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #09090b;
          color: #f4f4f5;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
        }
        .card {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 16px;
          padding: 28px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #052e16;
          color: #4ade80;
          font-size: 13px;
          font-weight: 600;
          padding: 6px 14px;
          border-radius: 9999px;
          margin-bottom: 20px;
          border: 1px solid #166534;
        }
        .avatar {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          margin: 0 auto 12px;
          border: 2px solid #ef4444;
          object-fit: cover;
        }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
        .handle { color: #a1a1aa; font-size: 14px; margin-bottom: 24px; }
        .token-box {
          background: #09090b;
          border: 1px solid #27272a;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 16px;
          text-align: left;
        }
        .token-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #71717a;
          margin-bottom: 6px;
        }
        .token-value {
          font-family: monospace;
          font-size: 12px;
          word-break: break-all;
          color: #38bdf8;
          max-height: 80px;
          overflow-y: auto;
          user-select: all;
        }
        button {
          width: 100%;
          background: #ef4444;
          color: #fff;
          border: none;
          padding: 13px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 12px;
        }
        button:hover { background: #dc2626; }
        .instructions {
          font-size: 12px;
          color: #71717a;
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">● Channel Connected</div>
        ${avatarUrl ? `<img src="${avatarUrl}" alt="Avatar" class="avatar" />` : ''}
        <h1>${channelTitle}</h1>
        <div class="handle">${channelHandle || 'Connected to Pipeline'}</div>

        ${refreshToken ? `
          <div class="token-box">
            <div class="token-label">Your YT_REFRESH_TOKEN</div>
            <div id="token" class="token-value">${refreshToken}</div>
          </div>
          <button id="copyBtn" onclick="copyToken()">📋 Copy Refresh Token</button>
          <div class="instructions">
            Paste this token into your GitHub repository secrets as <strong>YT_REFRESH_TOKEN</strong>. You can now close this tab.
          </div>
        ` : `
          <div style="background: #27272a; padding: 14px; border-radius: 10px; font-size: 13px; color: #a1a1aa; margin-bottom: 16px;">
            Channel connection refreshed successfully.
          </div>
          <div class="instructions">You can close this tab and return to the app.</div>
        `}
      </div>

      <script>
        function copyToken() {
          const token = document.getElementById('token').innerText;
          navigator.clipboard.writeText(token).then(() => {
            const btn = document.getElementById('copyBtn');
            btn.innerText = '✅ Copied to Clipboard!';
            btn.style.background = '#16a34a';
            setTimeout(() => {
              btn.innerText = '📋 Copy Refresh Token';
              btn.style.background = '#ef4444';
            }, 3000);
          });
        }
      </script>
    </body>
    </html>`;

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 200,
    });
  } catch (error: any) {
    console.error("YouTube OAuth callback error:", error);
    return new Response(
      `<!DOCTYPE html><html><body style="background:#09090b;color:#fff;padding:24px;text-align:center;">
        <h2 style="color:#ef4444;">OAuth Failed</h2>
        <p>${error?.message || "Unknown error"}</p>
      </body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 500 }
    );
  }
}
