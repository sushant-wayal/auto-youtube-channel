# Workers Architecture

> Core processing workers implemented as pure functions

This document describes the five worker modules that handle video generation pipeline tasks.

---

## Overview

Workers are organized as npm workspace packages under `workers/`. Each worker:

1. Exports **pure functions** (no side effects, stateless)
2. Has its own `package.json` and dependencies
3. Uses shared configuration from `shared/config`
4. Returns structured results for pipeline orchestration

```
workers/
├── idea-selector/           # AI-powered topic idea generation
├── video-scene-renderer/    # Visual scene rendering (Puppeteer)
├── voice-over-generation/   # TTS audio generation (Gemini)
├── video-assembler/         # FFmpeg video assembly
└── youtube-upload/          # YouTube API integration
```

---

## 1. Idea Selector Worker

**Location:** `workers/idea-selector/`

**Purpose:** Autonomously generates video topic ideas using YouTube analytics and AI

### Entry Point

```typescript
// workers/idea-selector/src/index.ts
import { runIdeaSelector, IdeaSelectorResult, TopicIdea } from './index';

const result = await runIdeaSelector({
  existingQueueIdeas?: string[] // Ideas already in queue (avoid duplicates)
});
```

### Output

```typescript
interface IdeaSelectorResult {
  success: boolean;
  selectedTopic?: TopicIdea;
  channelInsights?: string;
  generatedIdeas?: TopicIdea[];
  trendingSignals?: TrendingSignals;
  error?: string;
}

interface TopicIdea {
  topic: string;
  estimatedPerformance: {
    score: number;      // 0-100
    confidence: string; // 'low' | 'medium' | 'high'
  };
  targetFormats: {
    shorts: number;     // Number of shorts to generate (typically 5)
  };
  reasoning: string;
  suggestedAngles: string[];
}
```

### Hybrid Selection Process

1. **Fetch Channel Data** - YouTube API gets recent videos (50)
2. **Fetch Analytics** - Views, watch time, engagement (90 days)
3. **AI Analysis** - Gemini analyzes channel performance
4. **Generate Ideas** - AI generates 15 raw topic ideas
5. **Hard Elimination** - Remove ideas that:
   - Are too similar to recent videos (similarity threshold)
   - Match topics in the existing queue
   - Use disallowed formats or patterns
6. **Formula Ranking** - Score ideas with deterministic formula:
   - Novelty score (not covered recently)
   - Trend alignment (if trending signals available)
   - Estimated engagement
7. **AI Final Selection** - Gemini picks best from top 5 validated ideas

### Key Components

| File | Description |
|------|-------------|
| `src/lib/youtube-data-service.ts` | Fetches videos and analytics via YouTube API |
| `src/lib/gemini-idea-generator.ts` | AI analysis and idea generation |
| `src/lib/hybrid-validator.ts` | Hard elimination rules and formula ranking |
| `src/lib/trend-detector.ts` | Fetches trending signals (optional) |

---

## 2. Video Scene Renderer Worker

**Location:** `workers/video-scene-renderer/`

**Purpose:** Renders scene definitions (ActionIR) into video clips

### Entry Point

```typescript
// workers/video-scene-renderer/src/index.ts
import { renderScenes } from './index';

const result = await renderScenes({
  scenes: SceneIR[],       // Scene definitions with actions
  videoId: string,          // Unique identifier for output path
  isShort?: boolean         // Portrait (1080x1920) vs landscape (1920x1080)
});

// Returns
{
  urls: string[],           // Cloudinary URLs for each scene clip
  timings: number[],        // Duration of each clip in seconds
  animationStopTimes: number[] // When animations finish (for voiceover sync)
}
```

### Rendering Pipeline

1. **Parse Scenes** - Convert `SceneIR[]` to internal representation
2. **Generate HTML** - Create HTML+Canvas for each scene with:
   - CSS animations
   - JavaScript-driven effects
   - Theme-aware styling
3. **Puppeteer Capture** - Launch headless browser and capture frames
4. **FFmpeg Encode** - Convert frames to MP4 video
5. **Upload to Cloudinary** - Store clips with structured folder paths

### Key Components

