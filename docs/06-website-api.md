# Website and API Routes

> Next.js 16 dashboard with API endpoints for pipeline management

This document covers the website structure and available API routes.

---

## Overview

The website (`/website`) is a Next.js 16 application providing:

1. **Dashboard UI** - Visual interface for managing the pipeline
2. **API Routes** - REST endpoints used by GitHub Actions and mobile app
3. **AI Services** - Script and thumbnail generation
4. **Auth** - YouTube OAuth and NextAuth integration

---

## Directory Structure

```
website/
├── app/
│   ├── page.tsx              # Home page
│   ├── dashboard/
│   │   └── page.tsx          # Dashboard UI
│   ├── auth/
│   │   ├── signin/page.tsx   # Sign-in page
│   │   └── error/page.tsx    # Auth error page
│   └── api/                  # API routes (see below)
│
├── lib/
│   ├── ai/
│   │   ├── gemini-client.ts  # Gemini API client
│   │   ├── gemini-service.ts # Script generation
│   │   ├── gemini-tts-service.ts  # TTS service
│   │   └── thumbnail-service.ts   # Thumbnail generation
│   ├── pipeline/
│   │   ├── index.ts          # VideoGenerationPipeline class
│   │   ├── script-generation.ts  # ScriptGenerationService
│   │   └── types.ts          # TypeScript types
│   ├── redis-client.ts       # Redis connection
│   └── cloudinary-service.ts # Cloudinary uploads
│
├── components/
│   ├── pipeline/             # Pipeline UI components
│   └── ui/                   # Shared UI primitives
│
├── package.json
├── tsconfig.json
├── next.config.ts
└── vercel.json               # Vercel deployment config
```

---

## API Routes

### Ideas Queue

**Endpoint:** `/api/ideas-queue`

Manages the Redis queue of video ideas.

#### GET - List Ideas

```http
GET /api/ideas-queue
```

**Response:**
```json
{
  "ok": true,
  "ideas": ["Understanding HTTP", "How Databases Work", ...],
  "count": 5
}
```

#### POST - Modify Ideas

```http
POST /api/ideas-queue
Content-Type: application/json
```

**Actions:**

| Action | Body | Description |
|--------|------|-------------|
| `add` | `{ "action": "add", "idea": "New Topic" }` | Add idea to end of queue |
| `remove` | `{ "action": "remove", "index": 0 }` | Remove idea at index |
| `edit` | `{ "action": "edit", "index": 0, "idea": "Updated Topic" }` | Edit idea at index |
| `move` | `{ "action": "move", "index": 0, "newIndex": 2 }` | Move idea to new position |
| `clear` | `{ "action": "clear" }` | Clear all ideas |

---

### Schedule Times

**Endpoint:** `/api/schedule-times`

Manages publish schedule for shorts (5 ranked times) and long-form videos.

#### GET - Get Schedule

```http
GET /api/schedule-times
```

**Response:**
```json
{
  "ok": true,
  "shortsTimes": ["16:30", "18:00", "20:00", "12:00", "14:00"],
  "longFormTime": "18:30"
}
```

**Default Values:**
- **Shorts:** `["16:30", "18:00", "20:00", "12:00", "14:00"]` (Rank 1-5)
- **Long-form:** `"18:30"` (IST)

#### POST - Update Schedule

```http
POST /api/schedule-times
Content-Type: application/json

{
  "shortsTimes": ["17:00", "19:00", "21:00", "13:00", "15:00"],
  "longFormTime": "19:00"
}
```

**Validation:**
- `shortsTimes` must be array of exactly 5 times
- Times must be in `HH:MM` 24-hour format
- Either or both fields can be updated

---

### Generate Script

**Endpoint:** `/api/generate-script`

Generates a complete video script using Gemini AI.

```http
POST /api/generate-script
Content-Type: application/json

{
  "videoIdea": "How HTTP Protocols Work"
}
```

