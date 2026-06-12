# Video Assembly Pipeline

> FFmpeg-based video composition with audio mixing and branding

This document explains how scene clips, voiceovers, music, and branding are assembled into final videos.

---

## Overview

The video assembler (`workers/video-assembler/`) combines multiple assets into a final video:

```
Scene Clips + Narration Audio + Background Music + Intro/Outro/Logo = Final MP4
```

### Assembly Flow

```
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 1: Setup                                                    │
│     Create working directory: videos/{videoId}/                   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 2: Per-Scene Processing (loop over each clip)              │
│     • Download scene MP4 from Cloudinary                         │
│     • Download narration WAV (or generate silence if empty)      │
│     • targetDuration = max(animationStop + 0.5s, narrationLen)   │
│     • Normalize clip: scale + pad/trim to targetDuration         │
│     • Attach narration audio (mux into scene clip)               │
│     • Record sceneDuration[i] for chapter timestamps             │
│     • Cleanup: delete intermediate files                         │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 3: Concatenation                                           │
│     • FFmpeg concat demuxer (stream-copy first)                  │
│     • Auto-fallback to re-encode on codec mismatch               │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 4: Background Music Mixing                                 │
│     • Loop music track to match video length                     │
│     • Narration section: BGM at 15% (5% if F5-TTS voice)         │
│     • Outro silence section: BGM at 30% (15% if F5-TTS)         │
│     • F5-TTS mode: boost narration audio 1.5×                   │
│     • amix narration + BGM → concat with louder outro BGM        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 5: Branding                                                │
│     Long-form AND intro/outro available:                         │
│       • normalizeClipWithAudio(intro)                            │
│       • + main video with music                                  │
│       • + normalizeClipWithAudio(outro)                          │
│       • concat → with_branding.mp4                               │
│     Short:                                                        │
│       • Logo overlay: scale logo→120px, top-right, 20px padding  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  STAGE 6: Upload                                                  │
│     • Upload final.mp4 to Cloudinary                             │
│     • Return: outputUrl, duration, clipCount, sceneDurations     │
└──────────────────────────────────────────────────────────────────┘
```

---

## Input Structure

```typescript
interface VideoAssemblyInput {
  jobId: string;                // Cloudinary folder identifier
  videoId: string;              // Unique video identifier
  clips: string[];              // Cloudinary URLs of rendered scene MP4s
  clipTimings?: number[];       // Optional duration hints per clip
  animationStopTimes?: number[]; // When animations finish per scene
  perSceneNarration: string[];  // Narration text per scene (empty = silence)
  narrationAudios?: string[];   // Cloudinary URLs for pre-generated narration WAVs
  music?: string;               // Path to background music file
  branding?: {
    logo?: string;              // Logo PNG for shorts overlay
    intro?: string;             // Intro video path
    outro?: string;             // Outro video path
  };
  isShort?: boolean;            // Vertical format 1080×1920
  voiceoverProvider?: string;   // 'gemini' | 'f5' (affects ducking volumes)
}
```

---

## Output Structure

```typescript
interface VideoAssemblyResult {
  videoId: string;
  outputUrl: string;            // Cloudinary URL of final video
  duration: number;             // Total video duration in seconds
  clipCount: number;            // Number of scenes assembled
  sceneDurations?: number[];    // Actual duration of each scene (for chapters)
}
```

`sceneDurations` is passed to the YouTube upload worker for chapter timestamp generation.

---

## Video Formats

### Landscape (Long-form)

```
Width:  1920px
Height: 1080px
FPS:    30
Aspect: 16:9
Scale filter: scale=1920:1080:force_original_aspect_ratio=decrease,
              pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black
```

### Portrait (Shorts)

```
Width:  1080px
Height: 1920px
FPS:    30
Aspect: 9:16
Scale filter: scale=1080:1920:force_original_aspect_ratio=increase,
              crop=1080:1920
```

---

## Scene Processing Detail

### Duration Calculation

