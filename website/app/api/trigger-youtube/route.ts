export async function GET() {
  const owner = "sushant-wayal";
  const repo = "auto-youtube-channel";

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

  return Response.json({ success: true });
}