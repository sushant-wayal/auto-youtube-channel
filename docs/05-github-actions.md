# GitHub Actions Pipeline

> Automated video generation with parallel job execution and matrix-based shorts processing

This document covers the GitHub Actions workflow configuration, job structure, data flow, and scripts.

---

## Overview

The pipeline executes jobs in an optimized parallel structure:

```
┌───────────────────────────────────────────────────────────────────────┐
│              GITHUB ACTIONS (workflow_dispatch)                        │
│              Optional cron: '23 0 * * *' (currently commented out)   │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │    populate-ideas      │  timeout: 15 min
                   │    (idea-selector)     │
                   └───────────┬────────────┘
                               │
                               ▼
                   ┌────────────────────────┐
                   │    generate-script     │  timeout: 10 min
                   └──┬──────────┬──────────┘
                      │          │
          ┌───────────┤          ├────────────────────────┐
          │           │          │                        │
          ▼           ▼          ▼                        ▼
┌─────────────┐ ┌──────────┐ ┌───────────────┐  ┌────────────────────┐
│render-scenes│ │gen-voice-│ │gen-thumbnail  │  │ shorts-matrix-setup│
│ (60 min)    │ │over      │ │ (15 min)      │  │ (5 min)            │
│             │ │(360 min) │ └───────┬───────┘  └────────┬───────────┘
└──────┬──────┘ └────┬─────┘        │                   │
       │             │               │                   ▼
       └──────┬──────┘               │      ┌────────────────────────┐
              ▼                      │      │  process-short[0..N]   │
   ┌──────────────────┐              │      │  (matrix, 60 min each) │
   │  assemble-video  │              │      └────────────────────────┘
   │  (60 min)        │              │
   └────────┬─────────┘              │
            │◄───────────────────────┘  (thumbnail_url)
            ▼
   ┌──────────────────┐
   │  upload-youtube  │  timeout: 30 min
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │ pipeline-summary │  always runs (if: always())
   │ (webhook to site)│
   └──────────────────┘
```

**Total wall-clock time: ~90–120 min** (60% faster than sequential due to parallelism)

---

## Workflow Configuration

**File:** `.github/workflows/main.yml`

### Triggers

```yaml
on:
  # Manual trigger with optional custom idea
  workflow_dispatch:
    inputs:
      video_idea:
        description: 'Custom video idea (leave empty to use Redis queue)'
        required: false
        type: string

  # Daily scheduled run — CURRENTLY COMMENTED OUT
  # schedule:
  #   - cron: '23 0 * * *'   # Daily at 00:23 UTC
```

> **Note:** The cron trigger is commented out in the current code. The pipeline runs manually via `workflow_dispatch` only, unless re-enabled.

---

## Jobs

### 1. populate-ideas

**Purpose:** Ensure the Redis ideas queue is populated

```yaml
populate-ideas:
  name: Populate Ideas Queue
  runs-on: ubuntu-latest
  timeout-minutes: 15
  outputs:
    ideas_added: ${{ steps.populate.outputs.ideas_added }}
```

**Script:** `.github/scripts/check-and-populate-ideas.ts`

**Flow:**
1. Read all existing `video:ideas` Redis queue entries (to avoid duplicates)
2. Run 7-step `runIdeaSelector()` with existing queue ideas as context
3. Push selected topic to Redis `RPUSH video:ideas <topic>`
4. Output `ideas_added` (hex-encoded string of added topics)

---

### 2. generate-script

**Purpose:** Generate the full video script from an idea

```yaml
generate-script:
  name: Generate Script
  needs: populate-ideas
  timeout-minutes: 10
  outputs:
    video_id: ${{ steps.script.outputs.video_id }}
    video_title: ${{ steps.script.outputs.video_title }}
    script_data: ${{ steps.script.outputs.script_data }}   # hex-encoded JSON
    num_shorts: ${{ steps.script.outputs.num_shorts }}
```

**Script:** `.github/scripts/generate-script.ts`

**Flow:**
1. Initialize Redis rate-limit keys: `html_queue:turn = 1`, `html_queue:last_enquiry = 0`
2. Idea source priority:
   - If `video_idea` input provided → use it
   - Else → `LPOP` from Redis `video:ideas`
   - Else → random from hardcoded fallback pool
3. POST `$WEBSITE_DOMAIN/api/generate-script` with `{ videoIdea }`
4. Output: `video_id`, `video_title`, `script_data` (hex-encoded JSON)

