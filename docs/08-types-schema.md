# Types and Data Schemas

> TypeScript types and data structures used throughout the pipeline

This document provides a comprehensive reference for all major types and schemas.

---

## Scene Definitions

### SceneIR (Scene Intermediate Representation)

```typescript
interface SceneIR {
  id: string;                              // Unique identifier (e.g., "scene-1", "hook")
  sceneTitle?: string;                     // Title for YouTube chapters
  sceneTheme?: "light" | "dark" | "auto"; // Visual theme (auto = alternates by index)
  baseDuration: number;                    // Animation duration in seconds
  holdDuration: number;                    // Hold time after animations complete
  narration?: string;                      // Per-scene narration text ("" = silence)
  actions: ActionIR[];                     // Visual primitives to render
}
```

### ActionIR (Visual Primitives)

The full union type — note that `action-flow-to-html.ts` only actively renders `text`, `code`, `line`, and `icon`. Other types may be defined for Gemini's benefit but are gracefully ignored by the renderer.

```typescript
type ActionIR =
  // ─── ACTIVELY RENDERED ───────────────────────────────────────────

  // Text label (fade-in animation)
  | {
      t: number;              // Start time (seconds from scene start)
      op: "text";
      x: number; y: number;
      value: string;
      size?: "title" | "subtitle" | "body" | "label";
      fontSize?: number;
      fontWeight?: number;
      fill?: string;
      align?: "left" | "center" | "right";
      baseline?: "top" | "middle" | "bottom";
      monospace?: boolean;
    }

  // Syntax-highlighted code block (line-by-line reveal)
  | {
      t: number;
      op: "code";
      x: number; y: number;
      w?: number; h?: number;
      code: string;           // Newline-separated code content
      language: string;       // js|ts|py|go|rs|sql and full names
      fontSize?: number;
    }

  // Animated line connector (progressive draw)
  | {
      t: number;
      op: "line";
      x1: number; y1: number; // Start point
      x2: number; y2: number; // End point
      stroke?: string;
      strokeWidth?: number;
      dashed?: boolean;
      arrow?: boolean;        // Arrow head at end
      curve?: "none" | "arc-up" | "arc-down" | "s-curve" | "wave";
    }

  // Named SVG icon (fade-in)
  | {
      t: number;
      op: "icon";
      x: number; y: number;
      name: string;           // check|cross|warning|info|arrowRight|arrowLeft|
                              // arrowUp|arrowDown|plus|minus|clock|database|
                              // server|cpu|lock|unlock|cloud|bug|chartUp|chartDown
      size?: number;
      stroke?: string;
      strokeWidth?: number;
      fill?: string | false;
    }

  // ─── TYPE-ONLY (defined but not rendered by action-flow-to-html) ──

  | { t: number; op: "rect"; x: number; y: number; w: number; h: number; r?: number; stroke?: string | false; strokeWidth?: number; fill?: string | false; }
  | { t: number; op: "ellipse"; cx: number; cy: number; rx: number; ry: number; stroke?: string | false; strokeWidth?: number; fill?: string | false; }
  | { t: number; op: "path"; d: string; stroke?: string; strokeWidth?: number; fill?: string; dashed?: boolean; }
  | { t: number; op: "progressBar"; x: number; y: number; w: number; h: number; value: number; max?: number; label?: string; fill?: string; trackFill?: string; }
  | { t: number; op: "badge"; x: number; y: number; value: string; style?: "neutral"|"accent"|"warning"|"success"|"danger"; }
  | { t: number; op: "table"; x: number; y: number; w: number; h: number; headers: string[]; rows: string[][]; striped?: boolean; }
  | { t: number; op: "numberCounter"; x: number; y: number; from: number; to: number; prefix?: string; suffix?: string; decimals?: number; }
  | { t: number; op: "highlight"; x: number; y: number; w: number; h: number; style?: "underline"|"box"; fill?: string; opacity?: number; }
  | { t: number; op: "group"; children: ActionIR[]; }
  | { t: number; op: "transform"; translate?: [number, number]; children: ActionIR[]; };
```

---

## Script Types

### VideoScript

```typescript
interface VideoScript {
  title: string;
  description: string;          // Full description (chapters appended during upload)
  tags: string[];
  narration: string;            // Complete narration text for entire video
  scenes: SceneIR[];            // Visual scenes (5–10 typically)
  shorts: ShortScript[];        // 3–5 shorts
}
```

