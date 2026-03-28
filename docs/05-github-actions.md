# GitHub Actions Pipeline

> Automated daily video generation with parallel job execution

This document covers the GitHub Actions workflow configuration and scripts.

---

## Overview

The pipeline runs daily via cron and executes jobs in an optimized parallel structure:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DAILY CRON (0:00 UTC)                              │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │    Populate Ideas      │
                    │    (1-5 min)           │
                    └───────────┬────────────┘
                                │
                                ▼
                    ┌────────────────────────┐
                    │   Generate Script      │
                    │    (2 min)             │
                    └───────────┬────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ Render Scenes │     │ Gen Voiceover │     │ Gen Thumbnail │
│   (60 min)    │     │   (30 min)    │     │   (5 min)     │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        └──────────┬──────────┘                     │
                   ▼                                │
          ┌───────────────┐                         │
          │ Assemble Video│  ◄──────────────────────┘
          │   (15 min)    │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │ Upload YouTube│
          │   (10 min)    │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │Process Shorts │  (Matrix: 5 parallel jobs)
          │   (60 min)    │
          └───────┬───────┘
                  │
                  ▼
          ┌───────────────┐
          │Pipeline Summary│
          └───────────────┘
```

**Total Time: ~90 minutes** (40% faster than sequential)

---

## Workflow Configuration

### File Location

`.github/workflows/main.yml`

### Triggers

```yaml
on:
  # Manual trigger with optional custom idea
  workflow_dispatch:
    inputs:
      video_idea:
        description: 'Custom video idea (optional)'
        required: false
        type: string

  # Daily scheduled run
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight UTC
```

### Common Cron Patterns

| Pattern | Schedule |
|---------|----------|
| `'0 0 * * *'` | Daily at midnight UTC |
| `'0 2 * * *'` | Daily at 2 AM UTC |
| `'0 6 * * *'` | Daily at 6 AM UTC |
| `'0 */6 * * *'` | Every 6 hours |
| `'0 0 * * 0'` | Weekly (Sunday) |

---

## Jobs

### 1. Populate Ideas

**Purpose:** Ensure the ideas queue is not empty

```yaml
populate-ideas:
  name: Populate Ideas Queue
  runs-on: ubuntu-latest
  timeout-minutes: 15
  outputs:
    added_ideas: ${{ steps.populate.outputs.ideas_added }}
```

**Script:** `.github/scripts/check-and-populate-ideas.ts`

**Flow:**
1. Check Redis queue length
2. If empty: run idea-selector worker
3. Push generated ideas to queue
4. Output list of added ideas

### 2. Generate Script

**Purpose:** Generate video script from idea

```yaml
generate-script:
  name: Generate Script
  needs: populate-ideas
  timeout-minutes: 10
  outputs:
    video_id: ${{ steps.script.outputs.video_id }}
    video_title: ${{ steps.script.outputs.video_title }}
    script_data: ${{ steps.script.outputs.script_data }}
```

**Script:** `.github/scripts/generate-script.ts`

**Flow:**
1. If custom idea provided → use it
2. Else → Pop from Redis queue
3. Else → Random from fallback pool
4. Call website API `/api/generate-script`
5. Output script JSON

### 3. Render Scenes

**Purpose:** Render visual scenes to video clips

```yaml
render-scenes:
  name: Render Video Scenes
  needs: generate-script
  timeout-minutes: 60
  outputs:
    clips_urls: ${{ steps.scenes.outputs.clips_urls }}
    clips_timings: ${{ steps.scenes.outputs.clips_timings }}
    animation_stop_times: ${{ steps.scenes.outputs.animation_stop_times }}
```

**System Dependencies:**
```bash
sudo apt-get install -y ffmpeg \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
  libxkbcommon0 libxcomposite1 libxrandr2 libgbm1 \
  libpangocairo-1.0-0 libasound2t64
