# Website and API Routes

> Next.js 15 (App Router) dashboard with 13 API endpoints for pipeline management

This document covers the website structure and all available API routes.

---

## Overview

The website (`/website`) is a **Next.js 15** application providing:

1. **Dashboard UI** — Private admin interface for managing the pipeline (auth-protected)
2. **API Routes** — 13 REST endpoints called by GitHub Actions, mobile app, and the dashboard
3. **AI Services** — Script generation, AI scene HTML generation, and thumbnail generation
4. **Auth** — NextAuth integration protecting the dashboard

---

## Directory Structure

```
website/
├── app/
│   ├── page.tsx                  # Root page — old pipeline UI (~920 lines, fully commented out)
│   ├── dashboard/
│   │   └── page.tsx              # Live admin dashboard (auth-protected)
│   ├── auth/
│   │   ├── signin/page.tsx       # Sign-in page
│   │   └── error/page.tsx        # Auth error page
│   └── api/
│       ├── generate-script/      # POST: generate full video script via Gemini
│       ├── generate-scene-html/  # POST: AI-generated animated HTML (rate-limited)
│       ├── generate-thumbnail/   # POST: generate thumbnail image
│       ├── pipeline-status/      # GET/POST: pipeline run data + webhook receiver
│       ├── ideas-queue/          # GET/POST: manage Redis video:ideas queue
│       ├── schedule-times/       # GET/POST: manage publish schedule times
│       ├── shorts-publish-time/  # GET/POST: manage shorts publish time slots
│       ├── settings/             # GET/POST: general settings
│       ├── trigger-youtube/      # POST: manually trigger GitHub Actions
│       ├── jobs/                 # GET: pipeline job history
│       ├── cron/                 # GET: Vercel cron-triggered route
│       ├── push-token/           # POST: register Expo push notification token
│       └── auth/                 # NextAuth routes
│
├── lib/                          # Shared server-side utilities
├── components/                   # Dashboard UI components
├── auth.ts                       # NextAuth configuration
├── middleware.ts                  # Route protection (guards /dashboard)
├── package.json
├── next.config.ts
└── vercel.json                   # Vercel deployment (maxDuration: 60s per function)
```

---

## API Routes

### 1. Generate Script

**Endpoint:** `POST /api/generate-script`

The core content generation endpoint — called by the `generate-script` CI job.

```http
POST /api/generate-script
Content-Type: application/json

{
  "videoIdea": "Why Redis is Misused in Production"
}
```

**Response:**
```json
{
  "videoId": "video-1234567890",
  "script": {
    "title": "The Redis Mistake Every Developer Makes",
    "description": "Learn why...",
    "tags": ["redis", "caching", "backend", "programming"],
    "narration": "Full narration text for the entire video...",
    "scenes": [
      {
        "id": "scene-1",
        "sceneTitle": "Introduction",
        "baseDuration": 5,
        "holdDuration": 1,
        "narration": "Redis seems simple on the surface...",
        "actions": [
          { "t": 0, "op": "text", "x": 960, "y": 200, "value": "The Redis Problem", "size": "title", "align": "center" },
          { "t": 1.2, "op": "code", "x": 200, "y": 350, "code": "const val = await redis.get(key);", "language": "typescript" }
        ]
      }
    ],
    "shorts": [
      {
        "id": "short-0",
        "hook": "Redis is NOT a database",
        "scenes": [
          { "id": "hook", "baseDuration": 1.0, "holdDuration": 0, "narration": "", "actions": [...] },
          { "id": "content", "baseDuration": 5, "holdDuration": 1, "narration": "Here's why...", "actions": [...] }
        ]
      }
    ]
  }
}
```

---

### 2. Generate Scene HTML (AI Render Mode)

**Endpoint:** `POST /api/generate-scene-html`

Only used when `SCENE_RENDER_METHOD=ai`. Generates Gemini-powered animated HTML for a single scene. Uses Redis-based rate limiting (22-second cooldown per request).