| File | Description |
|------|-------------|
| `src/lib/actios-to-clips.ts` | `ClipsRenderService` - orchestrates rendering |
| `src/lib/scene-rendring/action-flow-to-html.ts` | Converts ActionIR to HTML+Canvas |
| `src/lib/scene-rendring/htmlToVideoService.ts` | Puppeteer frame capture + FFmpeg |
| `src/lib/scene-rendring/syntax-highlighter.ts` | Code block tokenization and coloring |
| `src/types/index.ts` | Type definitions for SceneIR, ActionIR |

### Video Dimensions

```typescript
// From shared/config
{
  video: {
    long: { width: 1920, height: 1080, fps: 30 },  // Landscape
    short: { width: 1080, height: 1920, fps: 30 }   // Portrait
  }
}
```

---

## 3. Voice-Over Generation Worker

**Location:** `workers/voice-over-generation/`

**Purpose:** Generates TTS audio narration for each scene

### Entry Point

```typescript
// workers/voice-over-generation/src/index.ts
import { generateVoiceOvers } from './index';

const result = await generateVoiceOvers({
  perSceneNarration: string[], // Narration text per scene
  videoId: string,              // Unique identifier
  voice?: string                // Voice preset (default: 'Puck')
});

// Returns
{
  urls: string[]           // Cloudinary URLs for each audio file
}
```

### Available Voices

| Voice | Description |
|-------|-------------|
| `Puck` | Default voice, clear and neutral |
| `Charon` | Deeper, authoritative |
| `Kore` | Female, bright |
| `Fenrir` | Deeper, dramatic |
| `Aoede` | Female, warm |

### TTS Pipeline

1. **Initialize Gemini TTS** - Connect with API key rotation
2. **Generate Per-Scene Audio** - Call `gemini-2.5-flash-preview-tts` for each narration
3. **Handle Long-Form** - Supports 5-10 minute narrations in single requests
4. **Create WAV Files** - 24kHz, 16-bit, mono PCM
5. **Upload to Cloudinary** - Store with structured paths
6. **Cleanup** - Remove temporary files

### Key Components

| File | Description |
|------|-------------|
| `src/lib/ai/gemini-tts-service.ts` | `GeminiTTSService` - TTS generation |
| `src/lib/ai/gemini-client.ts` | Singleton client with API key rotation |

### API Key Rotation

```typescript
// Automatically rotates between keys for rate limiting
GEMINI_API_KEY_1=key1
GEMINI_API_KEY_2=key2

// Service alternates: key1 → key2 → key1 → ...
```

---

## 4. Video Assembler Worker

**Location:** `workers/video-assembler/`

**Purpose:** Combines scene clips, voiceovers, music, and branding into final video

### Entry Point

```typescript
// workers/video-assembler/src/index.ts
import { assembleVideo } from './index';

const result = await assembleVideo({
  videoId: string,
  jobId?: string,            // For Cloudinary folder naming
  clips: string[],           // Scene clip URLs
  voiceovers: string[],      // Voiceover audio URLs
  isShort?: boolean,         // Portrait vs landscape
  music?: MusicConfig,       // Background music (auto-selected if not provided)
  branding?: BrandingAssets, // Intro/outro (auto-loaded if not provided)
});

// Returns
{
  videoId: string,
  outputUrl: string,         // Cloudinary URL of final video
  duration: number,          // Total duration in seconds
  clipCount: number,
  sceneDurations?: number[]  // For YouTube chapter timestamps
}
```

### Assembly Pipeline

1. **Download Assets** - Fetch clips and voiceovers from Cloudinary
2. **Select Music** - Random track from `assets/music/` (if not provided)
3. **Load Branding** - `intro.mp4` and `outro.mp4` from assets
4. **FFmpeg Assembly**:
   - Concatenate scene clips in order
   - Mix voiceover audio (per scene)
   - Add background music with ducking:
     - 15% volume during narration
     - 30% volume during outro
   - Prepend 8-second intro
   - Append 8-second outro
   - Add logo overlay (for shorts)
5. **Track Durations** - Record actual scene lengths for chapters
6. **Upload to Cloudinary** - Final video upload

### Key Components

| File | Description |
|------|-------------|
| `src/lib/video/video-assembly.ts` | `VideoAssemblyService` - main assembly logic |
| `src/lib/video/ffmpeg-utils.ts` | FFmpeg command builders |
| `src/lib/assests/music-branding.ts` | Asset selection utilities |