```

**Script:** `.github/scripts/render-scenes.ts`

### 4. Generate Voiceover

**Purpose:** Generate TTS audio for narration

```yaml
generate-voiceover:
  name: Generate Voice-overs
  needs: generate-script
  timeout-minutes: 60
  outputs:
    voiceover_data: ${{ steps.voiceover.outputs.voiceover_data }}
```

**Script:** `.github/scripts/generate-voiceover.ts`

**Runs in parallel with render-scenes**

### 5. Generate Thumbnail

**Purpose:** Generate AI thumbnail image

```yaml
generate-thumbnail:
  name: Generate Thumbnail
  needs: generate-script
  timeout-minutes: 15
  outputs:
    thumbnail_url: ${{ steps.thumbnail.outputs.thumbnail_url }}
```

**Script:** `.github/scripts/generate-thumbnail.ts`

**Runs in parallel with render-scenes and generate-voiceover**

### 6. Assemble Video

**Purpose:** Combine clips + audio + music + branding

```yaml
assemble-video:
  name: Assemble Video
  needs: [generate-script, render-scenes, generate-voiceover]
  timeout-minutes: 60
  outputs:
    video_url: ${{ steps.assemble.outputs.video_url }}
    scene_durations: ${{ steps.assemble.outputs.scene_durations }}
```

**Script:** `.github/scripts/assemble-video.ts`

### 7. Upload YouTube

**Purpose:** Upload long-form video with chapters

```yaml
upload-youtube:
  name: Upload to YouTube
  needs: [generate-script, assemble-video, generate-thumbnail]
  timeout-minutes: 30
  outputs:
    youtube_id: ${{ steps.upload.outputs.youtube_id }}
```

**Script:** `.github/scripts/upload-youtube.ts`

### 8. Shorts Matrix Setup

**Purpose:** Determine number of shorts and create matrix indices

```yaml
shorts-matrix-setup:
  name: Setup Shorts Matrix
  needs: [generate-script]
  timeout-minutes: 5
  outputs:
    short_indices: ${{ steps.matrix.outputs.short_indices }}
```

**Output Example:** `[0, 1, 2, 3, 4]` for 5 shorts

### 9. Process Short (Matrix)

**Purpose:** Process each short in parallel

```yaml
process-short:
  name: "Process Short #${{ matrix.short_index }}"
  needs: [generate-script, shorts-matrix-setup]
  timeout-minutes: 60
  if: needs.shorts-matrix-setup.outputs.short_indices != '[]'
  strategy:
    fail-fast: false  # One failing doesn't cancel others
    matrix:
      short_index: ${{ fromJson(needs.shorts-matrix-setup.outputs.short_indices) }}
```

**Script:** `.github/scripts/process-single-short.ts`

**Each short job:**
1. Render 2 scenes (hook + content)
2. Generate voiceovers
3. Assemble with logo overlay
4. Upload with ranked schedule time

### 10. Pipeline Summary

**Purpose:** Log results and send webhook

```yaml
pipeline-summary:
  name: Pipeline Summary
  needs: [all other jobs]
  runs-on: ubuntu-latest
  if: always()  # Run even if previous jobs fail
```

**Actions:**
1. Write summary to `$GITHUB_STEP_SUMMARY`
2. Send webhook to website `/api/pipeline-status`

---

## GitHub Secrets

Required secrets in **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GEMINI_API_KEY_1` | Primary Gemini API key |
| `GEMINI_API_KEY_2` | Secondary Gemini API key (rotation) |
| `YT_CLIENT_ID` | YouTube OAuth client ID |
| `YT_CLIENT_SECRET` | YouTube OAuth client secret |
| `YT_REFRESH_TOKEN` | YouTube OAuth refresh token |
| `REDIS_URL` | Redis connection URL |
| `WEBSITE_DOMAIN` | Website URL for API calls |
| `PIPELINE_WEBHOOK_SECRET` | Webhook authentication token |

---

## Script Files

### Directory Structure

