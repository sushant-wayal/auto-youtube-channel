# Workers Architecture

> Core processing workers implemented as pure functions

This document describes the five worker modules that handle video generation pipeline tasks.

---

## Overview

Workers are organized as npm workspace packages under `workers/`. Each worker:

1. Exports **pure functions** (no side effects beyond external I/O, stateless per invocation)
2. Has its own `package.json` and dependencies
3. Uses shared configuration from `shared/config`
4. Calls `validateConfig(['cloudinary', ...])` at startup to guard against misconfiguration
5. Returns structured results for pipeline orchestration

```
workers/
├── idea-selector/           # AI-powered topic idea generation (7-step hybrid pipeline)
├── video-scene-renderer/    # Visual scene rendering (Puppeteer + FFmpeg, or AI mode)
├── voice-over-generation/   # TTS audio generation (Gemini TTS + F5-TTS fallback)
├── video-assembler/         # FFmpeg video assembly
└── youtube-upload/          # YouTube API integration + chapter timestamps
```

---

## 1. Idea Selector Worker

**Location:** `workers/idea-selector/`

**Purpose:** Autonomously generates and selects a video topic using YouTube analytics, trending signals, and a 7-step hybrid AI + rules pipeline.

### Entry Point

```typescript
// workers/idea-selector/src/index.ts
import { runIdeaSelector } from './index';

const result = await runIdeaSelector({
  existingQueueIdeas?: string[] // Ideas already in queue (for deduplication)
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
```

### TopicIdea Type (Full)

```typescript
interface TopicIdea {
  topic: string;
  reasoning: string;
  curiosityAngle:
    | 'Myth' | 'Hidden Cost' | 'Surprising Truth'
    | 'Counterintuitive Behavior' | 'Tradeoff'
    | 'Failure Mode' | 'Common Mistake';
  audienceBreadthScore: number;   // 0–100
  titlePotentialScore: number;    // 0–100
  performanceScore: number;       // 0–100 (AI estimate)
  targetFormats: {
    longForm: boolean;
    shorts: number;               // 3–5
  };
  suggestedAngles: string[];
  estimatedPerformance: {
    score: number;
    confidence: 'low' | 'medium' | 'high';
  };
}
```

### The 7-Step Hybrid Pipeline

```
Step 0  Fetch Trending Signals (concurrent, non-fatal on failure)
         → YouTube Data API (S&T trending India, top 15 by views)
         → Hacker News Algolia API (front_page, tech keyword filter)
         → Reddit JSON API (/r/programming+webdev+... top day, 20 posts)

Step 1  Fetch recent 50 channel videos (YouTube Data API v3)

Step 2  Fetch analytics for those videos (last 90 days)
         → views, CTR, retention, impressions, comments

Step 3  Gemini AI channel analysis
         → Identifies top topics, engagement patterns, opportunities
         → Model: gemini-3-flash-preview, temperature: 0.7

Step 4  Gemini AI generates 15 raw topic ideas
         → Must include: curiosityAngle, audienceBreadthScore,
           titlePotentialScore, performanceScore, reasoning, 3–5 shorts
         → Model: gemini-3-flash-preview, temperature: 0.8, JSON output

Step 5  Hard Elimination (anti-hallucination)
         → 30-day recency block (similar to recently uploaded videos)
         → 2x overuse threshold (same domain used too often)
         → >60% word-overlap dedup against existing queue entries

Step 6  Formula-based ranking (deterministic)
         → Hybrid = AI score×0.34 + formula score×0.18 +
                    audienceBreadth×0.28 + titlePotential×0.20
         → Top 5 survive

Step 7  Gemini AI final selection from top 5
         → Returns { index, justification }
         → Model: gemini-3-flash-preview, temperature: 0.3 (decisive)
         → Falls back to formula rank 1 on error
```

### Key Components

| File | Description |
|------|-------------|
| `src/lib/gemini-idea-generator.ts` | All Gemini calls: channel analysis, idea generation, final selection. Exponential backoff (5 retries, 2s–30s + jitter) |
| `src/lib/trend-detector.ts` | Fetches trending from YouTube, HN, Reddit concurrently. Failures are non-fatal |
| `src/lib/hybrid-validator.ts` | Orchestrates hardEliminate + rankIdeas + queue dedup |
| `src/lib/eliminator.ts` | Hard rules: 30-day recency, 2x overuse threshold |
| `src/lib/ranker.ts` | Formula-based scoring using historical CTR, retention, views |
| `src/lib/youtube-data-service.ts` | Fetches videos + analytics via YouTube Data API (OAuth) |
| `src/lib/gemini-client.ts` | Singleton Gemini client |