---

### 3. render-scenes

**Purpose:** Render visual scene clips to Cloudinary

```yaml
render-scenes:
  name: Render Video Scenes
  needs: generate-script
  timeout-minutes: 60
  outputs:
    clips_urls: ${{ steps.scenes.outputs.clips_urls }}             # hex-encoded JSON array
    clips_timings: ${{ steps.scenes.outputs.clips_timings }}       # hex-encoded JSON array
    animation_stop_times: ${{ steps.scenes.outputs.animation_stop_times }} # hex-encoded
```

**System Dependencies (installed by CI):**
```bash
sudo apt-get install -y ffmpeg \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libxcomposite1 libxrandr2 libgbm1 \
  libpangocairo-1.0-0 libasound2t64
# (Chromium libs required for Puppeteer headless rendering)
```

**Script:** `.github/scripts/render-scenes.ts`

Runs in parallel with `generate-voiceover`.

---

### 4. generate-voiceover

**Purpose:** Generate TTS narration audio for all scenes

```yaml
generate-voiceover:
  name: Generate Voice-overs
  needs: generate-script
  timeout-minutes: 360   # 6 hours — F5-TTS model download is slow
  outputs:
    voiceover_data: ${{ steps.voiceover.outputs.voiceover_data }}  # hex-encoded JSON array
```

**System Dependencies (when VOICEOVER_PROVIDER=f5):**
```bash
sudo apt-get install -y ffmpeg python3.11 python3-pip
pip install git+https://github.com/SWivid/F5-TTS.git
```

**Script:** `.github/scripts/generate-voiceover.ts`

Runs in parallel with `render-scenes`. The 360-minute timeout accounts for F5-TTS model download + batch inference.

---

### 5. generate-thumbnail

**Purpose:** Generate AI thumbnail image for the video

```yaml
generate-thumbnail:
  name: Generate Thumbnail
  needs: generate-script
  timeout-minutes: 15
  outputs:
    thumbnail_url: ${{ steps.thumbnail.outputs.thumbnail_url }}  # hex-encoded URL
```

**Script:** `.github/scripts/generate-thumbnail.ts`

Runs independently in parallel with render-scenes and generate-voiceover.

---

### 6. assemble-video

**Purpose:** Combine clips + audio + music + branding into final MP4

```yaml
assemble-video:
  name: Assemble Video
  needs: [generate-script, render-scenes, generate-voiceover]
  timeout-minutes: 60
  outputs:
    video_url: ${{ steps.assemble.outputs.video_url }}            # hex-encoded URL
    scene_durations: ${{ steps.assemble.outputs.scene_durations }} # hex-encoded JSON
```

**System Dependencies:**
```bash
sudo apt-get install -y ffmpeg
```

**Script:** `.github/scripts/assemble-video.ts`

---

### 7. upload-youtube

**Purpose:** Upload long-form video with metadata, chapters, and thumbnail

```yaml
upload-youtube:
  name: Upload to YouTube
  needs: [generate-script, assemble-video, generate-thumbnail]
  timeout-minutes: 30
  outputs:
    youtube_id: ${{ steps.upload.outputs.youtube_id }}
```

**Script:** `.github/scripts/upload-youtube.ts`

---

### 8. shorts-matrix-setup

**Purpose:** Read the number of shorts from script_data and create matrix indices

```yaml
shorts-matrix-setup:
  name: Setup Shorts Matrix
  needs: generate-script
  timeout-minutes: 5
  outputs:
    short_indices: ${{ steps.matrix.outputs.short_indices }}  # e.g., "[0,1,2,3,4]"
```

**Logic:**
```bash
# Decode script_data
SCRIPT=$(echo "$SCRIPT_DATA" | xxd -r -p)
NUM_SHORTS=$(echo "$SCRIPT" | jq '.script.shorts | length')
INDICES=$(python3 -c "import json; print(json.dumps(list(range($NUM_SHORTS))))")
echo "short_indices=$INDICES" >> $GITHUB_OUTPUT
```

---

### 9. process-short (Matrix)

**Purpose:** Run the full mini-pipeline for each short in parallel

```yaml
process-short:
  name: "Process Short #${{ matrix.short_index }}"
  needs: [generate-script, shorts-matrix-setup]
  timeout-minutes: 60
  if: needs.shorts-matrix-setup.outputs.short_indices != '[]'
  strategy:
    fail-fast: false    # One failing short does NOT cancel the others
    matrix:
      short_index: ${{ fromJson(needs.shorts-matrix-setup.outputs.short_indices) }}
```