```
.github/
├── workflows/
│   └── main.yml              # Main workflow definition
└── scripts/
    ├── check-and-populate-ideas.ts
    ├── generate-script.ts
    ├── render-scenes.ts
    ├── generate-voiceover.ts
    ├── assemble-video.ts
    ├── generate-thumbnail.ts
    ├── upload-youtube.ts
    ├── process-shorts.ts
    └── process-single-short.ts
```

### Script Communication

Scripts communicate via:
1. **Environment variables** - `SCRIPT_DATA`, `CLIPS_URLS`, etc.
2. **GitHub outputs** - `>> $GITHUB_OUTPUT`
3. **Exit codes** - 0 for success, 1 for failure

### Output Encoding

Large outputs (URLs, JSON) are hex-encoded to avoid shell escaping issues:

```typescript
// Encode in script
const hexEncoded = Buffer.from(jsonString).toString('hex');
console.log(`clips_urls=${hexEncoded}`);

// Decode in workflow
VIDEO_URL=$(echo "$VIDEO_URL_HEX" | xxd -r -p)
```

---

## Data Flow

### Script Data

The `script_data` output flows through the entire pipeline:

```yaml
# Generated in generate-script
script_data: ${{ steps.script.outputs.script_data }}

# Consumed by downstream jobs
env:
  SCRIPT_DATA: ${{ needs.generate-script.outputs.script_data }}
```

### Contents:
```json
{
  "videoId": "video-1234567890",
  "script": {
    "title": "Understanding HTTP",
    "description": "...",
    "tags": ["http", "web"],
    "scenes": [...],
    "shorts": [...]
  }
}
```

### Scene Durations

Scene durations flow from assembly to YouTube upload for chapter timestamps:

```yaml
# From assemble-video
scene_durations: ${{ steps.assemble.outputs.scene_durations }}

# To upload-youtube
SCENE_DURATIONS: ${{ needs.assemble-video.outputs.scene_durations }}
```

---

## Error Handling

### Job Timeouts

| Job | Timeout |
|-----|---------|
| populate-ideas | 15 min |
| generate-script | 10 min |
| render-scenes | 60 min |
| generate-voiceover | 60 min |
| generate-thumbnail | 15 min |
| assemble-video | 60 min |
| upload-youtube | 30 min |
| process-short | 60 min |

### Failure Behavior

- **Default:** Job failure stops dependent jobs
- **Shorts:** `fail-fast: false` - one failing short doesn't cancel others
- **Summary:** `if: always()` - runs regardless of failures

### Webhook Status

Pipeline summary sends webhook with job statuses:
```json
{
  "overallStatus": "success",
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

## Manual Trigger

Run workflow manually with optional custom idea:

1. Go to **Actions** tab
2. Select **Daily Video Generation Pipeline**
3. Click **Run workflow**
4. Optionally enter custom video idea
5. Click **Run workflow** button

---

## Monitoring

### Job Logs

1. Go to **Actions** tab
2. Click on workflow run
3. Click on specific job
4. View step-by-step logs

### Summary

Each run generates a summary at:
**Actions → Run → Summary**

Example:
```markdown
## Video Generation Pipeline Complete 🎉

**Video ID:** video-1234567890

### 📺 YouTube Videos
**Main Video:** https://youtube.com/watch?v=ABC123
**Thumbnail:** https://res.cloudinary.com/...

### 🎬 Video Assets
**Assembled Video:** https://res.cloudinary.com/...

### Job Status:
- Populate Ideas: success
- Script Generation: success
- Scene Rendering: success
- Voice-over Generation: success
- Video Assembly: success
- Thumbnail Generation: success
- YouTube Upload: success
- Shorts Processing: success
```

---

## Local Testing

```bash
# Test individual script
npx tsx .github/scripts/generate-script.ts "My Custom Idea"

# Test with environment variables
WEBSITE_DOMAIN=http://localhost:3000 \
REDIS_URL=redis://localhost:6379 \
npx tsx .github/scripts/generate-script.ts
```

---

## Next: [06-website-api.md](./06-website-api.md)