---

## 2. Video Scene Renderer Worker

**Location:** `workers/video-scene-renderer/`

**Purpose:** Converts scene definitions (ActionIR) into MP4 video clips and uploads to Cloudinary.

### Entry Point

```typescript
// workers/video-scene-renderer/src/index.ts
import { renderScenes } from './index';

const result = await renderScenes({
  scenes: SceneIR[],      // Scene definitions with actions
  videoId: string,         // Unique identifier for Cloudinary paths
  isShort?: boolean        // Portrait (1080×1920) vs landscape (1920×1080)
});

// Returns
{
  urls: string[],           // Cloudinary URLs for each scene clip
  timings: number[],        // Duration of each clip in seconds
  animationStopTimes: number[] // When animations finish (for assembler sync)
}
```

### Two Rendering Modes

Controlled by `SCENE_RENDER_METHOD` env var (`code` | `ai`):

#### Mode 1: `code` (default)
1. `SceneHtmlRenderer` converts `SceneIR` (with `actions[]`) → self-contained animated HTML (Canvas 2D)
2. `HtmlToVideoService` uses Puppeteer to render frames at target FPS (`window.renderFrame(t)`)
3. FFmpeg encodes PNG frames → H.264 MP4 (CRF 16, preset medium, yuv420p, `threads=1`)
4. Result uploaded to Cloudinary

#### Mode 2: `ai`
1. POST to `/api/generate-scene-html` (website) with scene narration
2. Gemini generates animated HTML for the scene
3. Same Puppeteer → FFmpeg pipeline renders the AI HTML
4. Uses Redis rate-limit queue (22s cooldown per scene) to avoid Gemini quota exhaustion

### Rendering Pipeline

```
SceneIR → HTML+JS (Canvas 2D) → Puppeteer (headless) → PNG frames → FFmpeg → MP4 → Cloudinary URL
```

### SceneHtmlRenderer Internals

**File:** `src/lib/scene-rendring/action-flow-to-html.ts` (~1567 lines)

- **Dual theme system:** `light` (Zinc/slate, bg `#FAFAF9`) and `dark` (slate-900, bg `#0F172A`), auto-alternated per scene index (`i % 2 === 0 → light`)
- **Background:** engineering-paper grid, circuit nodes, corner brackets, floating tech symbols (`{}`, `<>`, `[]`, `=>`), circuit traces, soft vignette
- **Typography:** Google Fonts — Inter (UI) + JetBrains Mono (code)
- **Responsive text scales:** two systems for shorts (portrait) vs long-form (landscape), derived as `%` of canvas W/H
- **Built-in syntax highlighter:** JS, TS, Python, Go, Rust, SQL (+ aliases `js`, `ts`, `py`, `golang`, `rs`)
- **Token colors (dark):** keyword=#C084FC, string=#86EFAC, number=#FDBA74, function=#60A5FA, type=#34D399
- **Token colors (light):** keyword=#7C3AED, string=#15803D, number=#EA580C, function=#2563EB, type=#059669
- **Animation easing:** `linear`, `easeIn`, `easeOut`, `easeInOut`

### Action Primitives (what the AI can use in ActionIR)

| op | Description |
|----|-------------|
| `text` | Text label — fade in, title/subtitle/body/label size hints, alignment |
| `code` | Syntax-highlighted code block — line-by-line reveal |
| `line` | Animated draw (straight, arc up/down, S-curve, wave), optional arrow |
| `icon` | 18 named SVG icons: check, cross, warning, info, arrowRight/Left/Up/Down, plus, minus, clock, database, server, cpu, lock, unlock, cloud, bug, chartUp, chartDown |

### Video Dimensions

| Format | Width | Height | FPS |
|--------|-------|--------|-----|
| Long-form | 1920 | 1080 | 30 |
| Short | 1080 | 1920 | 30 |

### Key Components

