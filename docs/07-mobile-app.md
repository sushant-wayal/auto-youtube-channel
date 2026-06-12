# Mobile Dashboard App

> React Native + Expo companion app for on-the-go pipeline management and push notifications

This document covers the mobile dashboard app structure and features.

---

## Overview

The mobile app (`/mobile-app/dashboard-app`) provides:

1. **Ideas Management** - Add, edit, delete, reorder video ideas
2. **Schedule Management** - Update shorts and long-form publish times
3. **Pipeline Status** - View latest pipeline run results
4. **Push Notifications** - Get notified when pipeline completes

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React Native | 0.76+ | Mobile framework |
| Expo | 54+ | Development platform |
| TypeScript | 5.x | Type safety |
| React Navigation | 7.x | Navigation |
| Expo Notifications | — | Push notifications (Expo Push API) |
| Google Services | `google-services.json` | Firebase for Android notifications |

---

## Directory Structure

```
mobile-app/dashboard-app/
├── App.tsx                         # Main app entry (14 KB — all screens in one file)
├── config.ts                       # API base URL configuration
├── theme.ts                        # Styling theme (dark, 3 KB)
├── index.js                        # Expo entry point
├── services/
│   └── api.ts                      # API client (ideasApi, scheduleTimesApi, pipelineApi)
├── screens/
│   ├── IdeasScreen.tsx             # Ideas queue management
│   ├── ScheduleTimesScreen.tsx     # Schedule management (5 ranked slots + long-form)
│   ├── ShortsScheduleScreen.tsx    # Legacy single shorts time
│   └── PipelineStatusScreen.tsx    # Pipeline status viewer
├── components/                     # Shared UI components
├── android/                        # Android native files
├── assets/                         # App icons and splash screen
├── get-local-ip.js                 # Utility: find local IP for dev config
├── google-services.json            # Firebase config for Android push notifications
├── package.json
├── tsconfig.json
├── app.json                        # Expo config
└── eas.json                        # EAS Build config
```

---

## Screens

### Ideas Screen

**File:** `screens/IdeasScreen.tsx`

Manage video ideas queue:

- View all ideas in queue order
- Pull-to-refresh to update
- Add new ideas via text input
- Edit ideas inline
- Delete with confirmation
- Reorder with up/down arrows
- Clear all with confirmation

### Schedule Times Screen

**File:** `screens/ScheduleTimesScreen.tsx`

Manage publish times:

- View 5 ranked shorts times
- View long-form publish time
- Edit with native time picker
- Quick preset buttons
- Save changes with validation
- Change detection (enable/disable save)

### Shorts Schedule Screen

**File:** `screens/ShortsScheduleScreen.tsx`

Legacy single shorts time management.

### Pipeline Status Screen

**File:** `screens/PipelineStatusScreen.tsx`

View latest pipeline run:

- Overall status (success/failure)
- Run timestamp
- Video title and YouTube link
- Assembled video link
- Thumbnail preview
- Per-job status indicators
- Scene and voiceover URLs
- Script content viewer

---

## API Client

### Location

`services/api.ts`

### Exported Objects

```typescript
// Ideas queue management → calls /api/ideas-queue
export const ideasApi = {
  getIdeas(): Promise<IdeasQueueResponse>,
  addIdea(idea: string): Promise<IdeasQueueResponse>,
  editIdea(index: number, idea: string): Promise<IdeasQueueResponse>,
  removeIdea(index: number): Promise<IdeasQueueResponse>,
  moveIdea(index: number, newIndex: number): Promise<IdeasQueueResponse>,
  clearIdeas(): Promise<IdeasQueueResponse>,
};

// Legacy single shorts time → calls /api/shorts-publish-time
export const shortsApi = {
  getPublishTime(): Promise<ShortsPublishTimeResponse>,
  updatePublishTime(time: string): Promise<ShortsPublishTimeResponse>,
};

// Schedule times (5 shorts slots + long-form) → calls /api/schedule-times
export const scheduleTimesApi = {
  getScheduleTimes(): Promise<ScheduleTimesResponse>,
  updateShortsTimes(shortsTimes: string[]): Promise<ScheduleTimesResponse>,
  updateLongFormTime(longFormTime: string): Promise<ScheduleTimesResponse>,
  updateAllScheduleTimes(shortsTimes: string[], longFormTime: string): Promise<ScheduleTimesResponse>,
};

// Pipeline status + push tokens → calls /api/pipeline-status and /api/push-token
export const pipelineApi = {
  savePushToken(token: string): Promise<SavePushTokenResponse>,
  getPipelineStatus(): Promise<PipelineStatusResponse>,
};
```