### ShortScript

```typescript
interface ShortScript {
  id: string;                   // "short-0", "short-1", etc.
  hook: string;                 // The attention-grabbing hook text
  scenes: [
    SceneIR,                   // Hook scene: id="hook", narration="", baseDuration 0.8–1.5s
    SceneIR                    // Content scene: has narration + actions
  ];
}
```

### Script Generation Output

```typescript
interface GenerateScriptOutput {
  videoId: string;              // "video-{timestamp}"
  script: VideoScript;
}
```

---

## Worker Types

### VideoAssemblyInput

```typescript
interface VideoAssemblyInput {
  jobId: string;                // Cloudinary folder identifier (e.g., "video-123")
  videoId: string;              // Same as jobId typically
  clips: string[];              // Cloudinary URLs of scene MP4s
  clipTimings?: number[];       // Optional duration hints per clip
  animationStopTimes?: number[]; // When animations finish per scene (from renderer)
  perSceneNarration: string[];  // Text per scene ("" = silence for hook)
  narrationAudios?: string[];   // Cloudinary URLs for pre-generated narration WAVs
  music?: string;               // Path to background music file (auto-selected if absent)
  branding?: {
    logo?: string;              // Logo PNG for shorts overlay
    intro?: string;             // Intro video path
    outro?: string;             // Outro video path
  };
  isShort?: boolean;            // Portrait 1080×1920 vertical format
  voiceoverProvider?: string;   // 'gemini' | 'f5' (affects audio ducking volumes)
}
```

### VideoAssemblyResult

```typescript
interface VideoAssemblyResult {
  videoId: string;
  outputUrl: string;            // Cloudinary URL of final MP4
  duration: number;             // Total video duration in seconds
  clipCount: number;            // Number of scenes assembled
  sceneDurations?: number[];    // Actual duration of each scene (for YouTube chapters)
}
```

### RenderScenesOutput

```typescript
interface RenderScenesOutput {
  urls: string[];               // Cloudinary URLs for each rendered scene MP4
  timings: number[];            // Duration of each clip in seconds
  animationStopTimes: number[]; // When animations finish per scene
}
```

### VoiceOverOutput

```typescript
interface VoiceOverOutput {
  urls: string[];               // Cloudinary URLs for each narration WAV
}
```

### YouTubeUploadInput

```typescript
interface YouTubeUploadInput {
  videoUrl: string;             // Cloudinary video URL
  isShort?: boolean;
  title: string;
  description: string;
  tags?: string[];
  thumbnailUrl?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
  scheduledPublishTime?: string; // ISO 8601 UTC

  // Chapter timestamps (long-form only)
  sceneTitles?: string[];
  sceneDurations?: number[];
  hasIntro?: boolean;
  introDuration?: number;
  introTitle?: string;
  hasOutro?: boolean;
  outroDuration?: number;
  outroTitle?: string;
}
```

---

## Idea Selector Types

### TopicIdea (Full)

```typescript
interface TopicIdea {
  topic: string;
  reasoning: string;
  curiosityAngle:
    | 'Myth'
    | 'Hidden Cost'
    | 'Surprising Truth'
    | 'Counterintuitive Behavior'
    | 'Tradeoff'
    | 'Failure Mode'
    | 'Common Mistake';
  audienceBreadthScore: number;    // 0–100
  titlePotentialScore: number;     // 0–100
  performanceScore: number;        // 0–100 (AI estimate)
  targetFormats: {
    longForm: boolean;             // Always true
    shorts: number;                // 3–5
  };
  suggestedAngles: string[];
  estimatedPerformance: {
    score: number;
    confidence: 'low' | 'medium' | 'high';
  };
}
```

### IdeaSelectorResult

```typescript
interface IdeaSelectorResult {
  success: boolean;
  selectedTopic?: TopicIdea;
  channelInsights?: string;         // AI-generated channel analysis text
  generatedIdeas?: TopicIdea[];     // All 15 generated ideas
  trendingSignals?: TrendingSignals;
  error?: string;
}
```

### TrendingSignals

```typescript
interface TrendingSignals {
  youtubeTrending: string[];        // Trending video titles (S&T India)
  hackerNewsTopics: string[];       // HN front-page tech post titles
  redditTopics: string[];           // Top tech subreddit post titles
  fetchedAt: string;                // ISO timestamp
}
```

### HybridScore