| File | Description |
|------|-------------|
| `src/lib/actios-to-clips.ts` | `ClipsRenderService` — orchestrates rendering, uploads, rate-limit queue |
| `src/lib/scene-rendring/action-flow-to-html.ts` | `SceneHtmlRenderer` — ActionIR → animated HTML (1567 lines) |
| `src/lib/scene-rendring/htmlToVideoService.ts` | `HtmlToVideoService` — Puppeteer frame capture + FFmpeg |

---

## 3. Voice-Over Generation Worker

**Location:** `workers/voice-over-generation/`

**Purpose:** Converts per-scene narration text into WAV audio files and uploads to Cloudinary. Supports two TTS providers with automatic fallback.

### Entry Point

```typescript
// workers/voice-over-generation/src/index.ts
import { generateVoiceOvers } from './index';

const result = await generateVoiceOvers({
  perSceneNarration: string[], // Narration text per scene (empty string = silence)
  videoId: string,              // For Cloudinary folder naming
  voice?: string                // Voice preset (default: 'Puck')
});

// Returns
{
  urls: string[]           // Cloudinary URLs for each audio file
}
```

### Provider Selection & Fallback

```
VOICEOVER_PROVIDER env var → 'gemini' | 'f5'
primary = configured provider
fallback = the other one

try primary → on any failure → try fallback → on failure → throw
(local temp files cleaned between attempts)
```

### Provider 1: Gemini TTS

**Model:** `gemini-2.5-flash-preview-tts`

| Property | Value |
|----------|-------|
| Sample Rate | 24 kHz |
| Bit Depth | 16-bit |
| Channels | Mono |
| Format | WAV (PCM with manual header) |
| Max Retries | 5 (exponential backoff 2s–30s + jitter) |

**Available Voices:**

| Voice | Characteristics |
|-------|-----------------|
| `Puck` | Friendly, warm (default) |
| `Charon` | Deep, authoritative |
| `Kore` | Clear, professional |
| `Fenrir` | Strong, confident |
| `Aoede` | Soft, pleasant |

**Empty narration:** Creates 1-second silence WAV (zero PCM samples + proper header).

### Provider 2: F5-TTS (Open-Source Voice Clone)

- Python package: `git+https://github.com/SWivid/F5-TTS.git`
- **Reference audio:** `assets/shorter-better-reference-audio.wav`
- **Batch mode:** All non-empty narrations processed in a single Python script (model loaded once)
- **Text sanitization:** strips `[PAUSE...]`, SSML `<...>`, hyphenated-words → space-separated, removes `–—_*~\``
- **Requires:** Python 3.11+, model download (~several GB, happens fresh each CI run)

### TTS Pipeline

```
narration text (per scene)
  → generateNarrationAudio() via Gemini TTS or F5-TTS
  → WAV file saved locally
  → Upload to Cloudinary (video-gen/narrations/{videoId}/part-{N})
  → Delete local WAV
  → Return secure URL
```

### API Key Rotation (Gemini)

```
GEMINI_API_KEY_1 and GEMINI_API_KEY_2
→ Round-robin between keys per request
→ Falls back to single key if only one provided
→ Effectively doubles the rate limit for long voiceover sessions
```

### Key Components

| File | Description |
|------|-------------|
| `src/lib/gemini/gemini-tts-service.ts` | `GeminiTTSService` — Gemini TTS, WAV header, retry logic |
| `src/lib/f5/f5-tts-service.ts` | `F5TTSService` — Python subprocess, batch mode, text sanitization |
| `src/index.ts` | Provider selection, fallback orchestration |

---

## 4. Video Assembler Worker

**Location:** `workers/video-assembler/`

**Purpose:** Combines rendered scene clips with narration audio, background music, intro/outro, and logo into the final H.264 MP4.

### Entry Point

