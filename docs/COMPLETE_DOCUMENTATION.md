# Auto YouTube Channel — Complete Repository Documentation

> **A fully automated, AI-driven pipeline that generates, voices, renders, assembles, and uploads YouTube videos daily — without human intervention.**

---

## Table of Contents

1. [High-Level Architecture Overview](#1-high-level-architecture-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [GitHub Actions CI/CD Pipeline](#3-github-actions-cicd-pipeline)
4. [Worker: `idea-selector`](#4-worker-idea-selector)
5. [Worker: `video-scene-renderer`](#5-worker-video-scene-renderer)
6. [Worker: `voice-over-generation`](#6-worker-voice-over-generation)
7. [Worker: `video-assembler`](#7-worker-video-assembler)
8. [Worker: `youtube-upload`](#8-worker-youtube-upload)
9. [Shared Package](#9-shared-package)
10. [Website (Next.js)](#10-website-nextjs)
11. [Mobile App (React Native / Expo)](#11-mobile-app-react-native--expo)
12. [Configuration & Secrets Reference](#12-configuration--secrets-reference)
13. [Data Flow: Full Pipeline Walk-through](#13-data-flow-full-pipeline-walk-through)
14. [Key Design Decisions & Patterns](#14-key-design-decisions--patterns)
15. [Known Issues & Notes](#15-known-issues--notes)

---

## 1. High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GitHub Actions: Daily Video Pipeline                    │
│                                                                             │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │  populate-ideas  │──▶│ generate-script  │──▶│     render-scenes      │  │
│  │ (idea-selector)  │   │ (Website API)    │   │ (video-scene-renderer) │  │
│  └──────────────────┘   └────────┬─────────┘   └────────────┬───────────┘  │
│                                  │                           │              │
│                                  │              ┌────────────▼───────────┐  │
│                                  │              │   generate-voiceover   │  │
│                                  │              │ (voice-over-generation)│  │
│                                  │              └────────────┬───────────┘  │
│                                  │                           │              │
│                                  │              ┌────────────▼───────────┐  │
│                                  │              │    assemble-video      │  │
│                                  │              │   (video-assembler)    │  │
│                                  │              └────────────┬───────────┘  │
│                                  │                           │              │
│                                  │              ┌────────────▼───────────┐  │
│                                  └──────────────│    upload-youtube      │  │
│                                                 │  (youtube-upload)      │  │
│                                                 └────────────────────────┘  │
│                                                                             │
│  Parallel shorts matrix: process-short[0] | process-short[1] | ...         │
└─────────────────────────────────────────────────────────────────────────────┘

External Services:
  Redis           — idea queue, shorts schedule times, AI scene HTML rate-limit
  Cloudinary      — intermediate file storage (scenes, audio, final videos)
  Google Gemini   — AI script generation, TTS voice generation, scene HTML (AI mode)
  YouTube Data API— upload, analytics, trending
  F5-TTS (Python) — open-source voice clone TTS (alternative to Gemini TTS)
  Website (Next.js)— script generation endpoint, AI scene HTML endpoint, dashboard
```

The system works on a **push-to-Cloudinary, pull-from-Cloudinary** model. Each GitHub Actions job runs in its own ephemeral runner. Intermediate artifacts (rendered scene videos, narration audio) are stored in Cloudinary and referenced via URL across jobs.

---

## 2. Monorepo Structure

```
auto-youtube-channel/
├── .github/
│   ├── scripts/                  # Entry-point TypeScript scripts run by Actions
│   │   ├── assemble-video.ts
│   │   ├── check-and-populate-ideas.ts
│   │   ├── generate-script.ts
│   │   ├── generate-thumbnail.ts
│   │   ├── generate-voiceover.ts
│   │   ├── process-shorts.ts
│   │   ├── process-single-short.ts
│   │   ├── render-scenes.ts
│   │   └── upload-youtube.ts
│   └── workflows/
│       └── main.yml              # The single workflow file for the entire pipeline
│
├── workers/                      # npm workspace packages (one per concern)
│   ├── idea-selector/            # AI-driven video idea generation
│   ├── video-scene-renderer/     # Scene → MP4 conversion (Puppeteer + FFmpeg)
│   ├── video-assembler/          # Scene clips + audio → final MP4 (FFmpeg)
│   ├── voice-over-generation/    # Text → WAV narration (Gemini TTS / F5-TTS)
│   └── youtube-upload/           # Upload MP4 to YouTube Data API v3
│
├── shared/                       # Shared TypeScript package
│   ├── config/                   # Centralized env-var config + validation
│   └── services/
│       ├── cloudinary-service.ts # Singleton Cloudinary client
│       └── shorts-publish-time-service.ts  # Redis-backed publish schedule
│
├── website/                      # Next.js app (dashboard + API)
│   ├── app/
│   │   ├── api/                  # REST endpoints used by both workers and dashboard
│   │   │   ├── generate-script/
│   │   │   ├── generate-scene-html/
│   │   │   ├── generate-thumbnail/
│   │   │   ├── pipeline-status/  # Webhook receiver from GitHub Actions
│   │   │   ├── ideas-queue/
│   │   │   ├── schedule-times/
│   │   │   ├── shorts-publish-time/
│   │   │   ├── settings/
│   │   │   ├── trigger-youtube/
│   │   │   ├── jobs/
│   │   │   ├── push-token/
│   │   │   └── ...
│   │   ├── dashboard/            # Private admin dashboard
│   │   └── page.tsx              # (Currently fully commented out — old UI)
│
├── mobile-app/                   # React Native / Expo app (companion)
│   └── dashboard-app/
│
├── docs/                         # Documentation directory
│
├── package.json                  # Root workspace config
├── complete-workflow-with-assets.ts  # Local end-to-end test script
├── scene-rendring-v2.html        # Standalone browser scene renderer prototype
├── voice-clone.ipynb             # Jupyter notebook for F5-TTS voice cloning
├── add-ideas-to-prod.js          # One-off utility: seed ideas to Redis
├── seed-test-queue.js            # One-off utility: seed test queue
└── initialize-schedule-times.js  # One-off utility: init Redis schedule times
```

### Workspace Layout
The root `package.json` defines an npm workspace with two groups:
- `workers/*` — all worker packages
- `shared` — shared utilities

`mobile-app/**` is marked `nohoist` because Expo manages its own `node_modules`.

---

## 3. GitHub Actions CI/CD Pipeline

**File:** [`.github/workflows/main.yml`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/.github/workflows/main.yml)

### Trigger

The pipeline is triggered via `workflow_dispatch` (manual trigger), with an optional `video_idea` string input. The daily cron (`'23 0 * * *'`) is commented out but ready to be re-enabled.

### Jobs (in dependency order)

```
populate-ideas
    ↓
generate-script
    ↓ ↓ ↓ ↓ ↓
    │  │  │  └── generate-thumbnail (independent, runs in parallel)
    │  │  └───── shorts-matrix-setup
    │  │               ↓
    │  │         process-short[0] | process-short[1] | ... (parallel matrix)
    │  │
    │  └── generate-voiceover (parallel with render-scenes)
    └── render-scenes (parallel with generate-voiceover)
              ↓ ↓
        assemble-video
              ↓
        upload-youtube
              ↓
        pipeline-summary
```

### Job-by-job breakdown

| Job | Timeout | System Deps | Key Env Vars |
|-----|---------|-------------|--------------|
| `populate-ideas` | 15 min | none | `REDIS_URL`, `GEMINI_API_KEY_1`, YouTube OAuth |
| `generate-script` | 10 min | none | `WEBSITE_DOMAIN`, `REDIS_URL`, `SCENE_RENDER_METHOD` |
| `render-scenes` | 60 min | ffmpeg, Chromium libs (for Puppeteer) | Cloudinary, `WEBSITE_DOMAIN`, `SCENE_RENDER_METHOD` |
| `generate-voiceover` | 360 min | ffmpeg, Python 3.11, F5-TTS | Cloudinary, `GEMINI_API_KEY_1/2`, `VOICEOVER_PROVIDER` |
| `generate-thumbnail` | 15 min | none | `WEBSITE_DOMAIN` |
| `assemble-video` | 60 min | ffmpeg | Cloudinary, `VOICEOVER_PROVIDER` |
| `upload-youtube` | 30 min | none | `REDIS_URL`, YouTube OAuth, Cloudinary |
| `shorts-matrix-setup` | 5 min | none | none (reads from `generate-script` output) |
| `process-short[N]` | 60 min | ffmpeg, Chromium libs, Python 3.11, F5-TTS | All of the above |
| `pipeline-summary` | — | none | All outputs from all jobs |

### Cross-job Data Transfer

GitHub Actions job outputs have an effective size limit (~64 KB) and cannot easily contain binary or URL strings. The pipeline uses **hex encoding** to safely pass asset URLs across jobs without triggering GitHub's secret-detection filters:

```bash
# Producer (hex-encode):
echo "voiceover_data=$(echo "$JSON" | xxd -p -c 1000000)" >> $GITHUB_OUTPUT

# Consumer (hex-decode):
JSON=$(echo "$HEX_VALUE" | xxd -r -p)
```

### Pipeline Summary Webhook

At the end, `pipeline-summary` POSTs a structured JSON payload to `$WEBSITE_DOMAIN/api/pipeline-status` authenticated with `PIPELINE_WEBHOOK_SECRET`. This populates the dashboard with final asset URLs, job statuses, scene narrations, and short hooks.

---

## 4. Worker: `idea-selector`

**Directory:** [`workers/idea-selector/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector)

### Purpose
Implements a **7-step hybrid AI + rules-based pipeline** to autonomously select the best video topic for the channel. Results are pushed to the Redis `video:ideas` queue.

### Entry Point
[`src/index.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/index.ts) — exports `runIdeaSelector()`

### The 7-Step Pipeline

```
Step 0: Fetch Trending Signals (concurrent, non-blocking on failure)
        → YouTube S&T trending (India), Hacker News, Reddit tech subreddits

Step 1: Fetch recent 50 channel videos via YouTube Data API

Step 2: Fetch analytics for those videos (last 90 days)
        → views, CTR, retention, impressions, comments per video

Step 3: Gemini AI channel analysis
        → Identifies top performing topics, patterns, engagement signals

Step 4: Gemini AI generates 15 raw topic ideas
        → Each idea must include: curiosity angle, audience breadth score,
          title potential score, performance score, reasoning, 3-5 shorts count,
          suggested angles, performance confidence

Step 5: Hard Elimination (anti-hallucination)
        → 30-day recency window, 2x overuse threshold, queue duplicate check

Step 6: Formula-based ranking (deterministic validation)
        → Hybrid score = AI score × 0.34 + formula score × 0.18 +
                         audience breadth × 0.28 + title potential × 0.20
        → Top 5 survive

Step 7: Gemini AI final topic selection from top 5
        → Returns index + justification; falls back to formula ranking on error
```

### Key Files

| File | Role |
|------|------|
| [`src/lib/gemini-idea-generator.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/gemini-idea-generator.ts) | All Gemini calls: analysis, idea generation, final selection. Has exponential backoff (5 retries, 2s base → 30s max + jitter). Model: `gemini-3-flash-preview` |
| [`src/lib/trend-detector.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/trend-detector.ts) | Fetches trending data from YouTube (most popular S&T India), HN Algolia API, Reddit JSON API. All three run concurrently; individual failures are non-fatal |
| [`src/lib/hybrid-validator.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/hybrid-validator.ts) | Orchestrates `hardEliminate()` + `rankIdeas()` + duplicate-vs-queue check |
| [`src/lib/eliminator.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/eliminator.ts) | Hard rules: blocks topics uploaded in last 30 days, overused topics (>2x threshold) |
| [`src/lib/ranker.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/ranker.ts) | Formula-based ranking using historical CTR, retention, views |
| [`src/lib/youtube-data-service.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/youtube-data-service.ts) | Fetches recent videos + analytics via YouTube Data API (uses OAuth refresh token) |
| [`src/lib/gemini-client.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/idea-selector/src/lib/gemini-client.ts) | Singleton Gemini API client |

### `TopicIdea` Type

```typescript
interface TopicIdea {
    topic: string;
    reasoning: string;
    curiosityAngle: 'Myth' | 'Hidden Cost' | 'Surprising Truth' |
                    'Counterintuitive Behavior' | 'Tradeoff' |
                    'Failure Mode' | 'Common Mistake';
    audienceBreadthScore: number;   // 0-100
    titlePotentialScore: number;    // 0-100
    performanceScore: number;       // 0-100
    targetFormats: {
        longForm: boolean;
        shorts: number;             // 3-5
    };
    suggestedAngles: string[];
    estimatedPerformance: {
        score: number;
        confidence: 'low' | 'medium' | 'high';
    };
}
```

### Trend Detection Sources

| Source | API | Filter |
|--------|-----|--------|
| YouTube | Data API v3, `chart=mostPopular`, `videoCategoryId=28` (S&T), `regionCode=IN` | Top 15 by view count |
| Hacker News | Algolia `hn.algolia.com/api/v1/search?tags=front_page` | Filtered by 30 tech keywords |
| Reddit | `reddit.com/r/programming+webdev+javascript+typescript+node+ExperiencedDevs+devops+learnprogramming/top.json?t=day` | Top 20 posts |

---

## 5. Worker: `video-scene-renderer`

**Directory:** [`workers/video-scene-renderer/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/video-scene-renderer)

### Purpose
Converts **scene data (IR — Intermediate Representation)** into MP4 video clips and uploads them to Cloudinary.

### Entry Point
[`src/index.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/video-scene-renderer/src/index.ts) — exports `renderScenes()`

### Two Rendering Modes

#### Mode 1: `code` (default)
1. `SceneHtmlRenderer` converts `SceneIR` (with `actions[]`) into a self-contained animated HTML page using Canvas 2D API
2. `HtmlToVideoService` uses **Puppeteer** to load the HTML, renders each frame at the given FPS by calling `window.renderFrame(t)`, captures screenshots with `page.screenshot()`, then encodes PNG frames → MP4 via FFmpeg
3. Result is uploaded to Cloudinary

#### Mode 2: `ai`
- Calls the website's `/api/generate-scene-html` endpoint, which uses Gemini to generate bespoke HTML for the scene's narration
- The same Puppeteer → FFmpeg pipeline renders the AI-generated HTML
- Uses Redis for a **rate-limit queue** (22-second cooldown between scenes to avoid Gemini quota exhaustion)

### Scene HTML Renderer (`SceneHtmlRenderer`)

[`src/lib/scene-rendring/action-flow-to-html.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/video-scene-renderer/src/lib/scene-rendring/action-flow-to-html.ts) — 1,567 lines

This is the most complex file in the codebase. It generates a complete self-contained HTML/JS animation from a list of `ActionIR[]` objects.

**Design System:**
- **Dual theme:** `light` (Zinc/slate palette, `bg: #FAFAF9`) and `dark` (slate-900, `bg: #0F172A`), auto-alternated per scene (`i % 2 === 0 → light, i % 2 === 1 → dark`)
- **Background elements:** engineering-paper grid, circuit node dots at intersections, corner bracket accents, floating tech symbols (`{}`, `<>`, `[]`, `=>`, `//`, `&&`, `( )`, `**`), circuit trace decorations, soft radial vignette
- **Responsive typography:** Two scale systems — shorts (portrait) vs long-form (landscape). Font sizes as percentages of canvas width/height (e.g., `title = W * 0.070` for shorts, `H * 0.067` for long-form)
- **Google Fonts:** Inter (UI) + JetBrains Mono (code)

**Syntax Highlighting (full inline tokenizer):**

Languages supported: JavaScript, TypeScript, Python, Go, Rust, SQL (+ aliases `js`, `ts`, `py`, `golang`, `rs`)

Token types: Keyword, String, Number, Comment, Function, Operator, Punctuation, Variable, Type, BuiltIn, Plain

Dark theme colors: `keyword=#C084FC`, `string=#86EFAC`, `number=#FDBA74`, `function=#60A5FA`, `type=#34D399`
Light theme colors: `keyword=#7C3AED`, `string=#15803D`, `number=#EA580C`, `function=#2563EB`, `type=#059669`

**Animation Primitives:**
- `drawLine()` — animated line draw with curved variants (arc up, arc down, S-curve, wave), seeded for consistency
- `drawCode()` — syntax-highlighted code block with line-by-line reveal
- `drawText()` — text label with fade-in, supports title/subtitle/body/label size hints
- `drawIcon()` — 18 named SVG icons: check, cross, warning, info, arrowRight/Left/Up/Down, plus, minus, clock, database, server, cpu, lock, unlock, cloud, bug, chartUp, chartDown

**Timing Pipeline:**
```
actions[] (with timestamps t)
  → assignDurations(): gap-window algorithm assigns animation durations
  → applyTextReplacement(): text actions in same position clip each other
  → emitHtml(): embed into canvas rendering loop
```

### `HtmlToVideoService`

[`src/lib/scene-rendring/htmlToVideoService.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/video-scene-renderer/src/lib/scene-rendring/htmlToVideoService.ts)

```
HTML string
  → Puppeteer.launch(headless=true, --no-sandbox)
  → page.setContent(html), wait for fonts
  → for each frame: page.evaluate('window.renderFrame(t)') → page.screenshot()
  → PNG frames in .frames_tmp/
  → FFmpeg: frames → H.264 MP4 (CRF 16, preset medium, yuv420p, threads=1)
  → cleanup frames directory
```

### Video Dimensions

| Format | Width | Height | FPS |
|--------|-------|--------|-----|
| Long-form | 1920 | 1080 | 30 |
| Short | 1080 | 1920 | 30 |

### Rate-Limit Queue (AI mode only)

To serialize HTML generation requests and enforce a strict **22-second cooldown** between Gemini calls (avoiding RPM limits), the system uses a shared Redis-backed ticketing queue:

1. **Ticket Assignment**: Each request hits `POST /api/generate-scene-html` and increments the Redis key `html_queue:last_enquiry` to receive a unique integer `ticket` ID.
2. **Turn Polling Loop**: The server handler polls the key `html_queue:turn` every 2 seconds. When `turn === ticket`, the request proceeds.
3. **Deadlock Recovery (Lua Script)**: If a predecessor fails or times out, the lease key `html_queue:processing` will expire. The waiting runner detects this and runs a Lua script to atomically increment `html_queue:turn` if no active processing lock exists:
   ```typescript
   // Atomic queue turn advancement in Redis via eval:
   const recovered = await redis.eval(luaScript, 0, String(ticket - 1));
   ```
4. **Processing Lease**: The active ticket locks the queue via `redis.set("html_queue:processing", ticket, "EX", 90)` (90-second crash-safe lease) and prompts Gemini.
5. **Worker Parallel Handoff**: Once the worker receives `{ html, ticket }`, it immediately returns the layout response. The worker starts a **background promise** to handle the 22-second delay:
   - The worker thread does *not* wait; it immediately loads Puppeteer, captures PNG frames, encodes the MP4 clip, and uploads it to Cloudinary.
   - Meanwhile, in the background, the timer sleeps for 22 seconds and then atomically increments `html_queue:turn` and deletes `html_queue:processing` via a Redis `multi` transaction.
   - At the very end of all rendering loops, the worker awaits `Promise.all(this.pendingCleanups)` to block exit until all background queue keys are advanced.

---

## 6. Worker: `voice-over-generation`

**Directory:** [`workers/voice-over-generation/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/voice-over-generation)

### Purpose
Converts per-scene narration text into WAV audio files and uploads them to Cloudinary. Supports two TTS providers with automatic fallback.

### Entry Point
[`src/index.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/voice-over-generation/src/index.ts) — exports `generateVoiceOvers()`

### Provider Selection & Fallback

```
VOICEOVER_PROVIDER env var → 'gemini' | 'f5'
         ↓
primary = configured, fallback = the other
         ↓
try primary → on any error → try fallback → on error → throw
         ↓
clean temp directory between attempts
```

### Provider: Gemini TTS

**File:** [`src/lib/gemini/gemini-tts-service.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/voice-over-generation/src/lib/gemini/gemini-tts-service.ts)

- **Model:** `gemini-2.5-flash-preview-tts`
- **Request config:** `responseModalities: ["AUDIO"]`, `temperature: 1`, `maxOutputTokens: 32000`
- **Format:** Raw PCM → manually add 44-byte WAV header (24 kHz, 16-bit, mono)
- **WAV header construction:** RIFF/WAVE/fmt/data chunks written via `Buffer.writeUInt32LE` / `writeUInt16LE`
- **Empty narration handling:** Creates 1-second silence WAV (all-zero PCM samples)
- **Text preprocessing:** Collapses whitespace, converts double newlines to `. `
- **Retry logic:** 5 attempts, retryable on HTTP 429/500/503, network errors (`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, "socket hang up", "fetch failed")
- **Voices:** `Puck` (default), `Charon`, `Kore`, `Fenrir`, `Aoede`

**Processing loop (`generateNarrationAudios`):**
```
for each narration[i]:
  if empty → createSilenceAudio(1.0s)
  else    → generateNarrationAudio() → WAV file
  upload WAV to Cloudinary → delete local file
  collect secure URL
```

### Provider: F5-TTS (Open-Source Voice Clone)

**File:** [`src/lib/f5/f5-tts-service.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/voice-over-generation/src/lib/f5/f5-tts-service.ts)

- **Reference Audio**: Uses a pre-bundled sample (`shorter-better-reference-audio.wav` under the worker's `assets/` subdirectory) or an absolute path specified via `F5_REFERENCE_AUDIO_PATH`.
- **Reference Transcription**: Stored in `F5_REFERENCE_TEXT` or defaults to: `"Sounds simple, right? Not quite. There's one detail most people miss..."`.
- **Direct Silence Generation**: Empty or whitespace-only narration segments bypass Python execution entirely. The Node service invokes `createSilenceAudio()` to manually compile a mono, 16-bit, 24kHz PCM WAV file with a 44-byte RIFF header in-memory and write it directly to the filesystem.
- **Text Sanitization Rules**: Prior to inference, narration strings undergo regex cleaning:
  - Strips comment brackets (`\[.*?\]`) and instructions like `[PAUSE...]`.
  - Strips XML/SSML tags (`<[^>]+>`).
  - Converts hyphenated words to space-separated words (`low-latency` $\rightarrow$ `low latency`) to prevent model slurring.
  - Normalizes dashes (`–`, `—`) and styling characters (`_`, `*`, `~`, `` ` ``) to spaces.
  - Collapses repeated punctuation marks (e.g., `...` $\rightarrow$ `.`, `!!!` $\rightarrow$ `!`).
- **Batch Processing Mechanism**: Because model loading is the primary bottleneck (~15–20s initialization overhead), the service aggregates all non-empty narration jobs into a single execution context:
  1. Writes a JSON list (`f5_tts_tasks_[rand].json`) containing `{ text, outputPath }` pairs.
  2. Writes a Python controller script (`f5_tts_batch_[rand].py`) containing task-processing loops.
  3. Spawns `python3` (or `F5_PYTHON_BIN`) as a sub-process.
  4. The Python controller instantiates `F5TTS()` **once**, loops through the JSON tasks, calls `tts.infer()`, and saves the results to the respective output paths using `soundfile.write`.
  5. The Node script monitors process stdout/stderr, handles error signals defensively, deletes temporary json/script files in a `finally` block, uploads the output WAV files to Cloudinary, and removes local audio files from the disk.

---

## 7. Worker: `video-assembler`

**Directory:** [`workers/video-assembler/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/video-assembler)

### Purpose
Merges rendered scene clips with narration audio, background music, optional branding (intro/outro/logo), producing a final H.264 MP4 uploaded to Cloudinary.

### Entry Point
[`src/index.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/video-assembler/src/index.ts) — exports `assembleVideo()`

Auto-selects background music track (`pickBackgroundTrack()`) and branding assets (`getBrandingAssets()`) from bundled assets if not provided.

### Assembly Pipeline (5 Stages)

```
Stage 1: Setup
  → mkdir videos/{videoId}/

Stage 2: Per-scene processing (loop)
  for each clip i:
    ↓ Download scene MP4 from Cloudinary → clip_{i}.mp4
    ↓ Get video duration
    ↓ Get narration audio:
        if narration[i] is non-empty AND narrationAudio[i] exists:
          download narrationAudio[i] → scene_audio_{i}.wav
        else:
          create silence matching clip duration
    ↓ Calculate targetDuration:
        animationStop = animationStopTimes[i] (or narrationDuration if negative/NaN)
        targetDuration = max(animationStop + 0.5s, narrationDuration)
    ↓ normalizeClipWithDuration:
        scale to 1920x1080 (or 1080x1920 for shorts)
        if clip < targetDuration: tpad=stop_mode=clone (freeze last frame)
        trim to targetDuration
        → scene_video_{i}.mp4 (no audio)
    ↓ addAudioToVideo:
        if audio > video: extend video first, then mux
        else: mux with -t {videoDuration}
        → scene_with_audio_{i}.mp4
    ↓ delete clip_{i}.mp4, scene_audio_{i}.wav, scene_video_{i}.mp4
    ↓ collect scene_with_audio_{i}.mp4

Stage 3: Concatenate all scenes
  → FFmpeg concat demuxer (stream-copy first; re-encode fallback on error)
  → combined_video.mp4

Stage 4: Background music
  if music provided:
    Loop music to video length via aloop
    Split into narration portion + outro portion
    Narration BGM volume: 15% (5% for F5)
    Outro BGM volume: 30% (15% for F5)
    F5 mode: boost narration audio 1.5×
    amix narration + BGM → concat with higher-BGM outro section
    → final_audio.mp3
  else:
    generate silence → silence.mp3
  → mux final_audio.mp3 into combined_video.mp4 → combined_with_music.mp4

Stage 5: Branding
  if NOT short AND (intro OR outro):
    normalizeClipWithAudio(intro) + main + normalizeClipWithAudio(outro)
    concat → with_branding.mp4
  if short:
    overlayLogo: scale logo to 120px → overlay at top-right (20px padding) → final.mp4
  else:
    copy combined_with_music.mp4 → final.mp4

Stage 6: Upload
  cloudinaryService.uploadVideo(final.mp4, '{jobId}/videos', 'main-video')
  return { outputUrl: secure_url, duration, clipCount, sceneDurations[] }
```

### Key FFmpeg Parameters

| Operation | Codec | Preset | CRF | Audio |
|-----------|-------|--------|-----|-------|
| Scene normalization | libx264 + x264-params threads=1 | medium | 18 | -an |
| Concat fallback re-encode | libx264 | medium | 18 | aac 192kbps |
| Clip extension | libx264 | medium | 18 | — |
| Final mux | copy (video) | — | — | aac 192kbps 48kHz stereo |
| Logo overlay | libx264 | medium | 18 | copy |

All FFmpeg invocations use `-threads 1` to minimize memory pressure in CI.

---

## 8. Worker: `youtube-upload`

**Directory:** [`workers/youtube-upload/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/youtube-upload)

### Purpose
Downloads the final MP4 from Cloudinary, uploads to YouTube Data API v3, optionally uploads thumbnail, generates chapter timestamps.

### Entry Point
[`src/index.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/youtube-upload/src/index.ts) — exports `uploadToYouTube()`

### Upload Flow

```
1. Generate chapter timestamps (long-form only, if sceneTitles + sceneDurations provided)
   → generateTimestamps(titles, durations, {introTitle, introDuration, outroTitle, outroDuration})
   → Format: "0:00 Intro\n0:08 Section 1\n..."
   → Appended to description: "📚 Chapters:\n..."

2. YouTubeService.upload():
   a. Download video MP4 from Cloudinary → /tmp/youtube/{timestamp}.mp4
   b. (Optional) Download thumbnail → /tmp/youtube/{timestamp}-thumb.jpg
   c. For shorts without explicit scheduledPublishTime:
      → getShortsPublishTimes() from Redis → use Rank 1 (best) time
      → set privacyStatus = 'private'
   d. youtube.videos.insert():
      → snippet: { title, description, tags, categoryId: "28" }
      → status: { privacyStatus, selfDeclaredMadeForKids: false }
      → if isShort: append "#Shorts" tag + "#Shorts" to description
      → if scheduledPublishTime AND privacyStatus='private': status.publishAt = time
   e. (Optional, long-form only) youtube.thumbnails.set()
   f. Cleanup /tmp/youtube/ files
   g. Return YouTube video ID
```

### Shorts Scheduling

Each short is scheduled by rank (matrix `short_index`, capped at 4).

| Rank (0-based) | Default IST Time |
|----------------|-----------------|
| 0 (Best) | 06:45 |
| 1 | 07:45 |
| 2 | 08:45 |
| 3 | 12:00 |
| 4 (Worst) | 14:00 |

Times are configurable via the website dashboard (persisted to Redis `shorts:publish-times`).

IST → UTC conversion formula:
```typescript
const istOffset = 5.5 * 60 * 60 * 1000;  // 5.5h in ms
const utcTime = new Date(istNow.getTime() - istOffset).toISOString();
```

### Timestamp Generator

[`src/utils/timestamp-generator.ts`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/workers/youtube-upload/src/utils/timestamp-generator.ts)

Generates YouTube chapter timestamps from actual scene durations (received from the assembler's `sceneDurations[]` output):
```
0:00 Intro
0:08 Why Caching Breaks
1:45 The Hidden Cost
3:20 Real-World Impact
...
```

---

## 9. Shared Package

**Directory:** [`shared/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/shared)

### `shared/config/index.ts`

[View file](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/shared/config/index.ts)

Centralised configuration object loaded from environment variables. Also exports `validateConfig(required: string[])` which validates listed service configs and calls `process.exit(1)` on missing vars.

```typescript
const config = {
    cloudinary:     { cloudName, apiKey, apiSecret },
    gemini:         { apiKey1, apiKey2, apiKey },
    voiceover:      { provider: 'gemini'|'f5', f5: { referenceAudioPath, referenceText, pythonBin } },
    redis:          { url },
    youtube:        { clientId, clientSecret, refreshToken },
    website:        { domain },
    sceneRendering: { method: 'code'|'ai' },
    video:          { long: { 1920, 1080, 30fps }, short: { 1080, 1920, 30fps } },
    thumbnail:      { enabled: bool },
    workDir:        'videos/'
}
```

### `shared/services/cloudinary-service.ts`

[View file](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/shared/services/cloudinary-service.ts)

Singleton service for all Cloudinary operations (configured once, reused).

**Cloudinary folder convention:**
```
video-gen/
  scenes/                        → rendered scene MP4s
  narrations/{videoId}/part-{N}  → narration WAV/audio files
  {jobId}/videos/main-video      → final assembled MP4
```

Methods: `uploadVideo()`, `uploadAudio()`, `uploadImage()`, `downloadFile()`, `deleteFile()`, `deleteFiles()`, `cleanupJobFiles()`

### `shared/services/shorts-publish-time-service.ts`

[View file](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/shared/services/shorts-publish-time-service.ts)

Redis-backed service managing 5 ranked shorts publish times (IST) and 1 long-form publish time.

**Redis keys:**
| Key | Type | Content |
|-----|------|---------|
| `shorts:publish-times` | String | JSON array of 5 HH:MM times |
| `longform:publish-time` | String | HH:MM time string |
| `pipeline:shorts:{videoId}` | List | JSON results per short (TTL: 7 days) |

---

## 10. Website (Next.js)

**Directory:** [`website/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/website)

### Framework
Next.js 15 (App Router), TypeScript, Tailwind CSS. Deployed on Vercel (`vercel.json`).

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate-script` | POST | **Core.** Gemini call to generate full video script (scenes + shorts). Called by CI `generate-script` job |
| `/api/generate-scene-html` | POST | **AI render mode.** Gemini-generated animated HTML for a scene. Redis queue throttles to 1 Gemini call per 22s |
| `/api/generate-thumbnail` | POST | Generates a thumbnail image via Gemini or image API |
| `/api/pipeline-status` | POST | **Webhook receiver.** Receives run metadata from `pipeline-summary` CI job. Authenticated via `Authorization: Bearer {PIPELINE_WEBHOOK_SECRET}` |
| `/api/ideas-queue` | GET/POST | Read/write the `video:ideas` Redis queue |
| `/api/schedule-times` | GET/POST | Read/write publish schedule times |
| `/api/shorts-publish-time` | GET/POST | Manage ranked shorts publish time slots |
| `/api/settings` | GET/POST | General settings management |
| `/api/trigger-youtube` | POST | Manually trigger GitHub Actions workflow via GitHub API |
| `/api/jobs` | GET | List pipeline job history |
| `/api/cron` | GET | Cron-triggered route (scheduled on Vercel) |
| `/api/push-token` | POST | Register mobile push notification token |
| `/api/auth` | — | NextAuth authentication routes |

### Dashboard (`/dashboard`)

A private admin dashboard (protected by auth) showing:
- Pipeline run history with job status breakdown
- Asset URLs (video, thumbnail, scenes, narrations)
- Idea queue management
- Publish schedule configuration
- Short results list

### Main Page (`page.tsx`)

~920 lines of old pipeline UI code is fully commented out. The current live URL root redirects to `/dashboard`. The old code shows how a web-triggered pipeline was prototyped (polling job status via Redis).

### Authentication

`auth.ts` configures NextAuth. `middleware.ts` protects the `/dashboard` route.

---

## 11. Mobile App (React Native / Expo)

**Directory:** [`mobile-app/dashboard-app/`](file:///c:/Users/susha/OneDrive/Desktop/auto-youtube-channel/mobile-app/dashboard-app)

A React Native companion app built with Expo. Mirrors the web dashboard and registers for push notifications (Expo push token sent to `/api/push-token`) to alert the creator when a pipeline run completes.

---

## 12. Configuration & Secrets Reference

### GitHub Actions Secrets

| Secret | Used By | Description |
|--------|---------|-------------|
| `REDIS_URL` | All jobs | Redis connection URL (Upstash or self-hosted) |
| `GEMINI_API_KEY_1` | `populate-ideas`, `generate-voiceover`, `process-short` | Primary Gemini API key |
| `GEMINI_API_KEY_2` | `generate-voiceover`, `process-short` | Secondary key (key rotation) |
| `CLOUDINARY_CLOUD_NAME` | `render-scenes`, `generate-voiceover`, `assemble-video`, `process-short` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Same | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Same | Cloudinary API secret |
| `YT_CLIENT_ID` | `populate-ideas`, `upload-youtube`, `process-short` | YouTube OAuth 2.0 client ID |
| `YT_CLIENT_SECRET` | Same | YouTube OAuth 2.0 client secret |
| `YT_REFRESH_TOKEN` | Same | YouTube OAuth 2.0 refresh token |
| `PIPELINE_WEBHOOK_SECRET` | `pipeline-summary` | Bearer token for pipeline-status webhook |

### GitHub Actions Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBSITE_DOMAIN` | `http://localhost:3000` | Base URL of the Next.js website |
| `VOICEOVER_PROVIDER` | `gemini` | `gemini` or `f5` |
| `SCENE_RENDER_METHOD` | `code` | `code` or `ai` |

### Local `.env.local`

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
GEMINI_API_KEY_1=
GEMINI_API_KEY_2=         # Optional: enables key rotation
VOICEOVER_PROVIDER=gemini # gemini | f5
SCENE_RENDER_METHOD=code  # code | ai
REDIS_URL=redis://localhost:6379
YT_CLIENT_ID=
YT_CLIENT_SECRET=
YT_REFRESH_TOKEN=
WEBSITE_DOMAIN=http://localhost:3000
PIPELINE_WEBHOOK_SECRET=  # For webhook auth

# Only needed for F5-TTS:
F5_REFERENCE_AUDIO_PATH=
F5_REFERENCE_TEXT=
F5_PYTHON_BIN=python3
```

---

## 13. Data Flow: Full Pipeline Walk-through

### Step 0: Queue Population (`populate-ideas`)

`check-and-populate-ideas.ts` calls `runIdeaSelector()`. Before generating ideas, it reads all current Redis queue entries (`LRANGE video:ideas 0 -1`) and passes them as `existingQueueIdeas` to prevent duplicates. Selected topic string is pushed to `video:ideas` via Redis `RPUSH`.

### Step 1: Script Generation (`generate-script`)

```
1. Initialize Redis rate-limit keys: html_queue:turn=1, html_queue:last_enquiry=0
2. LPOP from video:ideas Redis queue
   (fallback: random from hardcoded VIDEO_IDEAS pool, or custom workflow input)
3. POST /api/generate-script { videoIdea }
4. Website calls Gemini to generate:
   {
     title, description, tags,
     narration,  // full script
     scenes: [{ id, narration, baseDuration, holdDuration, actions[] }],
     shorts: [{ id, hook, scenes[] }]
   }
5. Output: { videoId: "video-{timestamp}", script: VideoScript }
   → written to GITHUB_OUTPUT as JSON
```

### Step 2: Render Scenes (`render-scenes`) — Parallel

For each scene in `script.scenes`:
```
code mode: SceneHtmlRenderer.render({ duration, actions }) → { html, animationStopTime }
 ai mode:  POST /api/generate-scene-html → { html, ticket } → wait for ticket cooldown

→ HtmlToVideoService.render({ html, width, height, fps, duration })
→ Upload scene MP4 to Cloudinary
→ Collect URL, duration, animationStopTime
```

Outputs hex-encoded: `clips_urls`, `clips_timings`, `animation_stop_times`

### Step 3: Generate Voice-Overs (`generate-voiceover`) — Parallel

```
for each scene.narration:
  → Gemini TTS or F5-TTS → WAV file
  → Upload to Cloudinary narrations/{videoId}/part-{N}
  → Collect URL

Output: voiceover_data (hex-encoded JSON array of URLs)
```

### Step 4: Generate Thumbnail (`generate-thumbnail`) — Parallel

```
POST /api/generate-thumbnail { script metadata }
→ Generate image (Gemini / image API)
→ Upload to Cloudinary thumbnails/
Output: thumbnail_url (hex-encoded)
```

### Step 5: Assemble Video (`assemble-video`)

```
Decode: clips_urls, clips_timings, animation_stop_times, voiceover_data

assembleVideo({
  clips: decoded URLs,
  clipTimings, animationStopTimes,
  narrationAudios: decoded URLs,
  isShort: false,
  voiceoverProvider
})

→ Per-scene: download clip + audio, normalize, attach audio
→ Concat all scenes
→ Mix background music (ducked during narration, louder in outro)
→ Upload final.mp4 to Cloudinary

Output: video_url (hex-encoded), scene_durations (hex-encoded)
```

### Step 6: Upload to YouTube (`upload-youtube`)

```
Generate chapter timestamps from scene durations
Download video from Cloudinary → /tmp/youtube/
Download thumbnail from Cloudinary (if exists)
youtube.videos.insert() → YouTube video ID
thumbnails.set() (long-form only)
Cleanup /tmp/youtube/

Output: youtube_id
```

### Parallel: Shorts Processing (`process-short[N]`)

Each short runs independently in its own GitHub Actions runner:

```
short = script.shorts[SHORT_INDEX]
shortId = "{videoId}-short-{N}"

1. Validate hook scene (scenes[0].id = "hook", narration = "", baseDuration 0.8-1.5s)
2. renderScenes({ scenes: short.scenes, isShort: true, videoId: shortId })
3. generateVoiceOvers({ perSceneNarration: allNarrations, videoId: shortId, voice: 'Puck' })
4. assembleVideo({ ..., isShort: true })
5. rank = min(SHORT_INDEX, 4)
   publishTime = getShortsPublishTimeByRank(rank) from Redis
   scheduledPublishTime = IST → UTC conversion
6. uploadToYouTube({ isShort: true, privacyStatus: 'private', scheduledPublishTime })
7. redis.rpush("pipeline:shorts:{videoId}", JSON.stringify(result))
   redis.expire(7 days)
```

### Step 7: Pipeline Summary (`pipeline-summary`)

```
Build payload with all job outputs (decode hex URLs)
Determine overallStatus: 'failure' if any critical job failed

POST $WEBSITE_DOMAIN/api/pipeline-status
  Authorization: Bearer {PIPELINE_WEBHOOK_SECRET}
  Body: {
    overallStatus, videoId, videoTitle, youtubeId,
    videoUrl, thumbnailUrl, description,
    sceneUrls[], voiceoverUrls[], sceneNarrations[],
    shortHooks[], ideasAdded[], scriptData,
    jobs: { populateIdeas, generateScript, renderScenes, ... }
  }
```

---

## 14. Key Design Decisions & Patterns

### Hex-Encoded Job Outputs
Cloudinary URLs often contain patterns GitHub's secret-scanner flags. All asset URLs are hex-encoded before writing to `$GITHUB_OUTPUT` and decoded at the consuming job:
```bash
# Write: echo "var=$(printf '%s' "$url" | xxd -p -c 1000000)" >> $GITHUB_OUTPUT
# Read:  url=$(echo "$var" | xxd -r -p)
```

### Singleton Services
`CloudinaryService` and `GeminiClient` use `static getInstance()` — configured once per process, reused across all calls. Prevents duplicate configuration and parallel SDK initialization.

### `validateConfig()` Guards
Every worker's exported function begins with `validateConfig(['cloudinary', ...])`. Causes a clean `process.exit(1)` with descriptive messages rather than cryptic API errors deep in the call stack.

### stdout vs stderr Convention
- **`console.error()`** — all human-readable logs and progress messages
- **`console.log()`** — only structured output read by GitHub Actions or parent process

This is critical: mixing logs into stdout would corrupt JSON parsing.

### Anti-Hallucination in Idea Selection
The `HybridValidator` enforces deterministic rules on top of AI suggestions:
- **30-day recency window:** Topics identical/similar to recently published videos are eliminated
- **Overuse threshold (2.0×):** Topics covering the same domain too often are eliminated
- **Queue deduplication:** Topics with >60% word overlap to queued ideas are eliminated
- **Fallback:** If all ideas are eliminated, the top 3 by composite AI score are returned without hard rules

### Exponential Backoff Pattern (all Gemini calls)
```typescript
delay = min(BASE_DELAY_MS * 2^(attempt-1), MAX_DELAY_MS) + random(0, 1000ms)
```
5 retries, 2s base, 30s max. Retryable: HTTP 500/503/429, "overloaded", "unavailable", "internal", "fetch failed", network errors.

### AI Scene HTML Rate Limiting
When `SCENE_RENDER_METHOD=ai`, the website's `/api/generate-scene-html` uses Redis-based serialized ticketing:
- Only one scene's HTML is generated at a time
- Each ticket requires a 22-second cooldown before the next one can start
- This prevents hitting Gemini's per-minute request quota during batch scene rendering

### IST-Based Publishing
All publish times stored in IST (UTC+5:30) in Redis for human readability. The CI script converts to UTC at schedule time using millisecond arithmetic. Target audience is primarily India.

---

## 15. Known Issues & Notes

| Issue | Location | Note |
|-------|----------|------|
| Typo: `assests` folder | `video-assembler/src/lib/assests/`, `voice-over-generation/src/assests/` | Should be "assets" — cosmetic only, fully functional |
| Typo: `actios-to-clips.ts` | `video-scene-renderer/src/lib/` | Should be "actions-to-clips" — cosmetic only |
| Typo: `scene-rendring` | `video-scene-renderer/src/lib/scene-rendring/` | Should be "scene-rendering" — cosmetic only |
| Website main page commented out | `website/app/page.tsx` | ~920 lines of old pipeline UI fully commented out; dashboard at `/dashboard` is the live UI |
| `html_queue` Redis keys initialized in script-generation job | `.github/scripts/generate-script.ts:63-64` | Side effect coupling: script generation job resets AI rate-limit queue. Works but mixes concerns |
| F5-TTS no caching | CI workflow | The model downloads fresh each run (~several GB); no GitHub Actions cache used. Major contributor to the 360-minute voiceover timeout |
| `gemini-3-flash-preview` model name | `idea-selector/src/lib/gemini-idea-generator.ts` | May be a typo; verify this is a real, accessible Gemini model name in your project |
| `process-shorts.ts` exists but is unused | `.github/scripts/process-shorts.ts` | Sequential shorts runner kept for reference; `process-single-short.ts` + matrix strategy is what the workflow uses |
| `complete-workflow-with-assets.ts` | repo root | 32 KB local end-to-end test script — not used in CI |
| `scene-rendring-v2.html` | repo root | 70 KB standalone browser prototype of the scene renderer |
| Daily cron disabled | `main.yml:12-13` | Cron trigger is commented out; pipeline only runs via `workflow_dispatch` |
| `voice-clone.ipynb` | repo root | Jupyter notebook for F5-TTS voice cloning experiments — not part of the automated pipeline |

---

*Documentation generated by full end-to-end repository analysis — June 2026.*