```http
POST /api/generate-scene-html
Content-Type: application/json

{
  "narration": "Caching seems simple, but there's one detail most developers miss.",
  "ticket": 1
}
```

**Response:**
```json
{
  "html": "<!DOCTYPE html><html>...</html>",
  "nextTicket": 2
}
```

**Rate-limit mechanism:** Redis keys `html_queue:turn`, `html_queue:processing`, `html_queue:last_enquiry` enforce a 22-second cooldown between Gemini calls to prevent quota exhaustion.

---

### 3. Generate Thumbnail

**Endpoint:** `POST /api/generate-thumbnail`

```http
POST /api/generate-thumbnail
Content-Type: application/json

{
  "title": "Why Redis is Misused",
  "description": "Learn the most common Redis mistakes...",
  "tags": ["redis", "caching"]
}
```

**Response:**
```json
{
  "ok": true,
  "thumbnailUrl": "https://res.cloudinary.com/..."
}
```

---

### 4. Pipeline Status

**Endpoint:** `GET /api/pipeline-status` | `POST /api/pipeline-status`

The webhook receiver for GitHub Actions `pipeline-summary` job. Also returns the latest status to the dashboard and mobile app.

#### GET — Fetch Latest Status

```http
GET /api/pipeline-status
```

**Response:**
```json
{
  "ok": true,
  "status": {
    "overallStatus": "success",
    "ranAt": "2026-06-12T13:00:00Z",
    "videoId": "video-1234567890",
    "videoTitle": "Why Redis is Misused",
    "youtubeId": "dQw4w9WgXcQ",
    "videoUrl": "https://res.cloudinary.com/...",
    "thumbnailUrl": "https://res.cloudinary.com/...",
    "description": "Full description with chapters...",
    "sceneUrls": ["https://res.cloudinary.com/..."],
    "voiceoverUrls": ["https://res.cloudinary.com/..."],
    "sceneNarrations": ["Scene 1 narration..."],
    "shortHooks": ["Redis is NOT a database"],
    "ideasAdded": ["Why Redis is Misused"],
    "shorts": [
      { "shortIndex": 0, "shortId": "video-123-short-0", "youtubeId": "ABC123", "scheduledPublishTime": "2026-06-13T01:15:00Z" }
    ],
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
}
```

#### POST — Receive Webhook (from GitHub Actions)

```http
POST /api/pipeline-status
Authorization: Bearer {PIPELINE_WEBHOOK_SECRET}
Content-Type: application/json

{
  "overallStatus": "success",
  "videoId": "video-1234567890",
  "videoTitle": "...",
  ... (full PipelineStatus object)
}
```

The endpoint validates the `Authorization` header using `PIPELINE_WEBHOOK_SECRET`, then stores the status in Redis.

---

### 5. Ideas Queue

**Endpoint:** `GET /api/ideas-queue` | `POST /api/ideas-queue`

Manages the `video:ideas` Redis list.

#### GET — List All Ideas

```http
GET /api/ideas-queue
```

**Response:**
```json
{
  "ok": true,
  "ideas": ["Why Redis is Misused", "How HTTP/2 Works", "..."],
  "count": 3
}
```

#### POST — Modify Queue

| Action | Body | Description |
|--------|------|-------------|
| `add` | `{ "action": "add", "idea": "New Topic" }` | Append idea to end |
| `remove` | `{ "action": "remove", "index": 0 }` | Remove idea at index |
| `edit` | `{ "action": "edit", "index": 0, "idea": "Updated" }` | Update idea at index |
| `move` | `{ "action": "move", "index": 0, "newIndex": 2 }` | Reorder ideas |
| `clear` | `{ "action": "clear" }` | Delete all ideas |

---

### 6. Schedule Times

**Endpoint:** `GET /api/schedule-times` | `POST /api/schedule-times`

Manages publish schedule for shorts (5 ranked slots) and long-form videos.

#### GET — Fetch Schedule

```http
GET /api/schedule-times
```

**Response:**
```json
{
  "ok": true,
  "shortsTimes": ["06:45", "07:45", "08:45", "12:00", "14:00"],
  "longFormTime": "18:30"
}
```

