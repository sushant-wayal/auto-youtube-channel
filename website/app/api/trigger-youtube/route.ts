import Redis from 'ioredis';

export async function GET() {
  const owner = process.env.GITHUB_OWNER || "sushant-wayal";
  const repo = process.env.GITHUB_REPO || "auto-youtube-channel";

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/main.yml/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        ref: "main",
      }),
    }
  );

  if (!response.ok) {
    return Response.json(
      { success: false, status: response.status },
      { status: 500 }
    );
  }

  // Update Redis immediately to show running state in app
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL);
      await redis.set('pipeline:status:overall', 'running', 'EX', 60 * 60 * 24 * 7);
      await redis.hset('pipeline:status:metadata', 'ranAt', new Date().toISOString());
      await redis.quit();
    } catch (e) {
      console.error('[trigger-youtube] Redis update error:', e);
    }
  }

  return Response.json({ success: true });
}