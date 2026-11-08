import { NextResponse } from "next/server";
import Redis from "ioredis";

export async function GET() {
  try {
    // Check environment variables first
    const hasClientId = Boolean(process.env.YT_CLIENT_ID);
    const hasClientSecret = Boolean(process.env.YT_CLIENT_SECRET);
    const hasEnvRefreshToken = Boolean(process.env.YT_REFRESH_TOKEN);

    let channelInfo: any = null;
    let hasRedisRefreshToken = false;

    if (process.env.REDIS_URL) {
      try {
        const redis = new Redis(process.env.REDIS_URL);
        const [infoRaw, redisToken] = await Promise.all([
          redis.get("youtube:channel_info"),
          redis.get("youtube:refresh_token"),
        ]);
        await redis.quit();

        if (infoRaw) {
          try {
            channelInfo = JSON.parse(infoRaw);
          } catch {}
        }
        hasRedisRefreshToken = Boolean(redisToken);
      } catch (redisErr) {
        console.warn("Could not check Redis for YouTube status:", redisErr);
      }
    }

    const connected = hasEnvRefreshToken || hasRedisRefreshToken || Boolean(channelInfo);

    return NextResponse.json({
      ok: true,
      configured: hasClientId && hasClientSecret,
      connected,
      channel: channelInfo || null,
      authUrl: "/api/auth/youtube/start",
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