### Types

```typescript
export type JobResult = 'success' | 'failure' | 'skipped' | 'cancelled' | null;

export type PipelineStatus = {
  overallStatus: 'success' | 'failure';
  ranAt: string;
  videoId: string;
  videoTitle: string;
  youtubeId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  sceneUrls?: string[];
  voiceoverUrls?: string[];
  jobs: {
    populateIdeas: JobResult;
    generateScript: JobResult;
    renderScenes: JobResult;
    generateVoiceover: JobResult;
    assembleLongForm: JobResult;
    generateThumbnail: JobResult;
    uploadYoutube: JobResult;
    shortsProcessing: JobResult;
  };
};

export type IdeasQueueResponse = {
  ok: boolean;
  ideas: string[];
  count: number;
  error?: string;
};

export type ScheduleTimesResponse = {
  ok: boolean;
  shortsTimes?: string[];    // ["06:45", "07:45", "08:45", "12:00", "14:00"] — IST
  longFormTime?: string;     // "18:30" — IST
  error?: string;
};
```

---

## Configuration

### API Base URL

**File:** `config.ts`

```typescript
// Development: Use your local IP
export const API_BASE_URL = 'http://192.168.1.100:3000';

// Production: Use deployed website
// export const API_BASE_URL = 'https://your-domain.com';
```

### Finding Local IP

```bash
cd mobile-app/dashboard-app
npm run get-ip
# Output: Your local IP is: 192.168.1.100
```

Update `config.ts` with the output.

---

## Theme

**File:** `theme.ts`

```typescript
export const theme = {
  colors: {
    primary: '#6366F1',    // Indigo
    background: '#0F172A', // Slate-900
    surface: '#1E293B',    // Slate-800
    text: '#F1F5F9',       // Slate-100
    textSecondary: '#94A3B8', // Slate-400
    success: '#10B981',    // Emerald
    danger: '#EF4444',     // Red
    warning: '#F59E0B',    // Amber
    border: '#334155',     // Slate-700
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    full: 9999,
  },
};
```

---

## Setup Guide

### Prerequisites

- Node.js 20+
- npm 10+
- Expo Go app on your phone
- Website running locally (or deployed)

### Installation

```bash
# Navigate to app
cd mobile-app/dashboard-app

# Install dependencies
npm install

# Get local IP
npm run get-ip

# Update config.ts with your IP
```

### Running

```bash
# Start Expo dev server
npm start

# Or specific platforms
npm run ios
npm run android
```

### Connecting

1. Open Expo Go on your phone
2. Scan QR code from terminal
3. App loads and connects to backend

---

## Build & Deploy

### EAS Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### EAS Configuration

**File:** `eas.json`

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

---

## Push Notifications

### Setup

1. Configure Expo Push Notifications in `app.json`
2. Request permission in app
3. Get Expo Push Token
4. Send to server via `/api/push-token`

### Flow

```typescript
import * as Notifications from 'expo-notifications';

// Request permission
const { status } = await Notifications.requestPermissionsAsync();

// Get token
const token = (await Notifications.getExpoPushTokenAsync()).data;

// Save to server
await pipelineApi.savePushToken(token);
```

### Server-Side

When pipeline completes, server sends notification:
```typescript
await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: expoPushToken,
    title: 'Pipeline Complete',
    body: `Video "${videoTitle}" has been uploaded!`
  })
});
```

---

## Troubleshooting

### Connection Issues

1. Ensure backend is running (`cd website && npm run dev`)
2. Check `config.ts` has correct IP
3. Phone and computer on same network
4. Check firewall settings

### Development Tips

- Use `console.log('[API] ...')` for debugging
- Check Metro bundler for errors
- Shake device for Expo dev menu
- Use React Native Debugger for inspection

---

## Next: [08-types-schema.md](./08-types-schema.md)
