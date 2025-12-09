# Gemini TTS Integration

## Overview
Integrated Google's **Gemini 2.0 Flash TTS** model for high-quality voice narration generation. This replaces the previous chunking-based approach with a single-request solution that can handle 5-10 minutes of audio.

## Key Features

### ✨ Single Request Generation
- **No chunking needed** - Entire narration processed in one request
- **Handles long-form content** - 5-10 minutes of audio
- **Faster processing** - No delays between chunks

### 🎤 Voice Options
Available voices (configured in `GeminiTTSService`):
- **Puck** - Friendly, warm voice (default)
- **Charon** - Deep, authoritative voice
- **Kore** - Clear, professional voice
- **Fenrir** - Strong, confident voice
- **Aoede** - Soft, pleasant voice

### 🎵 Audio Mixing
- Narration at **100% volume** (primary audio)
- Background music at **20% volume** (ambient)
- Automatic audio synchronization with video duration

## Implementation

### New Files Created

1. **`lib/audio/gemini-tts-service.ts`**
   - Main TTS service using Gemini 2.0 Flash TTS model
   - Single-method generation: `generateNarrationAudio()`
   - No chunking, no concatenation needed

### Modified Files

1. **`lib/audio/index.ts`**
   - Exported `GeminiTTSService` and `GeminiTTSConfig`

2. **`lib/video/video-assembly.ts`**
   - Added `narrationAudio` field to `VideoAssemblyInput`
   - Added `mixNarrationWithMusic()` method for audio mixing
   - Updated audio preparation flow to handle narration + music

3. **`app/api/assemble-video/route.ts`**
   - Generates narration audio before video assembly
   - Passes narration audio path to video assembly service
   - Falls back gracefully if TTS fails

## How It Works

### Pipeline Flow

```
1. Script Generation (Gemini)
   ↓
2. Narration Audio Generation (Gemini TTS) ← NEW STEP
   - Single request for entire narration
   - ~10-30 seconds processing time
   - Output: narration.wav
   ↓
3. Video Clip Assembly
   - Clips timed to narration duration
   ↓
4. Audio Mixing
   - Narration (100%) + Background Music (20%)
   ↓
5. Final Video Assembly
   - Video + Mixed Audio + Logo
```

## Usage

### In Video Assembly API

The narration audio is automatically generated when you call the assemble-video API:

```typescript
POST /api/assemble-video
{
  "videoId": "video-123",
  "clips": [...],
  "narration": "Your full narration text here...",  // Used for TTS
  "music": "/path/to/music.mp3",
  "branding": {...}
}
```

### Voice Configuration

To change the voice, update the API route:

```typescript
narrationAudioPath = await ttsService.generateNarrationAudio(
    narration,
    audioOutputPath,
    { voice: "Charon" } // Change voice here
);
```

## Benefits

### ✅ Compared to Previous Approach

**Before (Hugging Face with chunking):**
- Split text into 200-character chunks
- 5-10 minutes total processing time
- 3-second delays between chunks
- Unreliable free API
- Audio concatenation artifacts

**After (Gemini TTS single request):**
- Process entire narration at once
- 10-30 seconds total processing time
- No delays or chunking
- Reliable Google API
- Seamless audio quality

### 🚀 Production Ready

- Uses same Gemini API key as script generation
- No additional API keys needed
- Works in serverless environments (Vercel)
- Graceful fallback if TTS fails

## Configuration

### Environment Variables

Only need the existing Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key
```

### Adjust Audio Mix Levels

In `video-assembly.ts`, modify the `mixNarrationWithMusic()` method:

```typescript
// Current: Narration 100%, Music 20%
`[0:a]volume=1.0[narration];[1:a]volume=0.2[music]`

// More music: Narration 100%, Music 40%
`[0:a]volume=1.0[narration];[1:a]volume=0.4[music]`
```

## Testing

Generate a new video and watch the console output:

```
🎙️ === GEMINI TTS GENERATION STARTED ===
📝 Text length: 1234 characters
🎤 Voice: Puck
⚡ Speed: 1.0x
🚀 Generating audio with Gemini 2.5 Flash TTS...
⏳ This may take 10-30 seconds for long narrations...
✅ Generated 524288 bytes of audio
🎵 Audio format: audio/wav
✅ === GEMINI TTS GENERATION COMPLETE ===
```

Then in video assembly:
```
🎵 Step 4: Preparing audio...
  Mixing narration with background music...
  Narration: /path/to/narration.wav
  Music: /path/to/music.mp3
  Narration duration: 120.50s
  ✓ Audio mixing complete
✅ Narration and background music mixed
```

## Notes

- Gemini TTS returns **WAV format** audio
- Audio is automatically converted during video assembly
- If TTS fails, video continues without narration (logs warning)
- Background music is still applied even if TTS fails