### Assets Structure

```
workers/video-assembler/src/lib/assests/
├── music/                   # Background tracks (random selection)
│   ├── track1.mp3
│   ├── track2.mp3
│   └── ...
├── logo.png                 # Logo overlay for shorts
├── intro.mp4                # 8-second intro video
└── outro.mp4                # 8-second outro video
```

---

## 5. YouTube Upload Worker

**Location:** `workers/youtube-upload/`

**Purpose:** Uploads videos to YouTube with metadata, thumbnails, and scheduling

### Entry Point

```typescript
// workers/youtube-upload/src/index.ts
import { uploadToYouTube } from './index';

const result = await uploadToYouTube({
  videoUrl: string,          // Cloudinary video URL
  isShort?: boolean,         // Is this a short?
  title: string,             // Video title
  description: string,       // Video description
  tags?: string[],           // Search tags
  thumbnailUrl?: string,     // Thumbnail image URL
  privacyStatus?: 'public' | 'unlisted' | 'private',
  scheduledPublishTime?: string, // ISO 8601 for scheduled publishing

  // Chapter timestamp generation (long-form only)
  sceneTitles?: string[],    // Scene titles from script
  sceneDurations?: number[], // Actual durations from assembly
  hasIntro?: boolean,        // Include intro chapter
  introDuration?: number,    // Intro length (default: 8)
  introTitle?: string,       // Intro chapter title
  hasOutro?: boolean,        // Include outro chapter
  outroDuration?: number,    // Outro length (default: 8)
  outroTitle?: string,       // Outro chapter title
});

// Returns
{
  videoId: string            // YouTube video ID
}
```

### Upload Pipeline

1. **Download Video** - Fetch from Cloudinary URL
2. **Generate Chapters** (long-form only):
   - Calculate timestamp offsets from scene durations
   - Format as YouTube-compatible chapters:
     ```
     0:00 - Intro
     0:08 - Introduction to Topic
     0:46 - First Section
     ...
     7:45 - Outro
     ```
   - Append to description
3. **Upload via YouTube API**:
   - OAuth2 authentication with refresh token
   - Set video metadata (title, description, tags)
   - Category: Science & Technology (28)
4. **Set Thumbnail** - Upload custom thumbnail (if provided)
5. **Schedule** - Set publish time (if privacyStatus is 'private' with scheduledPublishTime)

### Key Components

| File | Description |
|------|-------------|
| `src/services/youtube-service.ts` | `YouTubeService` - YouTube API wrapper |
| `src/utils/timestamp-generator.ts` | Chapter timestamp formatting |

### Scheduling

```typescript
// Long-form: 18:30 IST
scheduledPublishTime: "2024-01-15T13:00:00Z" // 18:30 IST = 13:00 UTC

// Shorts: Ranked times
// Rank 1 (best): 16:30 IST
// Rank 2: 18:00 IST
// Rank 3: 20:00 IST
// Rank 4: 12:00 IST
// Rank 5 (worst): 14:00 IST
```

---

## Worker Dependencies

All workers share these patterns:

### Validation

```typescript
import { validateConfig } from '../../../shared/config';

// At start of each worker function
validateConfig(['cloudinary', 'gemini', 'youtube']);
// Throws if required env vars missing
```

### Cloudinary Service

```typescript
import CloudinaryService from '../../../shared/services/cloudinary-service';

const service = CloudinaryService.getInstance();
await service.uploadVideo(path, folder, filename);
await service.uploadAudio(path, folder, filename);
await service.downloadFile(url, outputPath);
```

### Shared Config

```typescript
import { config } from '../../../shared/config';

config.cloudinary.cloudName
config.gemini.apiKey1
config.video.long.width
```

---

## Testing Workers Locally

```bash
# Install dependencies
npm install

# Build all workers
npm run build

# Test individual worker
cd workers/video-scene-renderer
npx tsx src/index.ts

# Or run via GitHub scripts
npx tsx .github/scripts/render-scenes.ts "video-123" '{"scenes": [...]}'
```

---

## Next: [02-scene-rendering.md](./02-scene-rendering.md)
