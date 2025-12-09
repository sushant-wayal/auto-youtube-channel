# Video Assembly Layer Documentation

## Overview

The Video Assembly Layer uses FFmpeg to combine stock footage clips, background music, and branding assets into a final polished video. Currently uses placeholder silence for narration timing.

## Architecture

```
lib/video/
├── ffmpeg-utils.ts       - FFmpeg command wrapper & utilities
└── video-assembly.ts     - Main VideoAssemblyService class
```

## What It Does

The Video Assembly Service performs these operations:

1. **Normalize Clips** - Resize all clips to 1920x1080 (maintains aspect ratio, adds letterboxing)
2. **Concatenate** - Join normalized clips into single video
3. **Generate Placeholder Audio** - Creates silent audio track for narration timing
4. **Mix Audio** - Combines placeholder + background music (music at 12% volume)
5. **Overlay Branding** - Adds logo at top-right corner (if available)
6. **Output** - Produces final video at `videos/<videoId>/final.mp4`

## Prerequisites

### FFmpeg Installation

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Check installation:**
```bash
ffmpeg -version
```

## Usage

### Via API Route

```bash
POST /api/assemble-video

Body:
{
  "videoId": "video-1234567890",
  "clips": [
    "/absolute/path/to/clip-001.mp4",
    "/absolute/path/to/clip-002.mp4",
    ...
  ],
  "music": "/absolute/path/to/music.mp3",
  "branding": {
    "logo": "/absolute/path/to/logo.png",
    "intro": "/absolute/path/to/intro.mp4",
    "outro": "/absolute/path/to/outro.mp4"
  }
}

Response:
{
  "success": true,
  "result": {
    "videoId": "video-1234567890",
    "outputPath": "videos/video-1234567890/final.mp4",
    "duration": 45.6,
    "clipCount": 10
  }
}
```

### Programmatic Usage

```typescript
import VideoAssemblyService from "@/lib/video/video-assembly";

const service = new VideoAssemblyService();

const result = await service.assembleVideo({
  videoId: "video-123",
  clips: ["/path/to/clip1.mp4", "/path/to/clip2.mp4"],
  music: "/path/to/music.mp3",
  branding: {
    logo: "/path/to/logo.png"
  }
});

console.log(`Video ready at: ${result.outputPath}`);
console.log(`Duration: ${result.duration}s`);
```

## Implementation Details

### Step 1: Normalize Clips

Ensures all clips are exactly 1920x1080:
- Scales video maintaining aspect ratio
- Adds black letterboxing if needed
- Re-encodes with H.264 (CRF 23, medium preset)
- Standardizes audio to AAC 128kbps

**FFmpeg Command:**
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

### Step 2: Concatenate Clips

Uses FFmpeg concat demuxer for fast, lossless concatenation:

**Creates `concat_list.txt`:**
```
file '/path/to/normalized/clip_1.mp4'
file '/path/to/normalized/clip_2.mp4'
file '/path/to/normalized/clip_3.mp4'
```

**FFmpeg Command:**
```bash
ffmpeg -f concat -safe 0 -i concat_list.txt -c copy combined.mp4
```

### Step 3: Generate Placeholder Narration

Creates silent audio matching video duration:

**FFmpeg Command:**
```bash
ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo \
  -t <duration> \
  -c:a libmp3lame -b:a 128k \
  placeholder_narration.mp3
```

### Step 4: Mix Audio

Combines silence + background music:
- Placeholder at 100% volume (silence)
- Background music at 12% volume
- Music loops infinitely if shorter than video
- Final duration matches video

**FFmpeg Command:**
```bash
ffmpeg -i placeholder.mp3 -i music.mp3 \
  -filter_complex "[0:a]volume=1.0[narration];[1:a]volume=0.12,aloop=loop=-1:size=2e+09[music];[narration][music]amix=inputs=2:duration=first:dropout_transition=2" \
  -t <duration> \
  -c:a libmp3lame -b:a 192k \
  final_audio.mp3
```

### Step 5: Add Audio to Video

Combines video with mixed audio track:

**FFmpeg Command:**
```bash
ffmpeg -i combined.mp4 -i final_audio.mp3 \
  -c:v copy -c:a aac -b:a 192k -shortest \
  video_with_audio.mp4
```

### Step 6: Overlay Branding

Adds logo at top-right with 20px padding:

**FFmpeg Command:**
```bash
ffmpeg -i video_with_audio.mp4 -i logo.png \
  -filter_complex "[1:v]scale=150:-1[logo];[0:v][logo]overlay=W-w-20:20" \
  -c:a copy -c:v libx264 -preset medium -crf 23 \
  final.mp4
```

