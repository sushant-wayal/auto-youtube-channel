import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Exclude FFmpeg/FFprobe installers from bundling (they contain binaries)
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    '@ffprobe-installer/ffprobe',
  ],

  // Serve static files from videos directory
  async headers() {
    return [
      {
        source: '/videos/:path*',
        headers: [
          {
            key: 'Content-Type',
            value: 'video/mp4',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