```typescript
interface HybridScore {
  idea: TopicIdea;
  aiScore: number;                  // From performanceScore field
  formulaScore: number;             // From historical analytics formula
  audienceBreadth: number;          // audienceBreadthScore
  titlePotential: number;           // titlePotentialScore
  hybrid: number;                   // Weighted composite:
                                    // aiScore×0.34 + formulaScore×0.18 +
                                    // audienceBreadth×0.28 + titlePotential×0.20
}
```

---

## API Response Types

### IdeasQueueResponse

```typescript
interface IdeasQueueResponse {
  ok: boolean;
  ideas: string[];
  count: number;
  error?: string;
}
```

### ScheduleTimesResponse

```typescript
interface ScheduleTimesResponse {
  ok: boolean;
  shortsTimes?: string[];      // ["06:45", "07:45", "08:45", "12:00", "14:00"] — IST
  longFormTime?: string;       // "18:30" — IST
  error?: string;
}
```

### PipelineStatus

```typescript
type JobResult = 'success' | 'failure' | 'skipped' | 'cancelled' | null;

interface PipelineStatus {
  overallStatus: 'success' | 'failure';
  ranAt: string;                    // ISO UTC timestamp
  videoId: string;
  videoTitle: string;
  description?: string;
  youtubeId?: string;               // YouTube video ID for long-form
  videoUrl?: string;                // Cloudinary URL for final MP4
  thumbnailUrl?: string;            // Cloudinary URL for thumbnail
  sceneUrls?: string[];             // Cloudinary URLs for each scene clip
  voiceoverUrls?: string[];         // Cloudinary URLs for each narration WAV
  sceneNarrations?: string[];       // Per-scene narration text
  shortHooks?: string[];            // Hook text for each short
  shorts?: ShortResult[];           // Results for each short
  ideasAdded?: string[];            // Topics pushed to Redis queue this run
  scriptData?: VideoScript;
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
}
```

### ShortResult

```typescript
interface ShortResult {
  shortIndex: number;               // 0-based index in shorts array
  shortId: string;                  // "{videoId}-short-{N}"
  youtubeId: string;                // YouTube video ID
  videoUrl?: string;                // Cloudinary URL
  scheduledPublishTime?: string;    // ISO UTC scheduled publish time
  rank?: number;                    // 0–4 (determines publish slot)
}
```

---

## Configuration Types

### Config

```typescript
interface Config {
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  gemini: {
    apiKey1: string;
    apiKey2?: string;
    apiKey: string;               // Resolves to apiKey1
  };
  voiceover: {
    provider: 'gemini' | 'f5';
    f5: {
      referenceAudioPath: string;
      referenceText: string;
      pythonBin: string;          // Default: 'python3'
    };
  };
  redis: {
    url: string;
  };
  youtube: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  website: {
    domain: string;               // e.g., "https://your-site.vercel.app"
  };
  sceneRendering: {
    method: 'code' | 'ai';
  };
  video: {
    long: VideoFormat;
    short: VideoFormat;
  };
  thumbnail: {
    enabled: boolean;
  };
  workDir: string;                // Local working directory for temporary files
}

interface VideoFormat {
  width: number;                  // 1920 (long) or 1080 (short)
  height: number;                 // 1080 (long) or 1920 (short)
  fps: number;                    // 30
}
```

---

## Theme Types

### ColorTheme

```typescript
interface ColorTheme {
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentSoft: string;
  warning: string;
  success: string;
  danger: string;
  border: string;
}

// Light theme (even-indexed scenes)
const THEME_LIGHT: ColorTheme = {
  bg: "#FAFAF9",
  surface: "#F5F5F4",
  textPrimary: "#18181B",
  textSecondary: "#52525B",
  accent: "#6366F1",
  accentSoft: "#E0E7FF",
  warning: "#F59E0B",
  success: "#10B981",
  danger: "#EF4444",
  border: "#E5E5E5",
};

// Dark theme (odd-indexed scenes)
const THEME_DARK: ColorTheme = {
  bg: "#0F172A",
  surface: "#1E293B",
  textPrimary: "#F1F5F9",
  textSecondary: "#CBD5E1",
  accent: "#818CF8",
  accentSoft: "rgba(129, 140, 248, 0.2)",
  warning: "#FBBF24",
  success: "#34D399",
  danger: "#F87171",
  border: "#334155",
};
```

---

