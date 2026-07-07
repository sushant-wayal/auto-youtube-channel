import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the root .env.local if not already loaded
dotenv.config({ path: path.resolve(process.cwd(), '../../.env.local') });

export const liveConfig = {
    defaultDuration: '5m', // e.g., '3m', '5m', '10m'
    streamResolution: '1080p',
    bitrate: '4500k',
    youtubeCategory: '28', // Science & Technology
    privacy: 'private' as 'public' | 'unlisted' | 'private', // testing default
    fps: 30,
};