```
targetDuration = max(animationStopTime + 0.5s, narrationDuration)

Where:
  animationStopTime = when all animations in the scene complete
  0.5s              = breathing room buffer after last animation
  narrationDuration = actual WAV audio duration (or clip length if silent)

Special cases:
  if animationStopTime ≤ 0 or NaN → use narrationDuration as base
```

### Clip Normalization (FFmpeg)

```bash
# Case 1: clip is shorter than targetDuration → extend by cloning last frame
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,
       pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,
       fps=30,
       tpad=stop_mode=clone:stop_duration={extendSeconds}" \
  -c:v libx264 -preset medium -crf 18 -threads 1 \
  -an scene_video_i.mp4

# Case 2: clip is long enough → scale + trim to targetDuration
ffmpeg -i input.mp4 \
  -t {targetDuration} \
  -vf "scale=...,fps=30" \
  -c:v libx264 -preset medium -crf 18 -threads 1 \
  -an scene_video_i.mp4
```

### Audio Attachment

```bash
# Attach narration WAV to normalized scene video
ffmpeg -i scene_video_i.mp4 -i narration.wav \
  -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -t {videoDuration} \
  scene_with_audio_i.mp4
```

If audio is longer than video, video is first extended then muxed.

### Silent Audio Generation (Empty Narration)

Hook scenes and other empty-narration scenes get silence:

```bash
ffmpeg -f lavfi -i anullsrc=r=48000:cl=stereo \
  -t {clipDuration} \
  -c:a pcm_s16le \
  silence.wav
```

---

## Background Music Mixing

### Audio Ducking Logic

| Voiceover Provider | Narration Section BGM | Outro Section BGM | Narration Boost |
|-------------------|-----------------------|-------------------|-----------------|
| `gemini` (default) | **15%** | **30%** | — |
| `f5` (voice clone) | **5%** | **15%** | **1.5×** |

F5-TTS audio tends to be quieter, hence the boost + reduced BGM.

### FFmpeg Filter Complex

```bash
# 1. Loop music to total video duration
ffmpeg -i music.mp3 \
  -filter_complex "aloop=loop=-1:size=2e+09,atrim=0:{totalDuration}" \
  -c:a libmp3lame -b:a 192k -ar 48000 \
  looped_music.mp3

# 2. Mix narration + ducked BGM, then concat louder BGM for outro
ffmpeg -i combined_video_audio.mp4 -i looped_music.mp3 \
  -filter_complex "
    [1:a]asplit=2[music1][music2];
    [music1]volume={bgmNarration},atrim=0:{narrationDuration}[bgm_narration];
    [music2]volume={bgmOutro},atrim={narrationDuration}:{totalDuration}[bgm_outro];
    anullsrc=r=48000:cl=stereo,atrim=0:{outroDuration}[silence];
    [0:a][silence]concat=n=2:v=0:a=1[narration_padded];
    [narration_padded][bgm_narration]amix=inputs=2:duration=first[main];
    [main][bgm_outro]concat=n=2:v=0:a=1[out]
  " \
  -map 0:v -map "[out]" \
  -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 \
  combined_with_music.mp4
```

---

## Branding Assets

### Asset Structure

```
workers/video-assembler/src/lib/assests/    ← "assests" is the actual folder name (typo in code)
├── music/                   # Background music tracks
│   ├── track1.mp3
│   ├── track2.mp3
│   └── ...
├── logo.png                 # Logo overlay (scaled to 120px width)
├── intro.mp4                # Intro video (original audio preserved)
└── outro.mp4                # Outro video (original audio preserved)
```

### Music Selection

```typescript
import { pickBackgroundTrack } from './music-branding';

const musicPath = pickBackgroundTrack();
// Randomly selects from src/lib/assests/music/*.mp3
```

### Branding Loading

```typescript
import { getBrandingAssets } from './music-branding';

const branding = getBrandingAssets();
// Returns: { logo?: string, intro?: string, outro?: string }
// Returns undefined paths if files are not found
```

---

## Intro/Outro Processing

### Long-form Videos

Intro and outro are prepended/appended with their **original audio preserved**:

```typescript
// Normalize intro/outro to correct resolution
const normalizedIntro = await normalizeClipWithAudio(intro, { width, height });
const normalizedOutro = await normalizeClipWithAudio(outro, { width, height });

// Concatenate: intro + main (with narration + music) + outro
await concatClips([normalizedIntro, mainVideoWithMusic, normalizedOutro], outputPath);
```

### Shorts

Shorts do **NOT** include intro/outro. Instead, they get a logo overlay:

```bash
ffmpeg -i video.mp4 -i logo.png \
  -filter_complex "[1:v]scale=120:-1[logo];[0:v][logo]overlay=W-w-20:20" \
  -c:v libx264 -preset medium -crf 18 -threads 1 \
  -c:a copy \
  output.mp4
```

Logo is positioned at `top-right` with 20px padding from both edges.

---

## Concatenation

### Stream-Copy (Fast Path)

```bash
# Generate concat list
echo "file 'scene_with_audio_0.mp4'
file 'scene_with_audio_1.mp4'
..." > concat_list.txt

ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c copy -movflags +faststart \
  combined_video.mp4
```

### Re-encode Fallback

If stream-copy fails (codec incompatibility), automatically falls back to:

```bash
ffmpeg -f concat -safe 0 -i concat_list.txt \
  -c:v libx264 -preset medium -crf 18 -threads 1 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart \
  combined_video.mp4
```

---

## FFmpeg Quality Reference

### Video Encoding Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Codec | `libx264` | H.264 encoding |
| Preset | `medium` | Speed/quality balance |
| CRF | `18` (normalization), `16` (scene render) | Lower = higher quality |
| FPS | `30` | Frame rate |
| Pixel Format | `yuv420p` | Maximum compatibility |
| Threads | `1` | CI memory constraint |

### Audio Encoding Settings

| Setting | Value | Notes |
|---------|-------|-------|
| Codec | `aac` | AAC audio |
| Bitrate | `192k` | High quality |
| Sample Rate | `48000` Hz | 48 kHz (professional standard) |
| Channels | `2` | Stereo |

---

## Scene Duration Tracking

Scene durations are tracked throughout assembly and returned for YouTube chapter timestamps:

```typescript
const sceneDurations: number[] = [];

for (let i = 0; i < clips.length; i++) {
  const targetDuration = calculateTargetDuration(
    animationStopTimes[i],
    await getAudioDuration(narrationPath)
  );
  sceneDurations.push(targetDuration);
  // ... normalize + attach audio
}

return { sceneDurations, outputUrl, duration, clipCount };
```

### Chapter Timestamp Example

Given scene durations `[8, 38, 32, 45, 28, 8]` (intro + 4 scenes + outro):

```
0:00 Intro
0:08 Why Caching Breaks
0:46 The Real Problem
1:18 Production Impact
2:03 The Fix
2:31 Outro
```

---

## Error Handling

### Concat Fallback

```typescript
try {
  // Attempt fast stream-copy concat
  await runFFmpegCommand(['-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', output]);
} catch (copyErr) {
  console.error('Stream-copy concat failed, falling back to re-encode:', copyErr.message);
  // Re-encode fallback
  await runFFmpegCommand(['-f', 'concat', '-safe', '0', '-i', listFile,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-c:a', 'aac', '-b:a', '192k', output]);
}
```

### Missing Assets Handling

| Missing Asset | Behavior |
|---------------|----------|
| No music file | Generate silence for audio track |
| No intro/outro | Skip branding stage |
| No logo | Skip overlay for shorts |
| Empty narration | Generate silence WAV matching clip duration |
| animationStopTime ≤ 0 | Fall back to narration duration as clip length |

---

## Resource Cleanup

Intermediate files are cleaned up aggressively after each stage:

```typescript
// After each scene is processed
await Promise.allSettled([
  fs.unlink(clipPath),           // Original downloaded clip
  fs.unlink(sceneAudio),         // Downloaded narration WAV
  fs.unlink(sceneVideoPath),     // Normalized video (no audio)
  // scene_with_audio_i.mp4 kept until concat
]);

// After concatenation is complete
await Promise.allSettled(
  preparedSceneClips.map(p => fs.unlink(p))
);
```

---

## Next: [04-ai-integrations.md](./04-ai-integrations.md)