```typescript
// workers/video-assembler/src/index.ts
import { assembleVideo } from './index';

const result = await assembleVideo({
  jobId: string,               // Cloudinary folder naming
  videoId: string,
  clips: string[],             // Cloudinary URLs of scene MP4s
  clipTimings?: number[],      // Duration hints per clip
  animationStopTimes?: number[], // When each scene's animations complete
  perSceneNarration: string[], // Text per scene (empty = silence)
  narrationAudios?: string[],  // Cloudinary URLs for narration WAVs
  music?: string,              // Path to background music file
  branding?: { logo?, intro?, outro? },
  isShort?: boolean,           // Portrait vertical format
  voiceoverProvider?: string,  // 'gemini' | 'f5' (affects audio ducking volumes)
});

// Returns
{
  videoId: string,
  outputUrl: string,           // Cloudinary URL of final MP4
  duration: number,            // Total duration in seconds
  clipCount: number,
  sceneDurations?: number[]    // Actual scene durations for chapter timestamps
}
```

### 6-Stage Assembly Pipeline

```
Stage 1  Setup working directory: videos/{videoId}/

Stage 2  Per-scene processing (loop):
  ↓ Download scene MP4 from Cloudinary
  ↓ Download narration WAV (or create silence if empty narration)
  ↓ targetDuration = max(animationStop + 0.5s, narrationDuration)
  ↓ normalizeClipWithDuration:
      - Scale to 1920×1080 (or 1080×1920 for shorts)
      - If clip < targetDuration: tpad=stop_mode=clone (freeze last frame)
      - Trim to targetDuration
  ↓ addAudioToVideo: mux narration into clip (-t {targetDuration})
  ↓ Cleanup intermediates
  ↓ Collect scene_with_audio_{i}.mp4 + sceneDuration[i]

Stage 3  Concatenate all scenes:
  → FFmpeg concat demuxer (stream-copy first; re-encode on error)
  → combined_video.mp4

Stage 4  Background music mixing:
  if music provided:
    → Loop music to video length (aloop)
    → BGM vol during narration: 15% (5% for F5 provider)
    → BGM vol during outro silence: 30% (15% for F5 provider)
    → F5 mode: boost narration audio 1.5×
    → amix narration + BGM with volume split
  else:
    → generate silence placeholder
  → mux final_audio.mp3 into combined_video.mp4

Stage 5  Branding:
  Long-form AND (intro OR outro):
    → normalizeClipWithAudio(intro) + main + normalizeClipWithAudio(outro)
    → concat → with_branding.mp4
  Short:
    → overlayLogo: scale logo → 120px → overlay top-right (20px padding)
    → → final.mp4

Stage 6  Upload:
  → cloudinaryService.uploadVideo(final.mp4, '{jobId}/videos', 'main-video')
  → Return outputUrl + sceneDurations
```

### FFmpeg Quality Settings

| Operation | Codec | Preset | CRF | Audio |
|-----------|-------|--------|-----|-------|
| Scene normalization | libx264 (threads=1) | medium | 18 | -an |
| Concat fallback | libx264 | medium | 18 | aac 192k |
| Final audio mux | copy (video) | — | — | aac 192k 48kHz stereo |
| Logo overlay | libx264 | medium | 18 | copy |

All FFmpeg calls use `-threads 1` to reduce memory pressure in CI.

### Assets Structure

```
workers/video-assembler/src/lib/assests/    ← note: "assests" is a typo in code
├── music/                  # Background tracks (random selection)
│   ├── track1.mp3
│   └── ...
├── logo.png                # Logo overlay for shorts (scaled to 120px)
├── intro.mp4               # Intro video (original audio preserved)
└── outro.mp4               # Outro video (original audio preserved)
```

### Key Components

| File | Description |
|------|-------------|
| `src/lib/video/video-assembly.ts` | `VideoAssemblyService` — main assembly orchestration |
| `src/lib/video/ffmpeg-utils.ts` | FFmpeg command builders, concat, overlay |
| `src/lib/assests/music-branding.ts` | `pickBackgroundTrack()`, `getBrandingAssets()` |

---

## 5. YouTube Upload Worker

**Location:** `workers/youtube-upload/`

**Purpose:** Downloads the final MP4 from Cloudinary, uploads to YouTube via Data API v3, sets thumbnails, and handles scheduled publishing.

### Entry Point

