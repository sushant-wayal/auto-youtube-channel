# Types and Data Schemas

> TypeScript types and data structures used throughout the pipeline

This document provides a comprehensive reference for all major types and schemas.

---

## Scene Definitions

### SceneIR (Scene Intermediate Representation)

```typescript
interface SceneIR {
  id: string;                              // Unique identifier (e.g., "scene-1")
  sceneTitle?: string;                     // Title for YouTube chapters
  sceneTheme?: "light" | "dark" | "auto";  // Visual theme
  baseDuration: number;                    // Animation duration in seconds
  holdDuration: number;                    // Hold time after animations
  narration?: string;                      // Scene narration text
  actions: ActionIR[];                     // Visual primitives
}
```

### ActionIR (Visual Primitives)

```typescript
type ActionIR =
  // Line
  | {
      t: number;              // Start time (seconds)
      op: "line";
      x1: number; y1: number; // Start point
      x2: number; y2: number; // End point
      stroke?: string;        // Color
      strokeWidth?: number;
      dashed?: boolean;
      dashLength?: number;
      dashGap?: number;
      arrow?: boolean;        // Arrow head at end
      curve?: number;         // Curve amount (0 = straight)
    }

  // Rectangle
  | {
      t: number;
      op: "rect";
      x: number; y: number;   // Top-left corner
      w: number; h: number;   // Dimensions
      r?: number;             // Border radius
      stroke?: string | false;
      strokeWidth?: number;
      fill?: string | false;
    }

  // Ellipse
  | {
      t: number;
      op: "ellipse";
      cx: number; cy: number; // Center
      rx: number; ry: number; // Radii
      stroke?: string | false;
      strokeWidth?: number;
      fill?: string | false;
    }

  // SVG Path
  | {
      t: number;
      op: "path";
      d: string;              // SVG path data
      stroke?: string;
      strokeWidth?: number;
      fill?: string;
      dashed?: boolean;
      dashLength?: number;
      dashGap?: number;
    }

  // Text
  | {
      t: number;
      op: "text";
      x: number; y: number;
      value: string;
      fontSize?: number;
      size?: "title" | "subtitle" | "body" | "label";
      fontWeight?: number;
      fill?: string;
      align?: "left" | "center" | "right";
      baseline?: "top" | "middle" | "bottom";
      typewriter?: boolean;   // Character-by-character animation
      monospace?: boolean;
    }

  // Code Block
  | {
      t: number;
      op: "codeBlock";
      x: number; y: number;
      w: number; h: number;
      lines: string[];
      language: string;       // js, ts, py, java, go, rust, etc.
      theme?: "light" | "dark";
      fontSize?: number;
      showLineNumbers?: boolean;
      highlightLine?: number;
      maxVisibleLines?: number;
      cursor?: boolean;
    }

  // Progress Bar
  | {
      t: number;
      op: "progressBar";
      x: number; y: number;
      w: number; h: number;
      value: number;
      max?: number;           // Default: 100
      label?: string;
      r?: number;             // Border radius
      fill?: string;
      trackFill?: string;
      stroke?: string;
      strokeWidth?: number;
    }

  // Badge
  | {
      t: number;
      op: "badge";
      x: number; y: number;
      value: string;
      style?: "neutral" | "accent" | "warning" | "success" | "danger";
      fontSize?: number;
      fontWeight?: number;
      paddingX?: number;
      paddingY?: number;
      fill?: string;
      stroke?: string;
      textColor?: string;
      icon?: string;
    }

  // Icon
  | {
      t: number;
      op: "icon";
      x: number; y: number;
      name: string;           // check, cross, warning, info, database, etc.
      size?: number;
      stroke?: string;
      strokeWidth?: number;
      fill?: string | false;
    }

  // Table
  | {
      t: number;
      op: "table";
      x: number; y: number;
      w: number; h: number;
      headers: string[];
      rows: string[][];
      striped?: boolean;
      headerFill?: string;
      gridStroke?: string;
      textColor?: string;
      fontSize?: number;
      align?: "left" | "center" | "right";
    }

  // Number Counter
  | {
      t: number;
      op: "numberCounter";
      x: number; y: number;
      from: number;
      to: number;
      prefix?: string;
      suffix?: string;
      decimals?: number;
      fontSize?: number;
      size?: "title" | "subtitle" | "body" | "label";
      fontWeight?: number;
      fill?: string;
      align?: "left" | "center" | "right";
    }

  // Highlight
  | {
      t: number;
      op: "highlight";
      x: number; y: number;
      w: number; h: number;
      style?: "underline" | "box";
      r?: number;
      fill?: string;
      opacity?: number;
    }

  // Group
  | {
      t: number;
      op: "group";
      children: ActionIR[];
    }

  // Transform
  | {
      t: number;
      op: "transform";
      translate?: [number, number];
      children: ActionIR[];
    };
```

---

## Script Types

### VideoScript