## Syntax Highlighting Types

### Token

```typescript
enum TokenType {
  Keyword = "keyword",
  String = "string",
  Number = "number",
  Comment = "comment",
  Function = "function",
  Operator = "operator",
  Punctuation = "punctuation",
  Variable = "variable",
  Type = "type",
  BuiltIn = "builtin",
  Plain = "plain",
}

interface Token {
  type: TokenType;
  value: string;
}
```

---

## Redis Key Schemas

| Key | Type | Schema | TTL |
|-----|------|--------|-----|
| `video:ideas` | List | `string[]` | Permanent |
| `shorts:publish-times` | String | JSON `string[5]` HH:MM IST | Permanent |
| `longform:publish-time` | String | `"HH:MM"` IST | Permanent |
| `pipeline:status` | String | JSON `PipelineStatus` | Permanent |
| `pipeline:shorts:{videoId}` | List | JSON `ShortResult[]` | 7 days |
| `expo:push-tokens` | Set | `string[]` Expo tokens | Permanent |
| `html_queue:turn` | String | Integer string | Permanent |
| `html_queue:processing` | String | `"true"` | Cleared after 22s cooldown |
| `html_queue:last_enquiry` | String | Millisecond timestamp | Permanent |

---

## Video Dimensions

### Long-form (Landscape)

```typescript
{
  width: 1920,
  height: 1080,
  fps: 30,
  aspectRatio: "16:9"
}
```

### Shorts (Portrait)

```typescript
{
  width: 1080,
  height: 1920,
  fps: 30,
  aspectRatio: "9:16"
}
```

---

## Constants

### Default Publish Schedule Times (IST)

```typescript
// Default if Redis has no configured times
const DEFAULT_SHORTS_TIMES = [
  "06:45",  // Rank 0 — Best engagement window
  "07:45",  // Rank 1
  "08:45",  // Rank 2
  "12:00",  // Rank 3
  "14:00",  // Rank 4 — Worst engagement window
];

const DEFAULT_LONG_FORM_TIME = "18:30";  // IST — Evening prime time
```

### TTS Voices (Gemini)

```typescript
const VOICES = {
  PUCK: "Puck",        // Friendly, warm — DEFAULT
  CHARON: "Charon",    // Deep, authoritative
  KORE: "Kore",        // Clear, professional
  FENRIR: "Fenrir",    // Strong, confident
  AOEDE: "Aoede",      // Soft, pleasant
};
```

### Hybrid Scoring Weights

```typescript
const SCORING_WEIGHTS = {
  aiScore: 0.34,
  formulaScore: 0.18,
  audienceBreadth: 0.28,
  titlePotential: 0.20,
};
// hybrid = aiScore×0.34 + formulaScore×0.18 + audienceBreadth×0.28 + titlePotential×0.20
```

### Hard Elimination Thresholds

```typescript
const RECENCY_WINDOW_DAYS = 30;       // Block topics from last 30 days
const OVERUSE_MULTIPLIER = 2;         // Block if used 2× more than average
const QUEUE_OVERLAP_THRESHOLD = 0.6;  // Block if >60% word overlap with queued ideas
```

### Audio Ducking Volumes

```typescript
// Gemini TTS provider
const GEMINI_BGM_NARRATION = 0.15;   // 15% during narration
const GEMINI_BGM_OUTRO = 0.30;       // 30% during outro

// F5-TTS voice clone provider (quieter voice → less ducking needed)
const F5_BGM_NARRATION = 0.05;       // 5% during narration
const F5_BGM_OUTRO = 0.15;           // 15% during outro
const F5_NARRATION_BOOST = 1.5;      // 1.5× amplify narration volume
```

### FFmpeg Quality Settings

```typescript
const FFMPEG = {
  codec: "libx264",
  preset: "medium",
  sceneRenderCRF: 16,     // High quality for scene encoding
  assembleCRF: 18,         // High quality for assembly/normalization
  threads: 1,              // Reduced thread count for CI memory constraints
  audioCodec: "aac",
  audioBitrate: "192k",
  audioSampleRate: 48000,
  audioChannels: 2,        // Stereo
};
```

---

## Related Documents

- [02-scene-rendering.md](./02-scene-rendering.md) — Scene rendering and ActionIR details
- [04-ai-integrations.md](./04-ai-integrations.md) — AI service types and scoring
- [06-website-api.md](./06-website-api.md) — API response types