```typescript
// workers/youtube-upload/src/index.ts
import { uploadToYouTube } from './index';

const result = await uploadToYouTube({
  videoUrl: string,            // Cloudinary video URL
  isShort?: boolean,
  title: string,
  description: string,
  tags?: string[],
  thumbnailUrl?: string,
  privacyStatus?: 'public' | 'unlisted' | 'private',
  scheduledPublishTime?: string,  // ISO 8601 UTC

  // Chapter timestamp generation (long-form only)
  sceneTitles?: string[],
  sceneDurations?: number[],
  hasIntro?: boolean,
  introDuration?: number,         // Default: ~8
  introTitle?: string,
  hasOutro?: boolean,
  outroDuration?: number,
  outroTitle?: string,
});

// Returns
{ videoId: string }               // YouTube video ID
```

### Upload Flow

```
1. generateTimestamps() (long-form only)
   → Calculate cumulative offsets from sceneDurations
   → Format: "0:00 Intro\n0:08 Scene 1\n..."
   → Append to description: "📚 Chapters:\n..."

2. Download video MP4 from Cloudinary → /tmp/youtube/{timestamp}.mp4
3. Download thumbnail → /tmp/youtube/{timestamp}-thumb.jpg (if provided)

4. For shorts WITHOUT explicit scheduledPublishTime:
   → getShortsPublishTimes() from Redis → use rank-mapped slot
   → Convert HH:MM IST → UTC (subtract 5.5h offset)
   → Set privacyStatus = 'private'

5. youtube.videos.insert():
   → categoryId = "28" (Science & Technology)
   → For shorts: append "#Shorts" to tags + description
   → For scheduled: status.publishAt = ISO UTC time

6. youtube.thumbnails.set() (long-form only, if thumbnailUrl provided)

7. Cleanup /tmp/youtube/ files
```

### Shorts Scheduling (by rank)

| Rank (matrix index) | Default IST Time |
|---------------------|-----------------|
| 0 (Best) | 06:45 |
| 1 | 07:45 |
| 2 | 08:45 |
| 3 | 12:00 |
| 4 (Worst) | 14:00 |

Times are configurable via the website dashboard → stored in Redis `shorts:publish-times`.

IST → UTC conversion:
```typescript
const istOffset = 5.5 * 60 * 60 * 1000; // ms
const utcTime = new Date(istNow.getTime() - istOffset).toISOString();
```

### Key Components

| File | Description |
|------|-------------|
| `src/services/youtube-service.ts` | `YouTubeService` — OAuth2, videos.insert, thumbnails.set |
| `src/utils/timestamp-generator.ts` | Chapter timestamp calculation and formatting |

---

## Worker Dependencies (Shared Patterns)

### Config Validation Guard

```typescript
import { validateConfig } from '../../../shared/config';

// At start of each worker function — exits with code 1 on missing vars
validateConfig(['cloudinary', 'gemini', 'youtube', 'redis']);
```

### Cloudinary Service

```typescript
import CloudinaryService from '../../../shared/services/cloudinary-service';

const service = CloudinaryService.getInstance(); // Singleton
await service.uploadVideo(localPath, folder, filename);
await service.uploadAudio(localPath, folder, filename);
await service.downloadFile(cloudinaryUrl, outputPath);
await service.deleteFile(publicId);
```

### Shared Config Object

```typescript
import { config } from '../../../shared/config';

config.cloudinary.cloudName
config.gemini.apiKey1
config.gemini.apiKey2
config.voiceover.provider          // 'gemini' | 'f5'
config.sceneRendering.method       // 'code' | 'ai'
config.video.long.width            // 1920
config.video.long.height           // 1080
config.video.short.width           // 1080
config.video.short.height          // 1920
```

### stdout vs stderr Convention

All log/progress messages go to `console.error()` (stderr).
Only structured output read by GitHub Actions goes to `console.log()` (stdout).

```typescript
console.error('Uploading scene 3/8...');  // logs, visible in Actions
console.log(JSON.stringify(result));       // parsed by next job
```

---

## Testing Workers Locally

```bash
# Install dependencies
npm install

# Run individual worker script
npx tsx .github/scripts/render-scenes.ts

# Or invoke worker directly with env vars
CLOUDINARY_CLOUD_NAME=xxx \
GEMINI_API_KEY_1=xxx \
REDIS_URL=redis://localhost:6379 \
WEBSITE_DOMAIN=http://localhost:3000 \
SCENE_RENDER_METHOD=code \
npx tsx .github/scripts/generate-script.ts
```

---

## Next: [02-scene-rendering.md](./02-scene-rendering.md)
