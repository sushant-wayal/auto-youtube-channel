# Video Generation Worker

A standalone worker that processes video generation jobs from a Redis queue. It handles the complete video generation pipeline including script generation, voice-over, asset downloading, video assembly, and shorts creation.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│     Redis       │◀────│     Worker      │
│  (Job Creator)  │     │  (Job Queue)    │     │  (Job Processor)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │   Cloudinary    │
                                                │ (File Storage)  │
                                                └─────────────────┘
```

## Features

- **Script Generation**: Uses Gemini AI to generate video scripts with title, description, tags, narration, and shorts
- **Voice-over Generation**: Uses Gemini TTS to generate high-quality narration audio
- **Asset Downloading**: Downloads stock footage from Pexels based on AI-extracted keywords
- **Video Assembly**: Uses FFmpeg to assemble clips with narration, background music, and branding
- **Shorts Generation**: Automatically creates vertical 9:16 format short videos
- **Cloud Storage**: Uploads all final videos to Cloudinary
- **Progress Updates**: Real-time progress updates via Redis pub/sub

## Prerequisites

- Node.js 18+
- FFmpeg installed on the system
- Redis instance
- Cloudinary account
- API keys for Gemini and Pexels

## Environment Variables

The worker reads from the parent project's `.env.local` file:

```env
GEMINI_API_KEY=your_gemini_api_key
PEXELS_API_KEY=your_pexels_api_key
REDIS_URL=redis://user:password@host:port
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Installation

```bash
cd worker
npm install
```

## Running the Worker

### Development mode (with hot reload)
```bash
npm run dev
```

### Production mode
```bash
npm run build
npm start
```

## Job Flow

1. **Client creates job**: POST to `/api/jobs/create` with `{ videoIdea: "..." }`
2. **Job queued**: Job is stored in Redis and added to the queue
3. **Worker picks up job**: Worker polls Redis and picks up pending jobs
4. **Processing stages**:
   - `script_generating` (0-15%)
   - `voiceover_generating` (15-30%)
   - `assets_generating` (30-50%)
   - `video_assembling` (50-65%)
   - `shorts_generating` (65-95%)
   - `uploading` (95-100%)
   - `completed` or `failed`
5. **Progress updates**: Worker updates job status in Redis
6. **Client polls status**: GET `/api/jobs/[jobId]` to check progress

## Job Data Structure

```typescript
interface VideoGenerationJob {
    jobId: string;
    videoIdea: string;
    createdAt: number;
    updatedAt: number;
    status: JobStatus;
    progress: number; // 0-100
    message: string;
    
    // Results (populated as job progresses)
    script?: VideoScript;
    voiceOverUrl?: string;
    mainVideoUrl?: string;
    shortsVideos?: ShortVideoResult[];
    
    error?: string;
}
```

## File Structure

```
worker/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── index.ts          # Configuration loading
│   ├── jobs/
│   │   └── job-processor.ts  # Main job processing logic
│   ├── services/
│   │   ├── redis-service.ts  # Redis queue management
│   │   └── cloudinary-service.ts  # File upload service
│   └── types/
│       └── index.ts          # TypeScript types
├── package.json
├── tsconfig.json
└── README.md
```

## Using with the Next.js App

The worker reuses services from the main `lib/` folder:
- `lib/pipeline/script-generation.ts` - Script generation
- `lib/audio/gemini-tts-service.ts` - Voice-over generation
- `lib/video/video-assembly.ts` - Video assembly with FFmpeg
- `lib/assets/clip-downloader.ts` - Stock footage downloading
- `lib/assets/music-branding.ts` - Background music and branding

## API Endpoints (Next.js)

### Create Job
```
POST /api/jobs/create
Body: { "videoIdea": "Your video idea here" }
Response: { "success": true, "jobId": "job-xxx-xxx" }
```

### Get Job Status
```
GET /api/jobs/[jobId]
Response: { "success": true, "job": { ... } }
```

## Scaling

The worker can be scaled horizontally by running multiple instances. Each instance will pick up different jobs from the queue (Redis handles the distribution).

```bash
# Run multiple workers
npm start &
npm start &
npm start &
```