**Default Values (IST):**
- **Shorts Rank 1–5:** `["06:45", "07:45", "08:45", "12:00", "14:00"]`
- **Long-form:** `"18:30"`

#### POST — Update Schedule

```http
POST /api/schedule-times
Content-Type: application/json

{
  "shortsTimes": ["07:00", "08:00", "09:00", "13:00", "15:00"],
  "longFormTime": "19:00"
}
```

**Validation:** `shortsTimes` must be exactly 5 `HH:MM` 24-hour strings.

---

### 7. Shorts Publish Time

**Endpoint:** `GET /api/shorts-publish-time` | `POST /api/shorts-publish-time`

Manages the 5 ranked publish time slots for shorts specifically.

---

### 8. Settings

**Endpoint:** `GET /api/settings` | `POST /api/settings`

General pipeline settings management.

---

### 9. Trigger YouTube

**Endpoint:** `POST /api/trigger-youtube`

Manually triggers the GitHub Actions pipeline workflow via the GitHub API.

```http
POST /api/trigger-youtube
Content-Type: application/json

{
  "videoIdea": "Optional custom idea"   // Optional
}
```

Calls `POST https://api.github.com/repos/{owner}/{repo}/actions/workflows/main.yml/dispatches`.

---

### 10. Jobs

**Endpoint:** `GET /api/jobs`

Returns pipeline job history (past runs and their status).

```http
GET /api/jobs
```

---

### 11. Cron

**Endpoint:** `GET /api/cron`

Triggered by Vercel's cron scheduler. Can trigger daily pipeline runs without GitHub Actions cron.

---

### 12. Push Token

**Endpoint:** `POST /api/push-token`

Registers an Expo push notification token from the mobile app.

```http
POST /api/push-token
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

Tokens stored in Redis `expo:push-tokens` set. Used to send pipeline completion notifications to the creator's phone.

---

### 13. Auth

**Endpoint:** `/api/auth/*`

NextAuth authentication routes. The `/dashboard` route is protected by `middleware.ts` which requires authentication.

---

## Redis Keys (Website-Managed)

| Key | Type | Schema | Description |
|-----|------|--------|-------------|
| `video:ideas` | List | `string[]` | Video topic idea queue |
| `shorts:publish-times` | String | JSON `string[]` (5 items) | Ranked IST publish times for shorts |
| `longform:publish-time` | String | `"HH:MM"` | IST publish time for long-form |
| `pipeline:status` | String | JSON `PipelineStatus` | Latest pipeline run status |
| `pipeline:shorts:{videoId}` | List | JSON `ShortResult[]` (TTL 7d) | Short results per run |
| `expo:push-tokens` | Set | `string[]` | Expo push notification tokens |
| `html_queue:turn` | String | Integer | AI scene rate-limit queue counter |
| `html_queue:processing` | String | `"true"` | AI scene processing lease |
| `html_queue:last_enquiry` | String | Unix timestamp ms | Last AI scene request time |

---

## Environment Variables

```bash
# Database
REDIS_URL=redis://localhost:6379

# AI
GEMINI_API_KEY_1=your_key_1
GEMINI_API_KEY_2=your_key_2       # Optional

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# YouTube OAuth
YT_CLIENT_ID=your_client_id
YT_CLIENT_SECRET=your_client_secret
YT_REFRESH_TOKEN=your_refresh_token

# Pipeline
VOICEOVER_PROVIDER=gemini          # gemini | f5
SCENE_RENDER_METHOD=code           # code | ai

# Security
PIPELINE_WEBHOOK_SECRET=your_secret

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_nextauth_secret
```

---

## Deployment

### Vercel

The website deploys on Vercel:

```json
// vercel.json
{
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### Local Development

```bash
cd website
npm install
npm run dev
# Open http://localhost:3000
# Dashboard: http://localhost:3000/dashboard
```

---

## Next: [07-mobile-app.md](./07-mobile-app.md)
