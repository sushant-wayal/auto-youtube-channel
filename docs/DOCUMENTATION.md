# Video Generation Pipeline - Complete Documentation

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

1. **Generates video ideas** using AI with YouTube analytics
2. **Creates scripts** with AI, including scene breakdowns and narration
3. **Renders visual scenes** programmatically using HTML5 Canvas + Puppeteer
4. **Generates AI voice-overs** with Gemini TTS
5. **Assembles videos** with FFmpeg (scenes + voiceover + music + intro/outro)
6. **Generates thumbnails** with AI
7. **Uploads to YouTube** with chapters, tags, and scheduled publishing
8. **Creates shorts** (5 per long-form video) with ranked schedule times

The entire pipeline runs automatically via **GitHub Actions** cron jobs.

### Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| Pipeline Orchestration | GitHub Actions | Daily cron execution |
| AI Script Generation | Gemini AI | Content creation |
| Text-to-Speech | Gemini TTS | Voice-over narration |
| Video Rendering | Puppeteer + HTML5 Canvas | Scene visualization |
| Video Processing | FFmpeg | Assembly and encoding |
| Asset Storage | Cloudinary | Video/audio/image CDN |
| Video Hosting | YouTube API | Publishing |
| Queue Management | Redis | Ideas queue |
| Web Dashboard | Next.js 16 | Management UI |
| Mobile Dashboard | React Native + Expo 54 | Mobile management |

---

## Architecture

### Repository Structure

```
video-generation-on-worker/
├── .github/
│   ├── workflows/
│   │   └── main.yml              # GitHub Actions pipeline
│   └── scripts/                  # Pipeline step scripts
│       ├── check-and-populate-ideas.ts
│       ├── generate-script.ts
│       ├── render-scenes.ts
│       ├── generate-voiceover.ts
│       ├── assemble-video.ts
│       ├── generate-thumbnail.ts
│       ├── upload-youtube.ts
│       ├── process-shorts.ts
│       └── process-single-short.ts
│
├── workers/                      # Core processing workers
│   ├── idea-selector/            # AI idea generation
│   ├── video-scene-renderer/     # Visual scene rendering
│   ├── voice-over-generation/    # TTS audio generation
│   ├── video-assembler/          # FFmpeg video assembly
│   └── youtube-upload/           # YouTube API integration
│
├── shared/                       # Shared utilities
│   ├── config/
│   │   └── index.ts             # Centralized configuration
│   └── services/
│       ├── cloudinary-service.ts
│       └── shorts-publish-time-service.ts
│
├── website/                      # Next.js dashboard
│   ├── app/
│   │   ├── api/                 # API routes
│   │   └── dashboard/           # Dashboard UI
│   └── lib/
│       ├── ai/                  # AI services
│       └── pipeline/            # Pipeline utilities
│
├── mobile-app/
│   └── dashboard-app/           # React Native app
│
└── docs/                        # Documentation (you are here)
```

### Monorepo Configuration

This is an npm workspaces monorepo:

```json
{
  "workspaces": {
    "packages": ["workers/*", "shared"]
  }
}
```

---

## Component Documentation

| Document | Description |
|----------|-------------|
| [01-workers.md](./01-workers.md) | Worker architecture and APIs |
| [02-scene-rendering.md](./02-scene-rendering.md) | Visual scene rendering system |
| [03-video-assembly.md](./03-video-assembly.md) | FFmpeg video assembly |
| [04-ai-integrations.md](./04-ai-integrations.md) | Gemini AI and TTS |
| [05-github-actions.md](./05-github-actions.md) | Pipeline automation |
| [06-website-api.md](./06-website-api.md) | Website and API routes |
| [07-mobile-app.md](./07-mobile-app.md) | Mobile dashboard app |
| [08-types-schema.md](./08-types-schema.md) | TypeScript types and data schemas |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- FFmpeg (installed on system)
- Redis server (local or cloud)
- Google Cloud account (Gemini API)
- YouTube API credentials
- Cloudinary account

### Installation

```bash
# Clone repository
git clone <repo-url>
cd video-genration-on-worker

# Install all dependencies (workspaces)
npm install

# Build all workers
npm run build
```

### Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Gemini AI (dual-key rotation for rate limiting)
GEMINI_API_KEY_1=your_key_1
GEMINI_API_KEY_2=your_key_2

# Redis
REDIS_URL=redis://localhost:6379

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# YouTube API
YT_CLIENT_ID=your_client_id
YT_CLIENT_SECRET=your_client_secret
YT_REFRESH_TOKEN=your_refresh_token

# Website domain (for API calls)
WEBSITE_DOMAIN=https://your-domain.com

