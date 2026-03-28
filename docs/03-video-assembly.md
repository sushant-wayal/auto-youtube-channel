# Video Assembly Pipeline

> FFmpeg-based video composition with audio mixing and branding

This document explains how scene clips, voiceovers, music, and branding are assembled into final videos.

---

## Overview

The video assembler combines multiple assets into a final video:

```
Scene Clips + Voiceovers + Background Music + Intro/Outro = Final Video
```

### Assembly Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  1. SCENE PROCESSING (per scene)                                  │
│     • Download scene clip from Cloudinary                        │
│     • Download voiceover audio (or generate silence)             │
│     • Calculate target duration (animation stop + audio)         │
│     • Normalize clip to target duration                          │
│     • Attach voiceover audio to clip                             │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  2. CONCATENATION                                                 │
│     • FFmpeg concat all scene clips (single pass)                │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  3. BACKGROUND MUSIC MIXING                                       │
│     • Loop music to match video duration                         │
│     • Mix with existing audio:                                   │
│       - 15% volume during narration                              │
│       - 30% volume during outro                                  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  4. BRANDING (long-form only)                                     │
│     • Prepend 8-second intro video                               │
│     • Append 8-second outro video                                │
│     • Preserve original audio of intro/outro                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  5. FINALIZATION                                                  │
│     • Shorts: Add logo overlay (top-right corner)               │
│     • Upload final video to Cloudinary                           │
│     • Return video URL and scene durations                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Input Structure

```typescript
interface VideoAssemblyInput {
  jobId: string;              // Cloudinary folder identifier
  videoId: string;            // Unique video identifier
  clips: string[];            // Cloudinary URLs of scene clips
  clipTimings?: number[];     // Optional timing hints
  animationStopTimes?: number[]; // When animations finish
  perSceneNarration: string[]; // Narration text per scene
  narrationAudios?: string[]; // Cloudinary URLs for voiceovers
  music?: string;             // Path to background music
  branding?: {
    logo?: string;            // Logo image for shorts
    intro?: string;           // Intro video (8s)
    outro?: string;           // Outro video (8s)
  };
  isShort?: boolean;          // Vertical format (1080x1920)
}
```

---

## Output Structure

```typescript
interface VideoAssemblyResult {
  videoId: string;            // Same as input
  outputPath: string;         // Local path to final video
  duration: number;           // Total duration in seconds
  clipCount: number;          // Number of scenes
  sceneDurations?: number[];  // Actual duration of each scene
}
```

The `sceneDurations` array is crucial for generating YouTube chapter timestamps.

---

## Video Formats

### Landscape (Long-form)
```typescript
{
  width: 1920,
  height: 1080,
  scale: 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black',
  fps: 30
}
```

### Portrait (Shorts)
```typescript
{
  width: 1080,
  height: 1920,
  scale: 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
  fps: 30
}
```

---

## Scene Processing

### Duration Calculation

Each scene's duration is calculated as:

```
targetDuration = max(animationStopTime + 0.5, voiceoverDuration)
```

Where:
- `animationStopTime` = when all animations complete
- `0.5s` buffer = breathing room after animations
- `voiceoverDuration` = actual length of TTS audio

### Clip Normalization

Clips are normalized to target duration:

```bash
# If original duration < target: extend by cloning last frame
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080,fps=30,tpad=stop_mode=clone:stop_duration=X" \
  -c:v libx264 -preset medium -crf 18 \
  output.mp4

# If original duration >= target: trim to target
ffmpeg -i input.mp4 \
  -t {targetDuration} \
  -vf "scale=1920:1080,fps=30" \
  -c:v libx264 -preset medium -crf 18 \
  output.mp4
```

### Audio Attachment

Each scene gets its voiceover attached:

```bash
ffmpeg -i video.mp4 -i audio.wav \
  -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -shortest \
  output.mp4
```

### Empty Narration Handling

Scenes with empty narration (e.g., hook scenes in shorts) get silence audio:

```bash
ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo \
  -t {clipDuration} \
  -c:a pcm_s16le \
  silence.wav
```

---

## Background Music Mixing

### Audio Ducking

Background music volume is automatically adjusted:

| Section | Volume | Reason |
|---------|--------|--------|
| During narration | 15% | Keep focus on speech |
| During outro | 30% | Louder ending presence |

### FFmpeg Filter Complex

```bash
# Music loops throughout, with volume ducking
[1:a]aloop=loop=-1:size=2e+09,atrim=0:{totalDuration}[music];
anullsrc=r=48000:cl=stereo,atrim=0:{outroDuration}[silence];
[0:a][silence]concat=n=2:v=0:a=1[narration_padded];
[music]asplit=2[music1][music2];
[music1]volume=0.15,atrim=0:{narrationDuration}[bgm_narration];
[music2]volume=0.30,atrim={narrationDuration}:{totalDuration}[bgm_outro];
[narration_padded][bgm_narration]amix=inputs=2:duration=first[main];
[main][bgm_outro]concat=n=2:v=0:a=1[out]
```