```typescript
interface VideoScript {
  title: string;
  description: string;
  tags: string[];
  narration: string;          // Full narration text
  scenes: SceneIR[];
  shorts: ShortScript[];
}
```

### ShortScript

```typescript
interface ShortScript {
  id: string;                 // e.g., "short-1"
  hook: string;               // Attention-grabbing text
  scenes: [
    SceneIR,                  // Hook scene (usually silent)
    SceneIR                   // Content scene (with narration)
  ];
}
```

---

## Worker Types

### VideoAssemblyInput

```typescript
interface VideoAssemblyInput {
  jobId: string;
  videoId: string;
  clips: string[];            // Cloudinary URLs
  clipTimings?: number[];
  animationStopTimes?: number[];
  perSceneNarration: string[];
  narrationAudios?: string[]; // Cloudinary URLs
  music?: string;             // Path to background music
  branding?: {
    logo?: string;
    intro?: string;
    outro?: string;
  };
  isShort?: boolean;
}
```

### VideoAssemblyResult

```typescript
interface VideoAssemblyResult {
  videoId: string;
  outputPath: string;
  duration: number;
  clipCount: number;
  sceneDurations?: number[];
}
```

### CloudinaryUploadResult

```typescript
interface CloudinaryUploadResult {
  publicId: string;
  secureUrl: string;
  format: string;
  duration?: number;
  bytes: number;
}
```

---

## Idea Selector Types

### TopicIdea

```typescript
interface TopicIdea {
  topic: string;
  reasoning: string;
  targetFormats: {
    longForm: boolean;
    shorts: number;           // 3-5
  };
  suggestedAngles: string[];
  estimatedPerformance: {
    score: number;            // 0-100
    confidence: 'low' | 'medium' | 'high';
  };
}
```

### IdeaSelectorResult

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

### TrendingSignals

```typescript
interface TrendingSignals {
  hackerNewsTopics: string[];
  redditTopics: string[];
  twitterTopics: string[];
  githubTrending: string[];
  fetchedAt: string;          // ISO timestamp
}
```

---

## API Types

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
  shortsTimes?: string[];     // ["16:30", "18:00", ...]
  longFormTime?: string;      // "18:30"
  error?: string;
}
```

### PipelineStatus

```typescript
type JobResult = 'success' | 'failure' | 'skipped' | 'cancelled' | null;

interface PipelineStatus {
  overallStatus: 'success' | 'failure';
  ranAt: string;              // ISO timestamp
  videoId: string;
  videoTitle: string;
  description?: string;
  youtubeId?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  sceneUrls?: string[];
  voiceoverUrls?: string[];
  sceneNarrations?: string[];
  shortHooks?: string[];
  shorts?: ShortResult[];
  ideasAdded?: string[];
  scriptData?: unknown;
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
  shortIndex: number;
  shortId: string;
  youtubeId: string;
  videoUrl?: string;
  scheduledPublishTime?: string;
  rank?: number;
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
  };
  redis: {
    url: string;
  };
  youtube: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  video: {
    long: VideoFormat;
    short: VideoFormat;
  };
  workDir: string;
}

interface VideoFormat {
  width: number;
  height: number;
  fps: number;
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

// Light theme colors
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

// Dark theme colors
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

| Key | Type | Schema |
|-----|------|--------|
| `video:ideas` | List | `string[]` |
| `shorts:publish-times` | String | `JSON: string[]` (5 times) |
| `longform:publish-time` | String | `"HH:MM"` |
| `pipeline:status` | String | `JSON: PipelineStatus` |
| `expo:push-tokens` | Set | `string[]` (Expo tokens) |

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

### Default Schedule Times

```typescript
const DEFAULT_SHORTS_TIMES = [
  "16:30",  // Rank 1 (Best)
  "18:00",  // Rank 2
  "20:00",  // Rank 3
  "12:00",  // Rank 4
  "14:00",  // Rank 5 (Worst)
];

const DEFAULT_LONG_FORM_TIME = "18:30";  // IST
```

### TTS Voices

```typescript
const VOICES = {
  PUCK: "Puck",      // Friendly, warm (default)
  CHARON: "Charon",  // Deep, authoritative
  KORE: "Kore",      // Clear, professional
  FENRIR: "Fenrir",  // Strong, confident
  AOEDE: "Aoede",    // Soft, pleasant
};
```

### Text Sizes (Landscape)

```typescript
const TEXT_SIZES = {
  title: 72,
  subtitle: 48,
  body: 32,
  label: 24,
};
```

### Text Sizes (Portrait/Shorts)

```typescript
const TEXT_SIZES_SHORT = {
  title: 96,
  subtitle: 64,
  body: 48,
  label: 36,
};
```

---

## Related Documents

- [02-scene-rendering.md](./02-scene-rendering.md) - Scene rendering details
- [04-ai-integrations.md](./04-ai-integrations.md) - AI service types
- [06-website-api.md](./06-website-api.md) - API response types