# Optional
ENABLE_THUMBNAIL_GENERATION=true
```

### GitHub Secrets

For GitHub Actions, add these secrets:
- All environment variables above
- Same variables used in GitHub Actions workflow

---

## Pipeline Flow

### Complete Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    GITHUB ACTIONS CRON (Daily at Midnight UTC)       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  1. POPULATE IDEAS                                                   │
│     • Check if Redis ideas queue is empty                           │
│     • If empty: run idea-selector worker                            │
│       - Fetch YouTube channel analytics                             │
│       - Use Gemini AI to analyze performance                        │
│       - Generate 5-10 topic ideas                                   │
│       - Apply hybrid validation (AI + rules)                        │
│       - Push validated ideas to Redis queue                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. GENERATE SCRIPT                                                  │
│     • Pop next idea from Redis queue (LPOP)                         │
│     • Call website API /api/generate-script                         │
│     • Gemini AI generates complete video script:                    │
│       - Title, description, tags                                    │
│       - Narration text                                              │
│       - 5-10 scenes with:                                           │
│         * Scene title (for YouTube chapters)                        │
│         * Theme (light/dark)                                        │
│         * Duration and hold time                                    │
│         * Visual actions (primitives)                               │
│         * Per-scene narration                                       │
│       - 5 shorts with hook + content scenes                         │
│     • Output: video_id, script_data JSON                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│ 3a. RENDER    │    │ 3b. GENERATE  │    │ 3c. GENERATE  │
│    SCENES     │    │   VOICEOVER   │    │   THUMBNAIL   │
│               │    │               │    │               │
│ • Parse scene │    │ • Extract     │    │ • AI image    │
│   actions     │    │   narrations  │    │   generation  │
│ • Convert to  │    │ • Gemini TTS  │    │ • Upload to   │
│   HTML+Canvas │    │   per scene   │    │   Cloudinary  │
│ • Puppeteer   │    │ • API key     │    │               │
│   capture     │    │   rotation    │    │               │
│ • FFmpeg      │    │ • Upload to   │    │               │
│   encode      │    │   Cloudinary  │    │               │
│ • Upload to   │    │               │    │               │
│   Cloudinary  │    │               │    │               │
│               │    │               │    │               │
│ Output:       │    │ Output:       │    │ Output:       │
│ • clip_urls   │    │ • audio_urls  │    │ • thumb_url   │
│ • timings     │    │               │    │               │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └──────────┬─────────┘                    │
                   ▼                              │
┌─────────────────────────────────────────────────┤
│  4. ASSEMBLE VIDEO                              │
│     • Download all clips and voiceovers         │
│     • FFmpeg operations:                        │
│       - Concatenate scene clips                 │
│       - Mix voiceover audio                     │
│       - Add background music (with ducking)     │
│       - Add 8-second intro                      │
│       - Add 8-second outro                      │
│     • Track scene durations for chapters        │
│     • Upload final video to Cloudinary          │
│     • Output: video_url, scene_durations[]      │
└──────────────────────────────┬──────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. UPLOAD TO YOUTUBE                                                │
│     • Generate chapter timestamps from scene durations              │
│       Example: 0:00 Intro, 0:08 Scene 1, 0:46 Scene 2...            │
│     • Build video description with chapters                         │
│     • Set thumbnail                                                  │
│     • Schedule publish time (18:30 IST for long-form)               │
│     • Set privacy to 'private' (public at scheduled time)           │
│     • Output: youtube_video_id                                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. PROCESS SHORTS (Matrix: 5 parallel jobs)                         │
│     For each short (1-5):                                            │
│     • Render 2 short scenes (hook + content)                        │
│     • Generate voiceovers (silent for hook)                         │
│     • Assemble short video with logo overlay                        │
│     • Upload with ranked schedule time:                              │
│       - Short 1 → Rank 1 (16:30 IST - best time)                    │
│       - Short 2 → Rank 2 (18:00 IST)                                │
│       - Short 3 → Rank 3 (20:00 IST)                                │
│       - Short 4 → Rank 4 (12:00 IST)                                │
│       - Short 5 → Rank 5 (14:00 IST - worst time)                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. PIPELINE SUMMARY                                                 │
│     • Send webhook to website with results                          │
│     • Display all video IDs and URLs                                 │
│     • Log scheduled publish times                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Timing Breakdown

| Step | Duration | Notes |
|------|----------|-------|
| Populate Ideas | ~1 min | Only if queue empty |
| Generate Script | ~2 min | AI generation |
| Render Scenes | ~60 min | Parallel with voiceover |
| Generate Voiceover | ~30 min | Parallel with rendering |
| Generate Thumbnail | ~5 min | Parallel |
| Assemble Video | ~15 min | Sequential |
| Upload YouTube | ~10 min | Sequential |
| Process Shorts | ~60 min | 5 parallel jobs |
| **Total** | **~90 min** | 40% faster than sequential |

---

## Quick Reference

### Redis Keys

| Key | Type | Description |
|-----|------|-------------|
| `video:ideas` | List | Queue of video topic ideas |
| `shorts:schedule:times` | List | Ranked schedule times for shorts |
| `longform:schedule:time` | String | Long-form video publish time |

### Cloudinary Folders

| Folder | Content |
|--------|---------|
| `video-pipeline/clips/{videoId}/` | Rendered scene clips |
| `video-pipeline/voiceovers/{videoId}/` | Generated voiceovers |
| `video-pipeline/videos/{videoId}/` | Assembled videos |
| `video-pipeline/thumbnails/{videoId}/` | Generated thumbnails |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-script` | POST | Generate video script from idea |
| `/api/ideas-queue` | GET/POST | Manage ideas queue |
| `/api/schedule-times` | GET/POST | Manage schedule times |
| `/api/pipeline-status` | POST | Receive pipeline webhook |
| `/api/generate-thumbnail` | POST | Generate AI thumbnail |

---

## Next Steps

1. Read [01-workers.md](./01-workers.md) to understand the worker architecture
2. Review [08-types-schema.md](./08-types-schema.md) for data structure details
3. Check [05-github-actions.md](./05-github-actions.md) for deployment configuration