---

## Branding Assets

### Asset Structure

```
workers/video-assembler/src/lib/assets/
├── branding/
│   ├── logo.png              # Logo overlay (120px width)
│   ├── intro.mp4             # 8-second intro video
│   └── outro.mp4             # 8-second outro video
│
└── music/
    ├── track1.mp3            # Background music
    ├── track2.mp3
    └── ...                   # Random selection
```

### Music Selection

Background tracks are randomly selected:

```typescript
import { pickBackgroundTrack } from './music-branding';

const musicPath = pickBackgroundTrack();
// Randomly selects from assets/music/*.mp3
```

### Branding Asset Loading

```typescript
import { getBrandingAssets } from './music-branding';

const branding = getBrandingAssets();
// Returns: { logo?: string, intro?: string, outro?: string }
```

---

## Intro/Outro Processing

### Long-form Videos

Intro and outro are added with their **original audio preserved**:

```typescript
// Intro → Main Content (with music) → Outro
const clips = [
  normalizedIntro,    // 8s intro video (original audio)
  mainVideoPath,      // Combined scenes + narration + music
  normalizedOutro     // 8s outro video (original audio)
];
await concatClips(clips, outputPath);
```

### Shorts

Shorts do **NOT** include intro/outro, but do get a logo overlay:

```bash
# Logo overlay in top-right corner
ffmpeg -i video.mp4 -i logo.png \
  -filter_complex "[1:v]scale=120:-1[logo];[0:v][logo]overlay=W-w-20:20" \
  -c:v libx264 -preset medium -crf 18 \
  output.mp4
```

---

## FFmpeg Commands Reference

### Concatenation

```bash
# Create concat list file
echo "file 'scene1.mp4'
file 'scene2.mp4'
file 'scene3.mp4'" > concat.txt

# Concatenate (stream copy if compatible)
ffmpeg -f concat -safe 0 -i concat.txt \
  -c copy -movflags +faststart \
  output.mp4

# Concatenate (re-encode for compatibility)
ffmpeg -f concat -safe 0 -i concat.txt \
  -c:v libx264 -preset medium -crf 18 \
  -c:a aac -b:a 192k \
  -movflags +faststart \
  output.mp4
```

### Video Duration Query

```typescript
import { getVideoDuration } from './ffmpeg-utils';

const duration = await getVideoDuration('video.mp4');
// Returns duration in seconds (e.g., 45.23)
```

### Loop Audio to Duration

```bash
ffmpeg -i music.mp3 \
  -filter_complex "aloop=loop=-1:size=2e+09,atrim=0:{duration}" \
  -c:a libmp3lame -b:a 192k -ar 48000 \
  looped_music.mp3
```

---

## Quality Settings

### Video Encoding

| Setting | Value | Description |
|---------|-------|-------------|
| Codec | `libx264` | H.264 encoding |
| Preset | `medium` | Balance of speed/quality |
| CRF | `18` | High quality (lower = better) |
| FPS | `30` | Frame rate |

### Audio Encoding

| Setting | Value | Description |
|---------|-------|-------------|
| Codec | `aac` | AAC audio |
| Bitrate | `192k` | High quality |
| Sample Rate | `48000` | 48 kHz |
| Channels | `2` | Stereo |

---

## Scene Duration Tracking

Scene durations are tracked for YouTube chapter timestamps:

```typescript
const sceneDurations: number[] = [];

for (let i = 0; i < clips.length; i++) {
  const targetDuration = calculateTargetDuration(scene);
  sceneDurations.push(targetDuration);
  // ... process scene
}

// Return for timestamp generation
return { sceneDurations, ... };
```

### Chapter Timestamp Generation

Given scene durations `[38, 32, 45, 28]`:

```
0:00 - Intro (8s)
0:08 - Scene 1 (38s)
0:46 - Scene 2 (32s)
1:18 - Scene 3 (45s)
2:03 - Scene 4 (28s)
2:31 - Outro (8s)
```

---

## Error Handling

### Concat Fallback

If stream-copy concat fails (codec mismatch), it automatically re-encodes:

```typescript
try {
  // Try fast stream copy
  await runFFmpeg({ args: ['-c', 'copy'] });
} catch (copyErr) {
  console.error('Stream-copy failed, re-encoding...');
  // Fallback to re-encode
  await runFFmpeg({ args: ['-c:v', 'libx264', '-c:a', 'aac'] });
}
```

### Missing Assets

- **No music**: Generates silence audio
- **No branding**: Skips intro/outro
- **No logo**: Skips overlay for shorts

---

## Resource Cleanup

Intermediate files are cleaned up aggressively:

```typescript
// After each scene is processed
await Promise.allSettled([
  fsPromises.unlink(clipPath),
  fsPromises.unlink(sceneAudio),
  fsPromises.unlink(sceneVideo),
]);

// After concatenation
await Promise.allSettled(
  preparedSceneClips.map(path => fsPromises.unlink(path))
);
```

---

## Next: [04-ai-integrations.md](./04-ai-integrations.md)
