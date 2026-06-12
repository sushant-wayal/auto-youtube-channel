# Video Generation Pipeline — Complete Documentation

> Fully automated AI-powered video generation and YouTube publishing system

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Component Documentation](#component-documentation)
4. [Getting Started](#getting-started)
5. [Pipeline Flow](#pipeline-flow)

---

## Overview

This repository implements an **end-to-end automated video generation pipeline** that:

1. **Generates video ideas** using AI with YouTube analytics and trending signals (YouTube, Hacker News, Reddit)
2. **Creates scripts** with AI, including scene breakdowns and narration (via Website API)
3. **Renders visual scenes** programmatically using HTML5 Canvas + Puppeteer (code mode) **or** Gemini AI (AI mode)
4. **Generates AI voice-overs** with Gemini TTS or F5-TTS (open-source voice clone)
5. **Assembles videos** with FFmpeg (scenes + voiceover + background music with ducking + intro/outro + logo)
6. **Generates thumbnails** with AI
7. **Uploads to YouTube** with chapters, tags, and scheduled publishing (IST-based)
8. **Creates shorts** (3–5 per long-form video) with per-rank scheduled publish times

The entire pipeline runs automatically via **GitHub Actions** triggered manually or via cron.

### Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------| 
| Pipeline Orchestration | GitHub Actions | `workflow_dispatch` + optional cron |
| AI Script Generation | Gemini AI (`gemini-3-flash-preview`) | Content creation |
| Text-to-Speech (primary) | Gemini TTS (`gemini-2.5-flash-preview-tts`) | Voice-over narration |
| Text-to-Speech (alternate) | F5-TTS (Python, open-source) | Voice clone narration |
| Video Rendering | Puppeteer + HTML5 Canvas | Scene visualization (code mode) |
| AI Scene HTML | Gemini AI | Scene visualization (ai mode) |
| Video Processing | FFmpeg | Assembly, encoding, mixing |
| Asset Storage | Cloudinary | Video / audio / image CDN |
| Video Hosting | YouTube Data API v3 | Publishing |
| Queue Management | Redis (ioredis) | Ideas queue, publish times, rate-limit |
| Web Dashboard | Next.js 15 (App Router) | Management UI + API endpoints |
| Mobile Dashboard | React Native + Expo | Mobile alerts + management |

---

## Architecture

### Repository Structure

```
auto-youtube-channel/
├── .github/
│   ├── workflows/
│   │   └── main.yml              # GitHub Actions pipeline (workflow_dispatch trigger)
│   └── scripts/                  # Entry-point TypeScript scripts for each job
│       ├── check-and-populate-ideas.ts
│       ├── generate-script.ts
│       ├── render-scenes.ts
│       ├── generate-voiceover.ts
│       ├── assemble-video.ts
│       ├── generate-thumbnail.ts
│       ├── upload-youtube.ts
│       ├── process-shorts.ts         # Legacy (sequential) — not used in CI
│       └── process-single-short.ts   # Active: per-short matrix job
│
├── workers/                      # npm workspace packages (one per concern)
│   ├── idea-selector/            # AI idea generation (7-step hybrid pipeline)
│   ├── video-scene-renderer/     # Scene → MP4 (Puppeteer + FFmpeg, or AI mode)
│   ├── voice-over-generation/    # TTS narration (Gemini TTS + F5-TTS fallback)
│   ├── video-assembler/          # FFmpeg final video assembly
│   └── youtube-upload/           # YouTube Data API v3 upload + scheduling
│
├── shared/                       # Shared TypeScript package
│   ├── config/index.ts           # Centralized env-var config + validateConfig()
│   └── services/
│       ├── cloudinary-service.ts           # Singleton Cloudinary client
│       └── shorts-publish-time-service.ts  # Redis-backed IST publish schedule
│
├── website/                      # Next.js 15 dashboard + API
│   ├── app/
│   │   ├── api/                  # 13 REST endpoints
│   │   └── dashboard/            # Private admin dashboard (auth-protected)
│   └── ...
│
├── mobile-app/
│   └── dashboard-app/            # React Native + Expo companion app
│
└── docs/                         # Documentation (you are here)
```

### Monorepo Configuration

```json
{
  "workspaces": {
    "packages": ["workers/*", "shared"],
    "nohoist": ["mobile-app/**"]
  }
}
```

---

## Component Documentation

| Document | Description |
|----------|-------------|
| [01-workers.md](./01-workers.md) | Worker architecture, APIs, and 7-step idea pipeline |
| [02-scene-rendering.md](./02-scene-rendering.md) | Visual scene rendering system (code + AI modes) |
| [03-video-assembly.md](./03-video-assembly.md) | FFmpeg video assembly, audio mixing, branding |
| [04-ai-integrations.md](./04-ai-integrations.md) | Gemini AI, F5-TTS, retry logic, scoring formula |
| [05-github-actions.md](./05-github-actions.md) | Pipeline jobs, secrets, hex-encoding, webhook |
| [06-website-api.md](./06-website-api.md) | Website structure and all 13 API routes |
| [07-mobile-app.md](./07-mobile-app.md) | Mobile dashboard app |
| [08-types-schema.md](./08-types-schema.md) | TypeScript types and data schemas |
| [09-advanced-features.md](./09-advanced-features.md) | In-depth mechanics of F5-TTS and Redis AI scene queue |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- FFmpeg (installed on system)
- Redis server (local or cloud — Upstash recommended for CI)
- Google Cloud account (Gemini API — two keys recommended for rotation)
- YouTube API credentials (OAuth 2.0 with refresh token)
- Cloudinary account

### Installation

```bash
# Clone repository
git clone <repo-url>
cd auto-youtube-channel

# Install all dependencies (workspaces)
npm install

# Build all workers
npm run build
```

### Environment Setup

Create `.env.local` at the repository root:

```bash
# Gemini AI (dual-key rotation for rate limiting)
GEMINI_API_KEY_1=your_key_1
GEMINI_API_KEY_2=your_key_2          # Optional: enables key rotation

# Voice-over provider
VOICEOVER_PROVIDER=gemini            # gemini | f5

# Scene render mode
SCENE_RENDER_METHOD=code             # code | ai

# Redis
REDIS_URL=redis://localhost:6379

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# YouTube OAuth
YT_CLIENT_ID=your_client_id
YT_CLIENT_SECRET=your_client_secret
YT_REFRESH_TOKEN=your_refresh_token

# Website domain (for API calls from CI)
WEBSITE_DOMAIN=https://your-domain.com

# Webhook authentication
PIPELINE_WEBHOOK_SECRET=your_secret

# F5-TTS only (skip if using Gemini TTS)
F5_REFERENCE_AUDIO_PATH=/path/to/reference.wav
F5_REFERENCE_TEXT="Reference text..."
F5_PYTHON_BIN=python3
```

### GitHub Configuration

**Secrets** (Settings → Secrets and Variables → Actions):
`REDIS_URL`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`, `PIPELINE_WEBHOOK_SECRET`

**Variables** (Settings → Secrets and Variables → Actions):
`WEBSITE_DOMAIN`, `VOICEOVER_PROVIDER`, `SCENE_RENDER_METHOD`

---

## Pipeline Flow

### Complete Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                 GITHUB ACTIONS (workflow_dispatch)                   │
│               Optional: cron '23 0 * * *' (commented)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. POPULATE IDEAS (timeout: 15 min)                                 │
│     • Read existing Redis queue (to prevent duplicates)             │
│     • 7-step hybrid pipeline:                                       │
│       - Fetch trending (YouTube S&T, HN, Reddit) — concurrent       │
│       - Fetch 50 recent channel videos + 90-day analytics           │
│       - Gemini: analyze channel performance                         │
│       - Gemini: generate 15 raw topic ideas with scores             │
│       - Hard elimination (30-day window, 2x overuse, queue dedupe)  │
│       - Formula ranking → top 5 hybrid scored ideas                 │
│       - Gemini: final pick from top 5                               │
│     • Push selected topic to Redis (video:ideas)                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. GENERATE SCRIPT (timeout: 10 min)                                │
│     • Init Redis rate-limit keys (for AI scene mode)                │
│     • LPOP from Redis video:ideas queue                             │
│     • POST /api/generate-script → Gemini AI generates:             │
│       - Title, description, tags                                    │
│       - Per-scene narration + visual actions (ActionIR)             │
│       - 3–5 shorts with hook scenes + content scenes                │
│     • Output: video_id, script_data (hex-encoded JSON)              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ 3a. RENDER    │    │ 3b. GENERATE  │    │ 3c. GENERATE  │
│    SCENES     │    │   VOICEOVER   │    │   THUMBNAIL   │
│  (60 min)     │    │  (360 min)    │    │   (15 min)    │
│               │    │               │    │               │
│ For each      │    │ For each      │    │ POST          │
│ scene:        │    │ scene         │    │ /api/generate │
│ code mode:    │    │ narration:    │    │ -thumbnail    │
│  ActionIR →   │    │ Gemini TTS    │    │               │
│  HTML+Canvas  │    │ or F5-TTS     │    │ Output:       │
│ ai mode:      │    │ → WAV file    │    │ thumbnail_url │
│  /api/generate│    │ → Cloudinary  │    │ (hex)         │
│  -scene-html  │    │               │    │               │
│ → Puppeteer   │    │ With fallback:│    │               │
│ → FFmpeg      │    │ primary fails │    │               │
│ → Cloudinary  │    │ → other runs  │    │               │
│               │    │               │    │               │
│ Output:       │    │ Output:       │    │               │
│ clips_urls    │    │ voiceover_    │    │               │
│ clip_timings  │    │ data (hex)    │    │               │
│ anim_stops    │    │               │    │               │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └──────────┬─────────┘                    │
                   ▼                              │
┌─────────────────────────────────────────────────┤
│  4. ASSEMBLE VIDEO (timeout: 60 min)            │
│     • Per-scene: download clip + narration WAV  │
│     • Normalize duration: max(animStop+0.5, TTS)│
│     • Attach narration audio per scene          │
│     • Concat all scenes (stream-copy → re-enc)  │
│     • Mix background music:                     │
│       - 15% vol during narration (5% for F5)    │
│       - 30% vol during outro (15% for F5)       │
│     • Add intro + outro (long-form only)        │
│     • Add logo overlay (shorts only, top-right) │
│     • Upload final.mp4 to Cloudinary            │
│     • Output: video_url, scene_durations (hex)  │
└──────────────────────────────┬──────────────────┘
                               │                 ▲
                               │                 │ thumbnail_url
                               ▼                 │
┌─────────────────────────────────────────────────────────────────────┐
│  5. UPLOAD TO YOUTUBE (timeout: 30 min)                              │
│     • Generate chapter timestamps (long-form only):                 │
│       "0:00 Intro\n0:08 Scene 1\n..."                               │
│     • Download video + thumbnail from Cloudinary                    │
│     • youtube.videos.insert():                                      │
│       - categoryId=28 (Science & Technology)                        │
│       - privacyStatus='private' + publishAt for scheduled upload    │
│     • thumbnails.set() (long-form only)                             │
│     • Publish time: longform:publish-time from Redis (default 18:30)│
│     • Output: youtube_id                                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
   ┌───────────────────────────┤ (parallel with above, after script)
   │                           │
   ▼                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│  6. PROCESS SHORTS (Matrix: N parallel jobs, one per short)          │
│     Each short job (process-single-short.ts):                        │
│     • Validate hook scene (id="hook", empty narration, 0.8–1.5s dur)│
│     • Render all short scenes (same code/ai dual mode)              │
│     • Generate voiceovers (silence for hook scene)                  │
│     • Assemble short (1080×1920, logo overlay, no intro/outro)      │
│     • rank = min(short_index, 4)                                    │
│     • Schedule: shorts:publish-times[rank] from Redis               │
│       Default: [06:45, 07:45, 08:45, 12:00, 14:00] IST             │
│     • Upload as private with scheduledPublishTime                   │
│     • Store result in Redis pipeline:shorts:{videoId} (TTL 7d)     │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. PIPELINE SUMMARY (always runs)                                   │
│     • Collect all job outputs                                        │
│     • Write GitHub step summary                                      │
│     • POST /api/pipeline-status (Bearer webhook auth)               │
│       with: videoId, youtubeId, videoUrl, thumbnailUrl,             │
│       sceneUrls, voiceoverUrls, sceneNarrations, shortHooks,        │
│       shorts[], job statuses                                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Timing Breakdown

| Step | Timeout | Notes |
|------|---------|-------|
| Populate Ideas | 15 min | Only if queue empty; trend fetching is concurrent |
| Generate Script | 10 min | Gemini via website API |
| Render Scenes | 60 min | Parallel with voiceover; Puppeteer + FFmpeg per scene |
| Generate Voiceover | 360 min | Parallel with rendering; F5 model load is slow |
| Generate Thumbnail | 15 min | Independent parallel job |
| Assemble Video | 60 min | Sequential (needs clips + audio) |
| Upload YouTube | 30 min | Sequential (needs assembled video) |
| Process Shorts | 60 min | N parallel matrix jobs |

---

## Quick Reference

### Redis Keys

| Key | Type | Description |
|-----|------|-------------|
| `video:ideas` | List | Queue of video topic strings |
| `shorts:publish-times` | String (JSON) | Array of 5 HH:MM IST times, rank 1–5 |
| `longform:publish-time` | String | HH:MM IST time for long-form videos |
| `pipeline:shorts:{videoId}` | List | Short results per run (TTL 7 days) |
| `html_queue:turn` | String | AI scene rate-limit queue counter |
| `html_queue:processing` | String | AI scene processing lease |
| `html_queue:last_enquiry` | String | Timestamp of last AI scene request |

### Cloudinary Folders

| Folder | Content |
|--------|---------|
| `video-gen/scenes/` | Rendered scene MP4 clips |
| `video-gen/narrations/{videoId}/part-{N}` | Narration WAV audio |
| `video-gen/{jobId}/videos/main-video` | Final assembled MP4 |

### Default Publish Times (IST)

| Slot | Default | Type |
|------|---------|------|
| Long-form | 18:30 | Fixed |
| Short Rank 1 (best) | 06:45 | Configurable |
| Short Rank 2 | 07:45 | Configurable |
| Short Rank 3 | 08:45 | Configurable |
| Short Rank 4 | 12:00 | Configurable |
| Short Rank 5 | 14:00 | Configurable |

### API Endpoints (All 13)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-script` | POST | Generate video script from idea |
| `/api/generate-scene-html` | POST | AI-generated animated HTML for a scene (rate-limited) |
| `/api/generate-thumbnail` | POST | Generate AI thumbnail |
| `/api/pipeline-status` | GET/POST | Get status / receive pipeline webhook |
| `/api/ideas-queue` | GET/POST | Manage ideas queue |
| `/api/schedule-times` | GET/POST | Manage schedule times |
| `/api/shorts-publish-time` | GET/POST | Manage shorts publish slots |
| `/api/settings` | GET/POST | General settings |
| `/api/trigger-youtube` | POST | Manually trigger GitHub Actions workflow |
| `/api/jobs` | GET | List pipeline job history |
| `/api/cron` | GET | Vercel cron-triggered route |
| `/api/push-token` | POST | Register mobile push notification token |
| `/api/auth` | — | NextAuth authentication |

---

## Next Steps

1. Read [01-workers.md](./01-workers.md) to understand the worker architecture
2. Review [08-types-schema.md](./08-types-schema.md) for data structure details
3. Check [05-github-actions.md](./05-github-actions.md) for deployment configuration
4. See [09-advanced-features.md](./09-advanced-features.md) for F5-TTS and Redis queue mechanics