**System Dependencies:** Same as render-scenes + generate-voiceover combined.

**Script:** `.github/scripts/process-single-short.ts`

**Each short job:**
1. Extract `script.shorts[short_index]` from script_data
2. Validate hook scene: `id="hook"`, `narration=""`, `baseDuration 0.8–1.5s`
3. Render all short scenes (code or ai mode)
4. Generate voiceovers (silence for hook, TTS for content scenes)
5. Assemble short (1080×1920, logo overlay, no intro/outro)
6. `rank = min(short_index, 4)` → fetch `shorts:publish-times[rank]` from Redis
7. Convert IST time → UTC → set `scheduledPublishTime`
8. Upload to YouTube as private + scheduled
9. Store result JSON in Redis `pipeline:shorts:{videoId}` (TTL 7 days)

---

### 10. pipeline-summary

**Purpose:** Log results and send webhook to website

```yaml
pipeline-summary:
  name: Pipeline Summary
  needs: [all other jobs]
  runs-on: ubuntu-latest
  if: always()    # Runs even if previous jobs fail
```

**Actions:**
1. Decode all hex-encoded job outputs
2. Write markdown summary to `$GITHUB_STEP_SUMMARY`
3. Determine `overallStatus = 'success' | 'failure'`
4. POST to `$WEBSITE_DOMAIN/api/pipeline-status`:

```http
POST /api/pipeline-status
Authorization: Bearer {PIPELINE_WEBHOOK_SECRET}
Content-Type: application/json

{
  "overallStatus": "success",
  "videoId": "video-1234567890",
  "videoTitle": "Why Caching is Hard",
  "youtubeId": "dQw4w9WgXcQ",
  "videoUrl": "https://res.cloudinary.com/...",
  "thumbnailUrl": "https://res.cloudinary.com/...",
  "description": "Full description with chapters...",
  "sceneUrls": ["https://...", "https://..."],
  "voiceoverUrls": ["https://...", "https://..."],
  "sceneNarrations": ["Scene 1 text...", "Scene 2 text..."],
  "shortHooks": ["Did you know...", "Most developers..."],
  "ideasAdded": ["Why Caching is Hard"],
  "scriptData": { ... },
  "jobs": {
    "populateIdeas": "success",
    "generateScript": "success",
    "renderScenes": "success",
    "generateVoiceover": "success",
    "assembleLongForm": "success",
    "generateThumbnail": "success",
    "uploadYoutube": "success",
    "shortsProcessing": "success"
  }
}
```

---

## GitHub Secrets and Variables

### Repository Secrets

Add in **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Used By | Purpose |
|--------|---------|---------|
| `REDIS_URL` | All jobs | Redis connection URL |
| `GEMINI_API_KEY_1` | populate-ideas, gen-voiceover, process-short | Primary Gemini API key |
| `GEMINI_API_KEY_2` | gen-voiceover, process-short | Secondary Gemini key (key rotation) |
| `CLOUDINARY_CLOUD_NAME` | render-scenes, gen-voiceover, assemble-video, process-short | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Same | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Same | Cloudinary API secret |
| `YT_CLIENT_ID` | populate-ideas, upload-youtube, process-short | YouTube OAuth client ID |
| `YT_CLIENT_SECRET` | Same | YouTube OAuth client secret |
| `YT_REFRESH_TOKEN` | Same | YouTube OAuth refresh token (long-lived) |
| `PIPELINE_WEBHOOK_SECRET` | pipeline-summary | Bearer token for webhook authentication |

### Repository Variables

Add in **Settings → Secrets and variables → Actions → Variables**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `WEBSITE_DOMAIN` | `http://localhost:3000` | Base URL of the Next.js website (used to call API) |
| `VOICEOVER_PROVIDER` | `gemini` | `gemini` or `f5` |
| `SCENE_RENDER_METHOD` | `code` | `code` or `ai` |

---

## Cross-Job Data Transfer

### Hex Encoding Pattern

GitHub Actions job outputs have a size limit and their content can trigger GitHub's secret-scanner (which blocks Cloudinary URLs that match patterns like API keys). All asset URLs and large JSON are hex-encoded:

```bash
# Producer job: encode and write to GITHUB_OUTPUT
JSON='{"clips":["https://res.cloudinary.com/...","..."]}'
echo "clips_urls=$(printf '%s' "$JSON" | xxd -p -c 1000000)" >> $GITHUB_OUTPUT

# Consumer job: decode from previous job output
JSON=$(echo "${{ needs.render-scenes.outputs.clips_urls }}" | xxd -r -p)
```

This is used for: `script_data`, `clips_urls`, `clips_timings`, `animation_stop_times`, `voiceover_data`, `thumbnail_url`, `video_url`, `scene_durations`, `ideas_added`.

### Script Data Flow

`script_data` is the central data object flowing through the pipeline:

```
generate-script → (hex) → render-scenes
                        → generate-voiceover
                        → generate-thumbnail
                        → shorts-matrix-setup
                        → process-short[N]
                        → assemble-video
                        → upload-youtube
                        → pipeline-summary
```

Contents:
```json
{
  "videoId": "video-1234567890",
  "script": {
    "title": "Why Caching Breaks Production",
    "description": "...",
    "tags": ["caching", "redis", "backend"],
    "narration": "Full narration text...",
    "scenes": [ ... ],
    "shorts": [ ... ]
  }
}
```

---

## Error Handling

### Job Failure Behavior

| Job | On Failure |
|-----|-----------|
| Any upstream job | All dependent jobs are cancelled automatically |
| `process-short[N]` | `fail-fast: false` — other shorts continue processing |
| `pipeline-summary` | `if: always()` — always runs, even if all jobs failed |

### Timeout Reference

| Job | Timeout | Why |
|-----|---------|-----|
| populate-ideas | 15 min | Trend fetching + Gemini calls |
| generate-script | 10 min | Single Gemini API call to website |
| render-scenes | 60 min | Puppeteer + FFmpeg per scene (sequential) |
| generate-voiceover | **360 min** | F5-TTS model download + batch inference |
| generate-thumbnail | 15 min | Single API call |
| assemble-video | 60 min | FFmpeg assembly of all scenes |
| upload-youtube | 30 min | YouTube upload + thumbnail |
| process-short[N] | 60 min | Full mini-pipeline per short |

---

## Script Files Reference

```
.github/scripts/
├── check-and-populate-ideas.ts   # Job: populate-ideas
├── generate-script.ts            # Job: generate-script (also inits Redis rate-limit keys)
├── render-scenes.ts              # Job: render-scenes
├── generate-voiceover.ts         # Job: generate-voiceover
├── assemble-video.ts             # Job: assemble-video
├── generate-thumbnail.ts         # Job: generate-thumbnail
├── upload-youtube.ts             # Job: upload-youtube
├── process-single-short.ts       # Job: process-short (matrix — ACTIVE)
└── process-shorts.ts             # Legacy sequential shorts runner (NOT used in CI)
```

---

## Manual Trigger

1. Go to **Actions** tab in GitHub
2. Select **Daily Video Generation Pipeline** workflow
3. Click **Run workflow**
4. Optionally enter a custom `video_idea` string
5. Click **Run workflow** button

---

## Monitoring

### Job Logs

1. Go to **Actions** tab
2. Click on the workflow run
3. Click on a specific job to see step-by-step logs
4. Note: all progress messages come from `stderr` (console.error), so they appear as normal log output

### Pipeline Summary

Each run generates a markdown summary at: **Actions → Run → Summary**

### Dashboard Webhook

The `pipeline-summary` job sends all results to `$WEBSITE_DOMAIN/api/pipeline-status`. The website dashboard displays real-time pipeline results including:
- YouTube video ID and URL
- All scene clip URLs
- Voiceover audio URLs
- Short results with scheduled publish times
- Per-job status breakdown

---

## Local Testing

```bash
# Test generate-script with environment variables
WEBSITE_DOMAIN=http://localhost:3000 \
REDIS_URL=redis://localhost:6379 \
npx tsx .github/scripts/generate-script.ts "Why Redis is Misused"

# Test render-scenes (requires ffmpeg + chromium)
CLOUDINARY_CLOUD_NAME=xxx \
CLOUDINARY_API_KEY=xxx \
CLOUDINARY_API_SECRET=xxx \
SCENE_RENDER_METHOD=code \
npx tsx .github/scripts/render-scenes.ts
```

---

## Next: [06-website-api.md](./06-website-api.md)