**Response:**
```json
{
  "script": {
    "title": "Understanding HTTP: The Foundation of Web Communication",
    "description": "Learn how HTTP powers...",
    "tags": ["http", "web", "programming"],
    "narration": "Full script narration...",
    "scenes": [
      {
        "id": "scene-1",
        "sceneTitle": "Introduction to HTTP",
        "sceneTheme": "dark",
        "baseDuration": 30,
        "holdDuration": 5,
        "narration": "HTTP is the foundation...",
        "actions": [...]
      }
    ],
    "shorts": [
      {
        "id": "short-1",
        "hook": "Did you know HTTP is stateless?",
        "scenes": [...]
      }
    ]
  }
}
```

---

### Generate Thumbnail

**Endpoint:** `/api/generate-thumbnail`

Generates an AI thumbnail for the video.

```http
POST /api/generate-thumbnail
Content-Type: application/json

{
  "title": "Understanding HTTP",
  "description": "Learn how HTTP powers the web..."
}
```

**Response:**
```json
{
  "ok": true,
  "thumbnailUrl": "https://res.cloudinary.com/..."
}
```

**Shorts Variant:**
```http
POST /api/generate-thumbnail/shorts
```

---

### Pipeline Status

**Endpoint:** `/api/pipeline-status`

Receives webhook from GitHub Actions and provides status to mobile app.

#### GET - Get Latest Status

```http
GET /api/pipeline-status
```

**Response:**
```json
{
  "ok": true,
  "status": {
    "overallStatus": "success",
    "ranAt": "2024-01-15T12:00:00Z",
    "videoId": "video-1234567890",
    "videoTitle": "Understanding HTTP",
    "youtubeId": "ABC123",
    "videoUrl": "https://res.cloudinary.com/...",
    "thumbnailUrl": "https://res.cloudinary.com/...",
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

#### POST - Receive Webhook

Called by GitHub Actions `pipeline-summary` job:

```http
POST /api/pipeline-status
Authorization: Bearer {PIPELINE_WEBHOOK_SECRET}
Content-Type: application/json

{
  "overallStatus": "success",
  "videoId": "video-123",
  "videoTitle": "Understanding HTTP",
  "youtubeId": "ABC123",
  ...
}
```

---

### Push Token

**Endpoint:** `/api/push-token`

Saves Expo push tokens for mobile notifications.

```http
POST /api/push-token
Content-Type: application/json

{
  "token": "ExponentPushToken[...]"
}
```

---

### Jobs Management

**Endpoint:** `/api/jobs`

Legacy job management endpoints.

```http
GET /api/jobs              # List all jobs
GET /api/jobs/{jobId}      # Get specific job
POST /api/jobs             # Create job
```

---

### Authentication

#### YouTube OAuth

```
GET /api/auth/youtube/start     # Start OAuth flow
GET /api/auth/youtube/callback  # OAuth callback
```

#### NextAuth

```
GET /api/auth/[...nextauth]     # NextAuth endpoints
```

---

## Redis Keys

| Key | Type | Description |
|-----|------|-------------|
| `video:ideas` | List | Ideas queue |
| `shorts:publish-times` | String (JSON) | `["16:30", "18:00", ...]` |
| `longform:publish-time` | String | `"18:30"` |
| `pipeline:status` | String (JSON) | Latest pipeline status |
| `expo:push-tokens` | Set | Mobile app push tokens |

---

## Environment Variables

```bash
# Database
REDIS_URL=redis://localhost:6379

# AI
GEMINI_API_KEY_1=your_key_1
GEMINI_API_KEY_2=your_key_2

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# YouTube
YT_CLIENT_ID=your_client_id
YT_CLIENT_SECRET=your_client_secret
YT_REFRESH_TOKEN=your_refresh_token

# Security
PIPELINE_WEBHOOK_SECRET=your_secret

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your_secret
```

---

## Deployment

### Vercel

The website is deployed on Vercel:

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
```

---

## Next: [07-mobile-app.md](./07-mobile-app.md)
