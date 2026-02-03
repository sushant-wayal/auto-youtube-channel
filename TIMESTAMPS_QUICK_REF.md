# YouTube Timestamps - Quick Reference

## 🎯 What Was Changed

### 1. Script Generation
- **Added**: `sceneTitle` field to each scene (3-7 word descriptive titles)
- **File**: `website/lib/pipeline/script-generation.ts`

### 2. Type Definitions
- **Added**: `sceneTitle?: string` to `SceneIR`
- **Added**: `sceneDurations?: number[]` to `VideoAssemblyResult`
- **File**: `website/lib/pipeline/types.ts`

### 3. Video Assembly
- **Added**: Track actual scene durations during assembly
- **Added**: Return `sceneDurations` array in result
- **Files**: 
  - `workers/video-assembler/src/lib/video/video-assembly.ts`
  - `workers/video-assembler/src/index.ts`
  - `.github/scripts/assemble-video.ts`

### 4. Timestamp Generator
- **Created**: Utility for formatting and generating timestamps
- **File**: `workers/youtube-upload/src/utils/timestamp-generator.ts`

### 5. YouTube Upload
- **Added**: Scene metadata parameters (`sceneTitles`, `sceneDurations`)
- **Added**: Timestamp generation for long-form videos only
- **Added**: Append chapters to description
- **Files**:
  - `workers/youtube-upload/src/index.ts`
  - `.github/scripts/upload-youtube.ts`

### 6. Workflow
- **Added**: `scene_durations` output from assemble-video job
- **Added**: `SCENE_DURATIONS` env var to upload-youtube job
- **File**: `.github/workflows/main.yml`

## 📊 How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. SCRIPT GENERATION                                            │
│    AI generates scenes with sceneTitle field                    │
│    Example: "Introduction to HTTP Statelessness"                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. VIDEO ASSEMBLY                                               │
│    Tracks actual duration of each scene after audio sync        │
│    Example: [38.5, 32.0, 45.2, 40.1, 35.8, 42.3, 30.5]        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. WORKFLOW OUTPUT                                              │
│    Passes scene_durations to upload job                         │
│    Hex-encoded JSON array                                       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. UPLOAD SCRIPT                                                │
│    Extracts scene titles from script                            │
│    Decodes scene durations from workflow                        │
│    Calls uploadToYouTube() with metadata                        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. YOUTUBE UPLOAD WORKER                                        │
│    IF long-form video (not shorts):                             │
│      - Generate timestamps from titles + durations              │
│      - Format: "0:00 - Title 1\n0:38 - Title 2..."            │
│      - Append to description                                    │
│    Upload to YouTube                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🎨 Example

### Input (Script):
```json
{
  "scenes": [
    {
      "sceneTitle": "Introduction",
      "narration": "Welcome to the video...",
      "baseDuration": 40
    },
    {
      "sceneTitle": "Main Concept",
      "narration": "Let's dive into...",
      "baseDuration": 35
    }
  ]
}
```

### Assembly Output:
```javascript
sceneDurations: [38.5, 32.0, 45.2, ...]
```

### YouTube Description:
```
Your video description here...

📚 Chapters:
0:00 - Introduction
0:38 - Main Concept
1:10 - Advanced Topics
...
```

## ⚙️ Key Implementation Details

### Timing Source
✅ **Uses voiceover audio duration** (most accurate)  
❌ Not animation timings (can be shorter than audio)  
❌ Not base durations (estimated, not actual)

### Title Source Priority
1. **`sceneTitle`** from script (preferred)
2. First sentence of narration (fallback)
3. Truncated to 60 chars if needed

### Conditional Logic
- **Long-form videos**: Timestamps added ✅
- **Shorts**: Skipped (not supported) ❌

### Validation
- Minimum 3 scenes required
- First timestamp must be 0:00
- Each scene should be ≥10 seconds (YouTube guideline)

## 🚀 Testing

```bash
# Run the full workflow
./test-workflow-locally.sh all

# Or test individual components:
npx tsx .github/scripts/generate-script.ts "Test Topic"
npx tsx .github/scripts/assemble-video.ts video-123
npx tsx .github/scripts/upload-youtube.ts
```

### Expected Logs:
```
Video Assembly:
  📊 Scene durations: 38.50, 32.00, 45.20, ...

YouTube Upload:
  📊 Scene metadata: 7 titles, 7 durations
  📚 Generated 7 chapter timestamps
  ✅ Uploaded to YouTube: xyz123
```

## 🐛 Troubleshooting

### Timestamps Not Showing
- Check logs for "Scene metadata" and "Generated X chapter timestamps"
- Verify ≥3 scenes in script
- Ensure scene durations were captured during assembly

### Wrong Titles
- Check if AI is generating `sceneTitle` fields
- Verify script generation prompt includes new instructions
- Check fallback logic (first sentence extraction)

### Missing Durations
- Verify assemble-video outputs `scene_durations`
- Check workflow passes `SCENE_DURATIONS` env var
- Look for decode errors in upload script

## 📁 Files Modified

| File | Change |
|------|--------|
| `website/lib/pipeline/script-generation.ts` | Add `sceneTitle` to prompt |
| `website/lib/pipeline/types.ts` | Add `sceneTitle` and `sceneDurations` fields |
| `workers/video-assembler/src/lib/video/video-assembly.ts` | Track and return scene durations |
| `workers/video-assembler/src/index.ts` | Pass through scene durations |
| `workers/youtube-upload/src/utils/timestamp-generator.ts` | **NEW** - Timestamp generation utility |
| `workers/youtube-upload/src/index.ts` | Add timestamp generation logic |
| `.github/scripts/assemble-video.ts` | Output scene durations |
| `.github/scripts/upload-youtube.ts` | Extract and pass scene metadata |
| `.github/workflows/main.yml` | Pass scene_durations between jobs |

## ✅ Status

**Implementation Complete** - Ready for production use!

- ✅ All TypeScript errors resolved
- ✅ All files updated
- ✅ Workflow configured
- ✅ Feature tested
- ✅ Documentation complete

🎉 **The feature is now live and will work automatically on the next workflow run!**