## Output Structure

```
videos/
└── video-1234567890/
    ├── normalized/
    │   ├── clip_1.mp4
    │   ├── clip_2.mp4
    │   └── ...
    ├── concat_list.txt
    ├── combined.mp4
    ├── placeholder_narration.mp3
    ├── final_audio.mp3
    ├── video_with_audio.mp4
    └── final.mp4          ← Final output
```

## Configuration

### Adjust Logo Size

Edit `video-assembly.ts`:
```typescript
// Change scale=150:-1 to your preferred width (height auto)
'[1:v]scale=200:-1[logo];[0:v][logo]overlay=W-w-20:20'
```

### Adjust Logo Position

```typescript
// Top-left: overlay=20:20
// Top-right: overlay=W-w-20:20 (default)
// Bottom-right: overlay=W-w-20:H-h-20
// Bottom-left: overlay=20:H-h-20
```

### Adjust Music Volume

```typescript
// Change volume=0.12 to your preference (0.0 to 1.0)
'[1:a]volume=0.20,aloop=...'  // 20% volume
```

### Adjust Video Quality

```typescript
// Higher quality (larger file): crf 18
// Balanced (default): crf 23
// Smaller file: crf 28
'-c:v', 'libx264', '-crf', '18', ...
```

## Performance

- **Normalization**: ~2-5 seconds per clip (depends on clip length/quality)
- **Concatenation**: Very fast (~1-2 seconds, copy codec)
- **Audio mixing**: ~1-2 seconds
- **Logo overlay**: ~30-60 seconds (re-encodes entire video)
- **Total time**: ~2-5 minutes for 10 clips

## Error Handling

The service handles errors gracefully:

- **FFmpeg not installed**: Returns clear error message
- **Clip processing fails**: Logs error, continues with other clips
- **No music**: Uses only placeholder audio (silence)
- **No logo**: Skips overlay, copies video directly
- **Invalid paths**: FFmpeg error captured and logged

## Troubleshooting

### "FFmpeg is not installed"
```bash
# Install FFmpeg
sudo apt install ffmpeg  # Ubuntu/Debian
brew install ffmpeg      # macOS

# Verify
ffmpeg -version
```

### "FFmpeg exited with code 1"
- Check console for FFmpeg stderr output
- Verify all file paths are absolute and exist
- Ensure clips are valid video files
- Check disk space

### Logo not appearing
- Verify logo.png exists and is valid PNG
- Check console logs for overlay step
- Try with smaller logo file

### Audio out of sync
- This shouldn't happen with current implementation
- If it does, file an issue with details

### Video too large
- Adjust CRF value (higher = smaller file)
- Use faster preset: `-preset fast`
- Reduce audio bitrate: `-b:a 128k`

## Limitations & Future Improvements

### Current Limitations
- ✗ No real narration audio (placeholder silence only)
- ✗ No intro/outro integration yet
- ✗ No text overlays or captions
- ✗ No transitions between clips
- ✗ Sequential processing (not parallel)

### Planned Improvements
- [ ] Integrate real TTS narration audio
- [ ] Add intro/outro video support
- [ ] Parallel clip normalization
- [ ] Custom transition effects
- [ ] Subtitle/caption overlay
- [ ] Progress callbacks for UI
- [ ] Video thumbnail generation
- [ ] Multiple output formats (720p, 4K)

## Integration with Pipeline

The video assembly is automatically called in the main pipeline after assets are generated:

```typescript
// In lib/pipeline/index.ts
const assets = await this.generateAssets(...);
const video = await this.assemblyService.assembleVideo({
  videoId: assets.videoId,
  clips: assets.clips,
  music: assets.music,
  branding: assets.branding,
});
```

## UI Integration

The UI provides:
- ✅ "Assemble Video" button (after assets are ready)
- ✅ Real-time progress indicator
- ✅ Video stats display (duration, clip count, resolution)
- ✅ Embedded video player
- ✅ Download button for final video
- ✅ Clear error messages

## Next Steps

After video assembly is complete, the next phases are:

1. ✅ Script Generation
2. ✅ Assets Download
3. ✅ **Video Assembly (YOU ARE HERE)**
4. 🔜 TTS Narration (replace placeholder audio)
5. 🔜 Advanced Effects (transitions, captions)
6. 🔜 YouTube Upload API integration

---

**The video assembly layer is complete and ready to use!** 🎬
