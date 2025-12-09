# Video Assembly - Quick Start Guide

## 🎉 What's Complete

Your auto YouTube video pipeline now has THREE working layers:

1. ✅ **Script Generation** (with mock data for testing)
2. ✅ **Assets Layer** (downloads stock footage, selects music & branding)
3. ✅ **Video Assembly** (FFmpeg video production)

## 🚀 Prerequisites

### 1. Install FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

### 2. Environment Setup

Your `.env.local` should have:
```bash
USE_MOCK_SCRIPT=true           # Using mock script (Gemini API bypassed)
PEXELS_API_KEY=your_key_here   # ✅ Already set
```

### 3. Assets Setup

Make sure you have:
- ✅ Music files in `assets/music/` (you have track1.mp3, track2.mp3, track3.mp3)
- ✅ Branding assets in `assets/branding/` (you have logo.png, intro.mp4, outro.mp4)

## 🎬 Complete Workflow Test

### Step 1: Generate Script
1. Start dev server: `npm run dev`
2. Open http://localhost:3000
3. Enter any video topic (mock script will be returned)
4. Click **"Generate Script"**
5. ✅ Script appears instantly (~1 second)

### Step 2: Generate Assets
1. Click **"Generate Assets"**
2. ⏳ Wait 30-60 seconds
3. ✅ You'll see:
   - 10 HD stock clips downloaded
   - Random music track selected
   - Branding assets found (logo, intro, outro)

### Step 3: Assemble Video
1. Click **"Assemble Video"**
2. ⏳ Wait 2-5 minutes (FFmpeg processing)
3. ✅ Final video appears with:
   - Video player (watch in browser)
   - Duration, clip count, resolution stats
   - Download button

## 📊 What Happens During Assembly

The VideoAssemblyService performs these steps:

1. **Normalizes** all 10 clips to 1920x1080 (~20-30 seconds)
2. **Concatenates** clips into one video (~2 seconds)
3. **Generates** placeholder silence audio (~1 second)
4. **Mixes** silence + background music at 12% volume (~2 seconds)
5. **Combines** video with audio (~5 seconds)
6. **Overlays** logo at top-right corner (~30-60 seconds)

**Total time**: 2-5 minutes depending on your system

## 📁 Output Location

Final video saved at:
```
videos/
└── video-<timestamp>/
    └── final.mp4
```

You can also access it through the UI video player and download button.

## 🎯 Expected Results

After assembly completes, you should have:
- 📹 A ~30-60 second video (10 clips × 3-6 seconds each)
- 🎵 Background music playing softly (12% volume)
- 🎨 Logo overlay in top-right corner
- 📐 Full HD resolution (1920x1080)
- 🔇 Placeholder audio (silence for now, TTS narration coming soon)

## 🐛 Troubleshooting

### FFmpeg not installed error
```bash
# Install it:
sudo apt install ffmpeg  # Linux
brew install ffmpeg      # macOS

# Restart your dev server
```

### "No assets" error
- Make sure you clicked "Generate Assets" first
- Wait for assets to complete before clicking "Assemble Video"

### Video not playing in browser
- Check browser console for errors
- Try downloading the video and playing locally
- Ensure `videos/` folder exists and has proper permissions

### Process takes too long
- Normal for first run
- Subsequent videos will be similar speed
- Each clip normalization takes time

## 🎨 Customization

### Change Logo Size
Edit `lib/video/video-assembly.ts`, line with `scale=150`:
```typescript
'[1:v]scale=200:-1[logo]...'  // 200px width instead of 150px
```

### Change Music Volume
Edit the `volume=0.12` line:
```typescript
'[1:a]volume=0.20,aloop=...'  // 20% volume instead of 12%
```

### Change Video Quality
Edit CRF value (lower = better quality, larger file):
```typescript
'-crf', '20',  // Higher quality (default is 23)
```

## 📈 Pipeline Status

Your complete pipeline now:

```
1. Script Generation    ✅ (mock mode for testing)
   ↓
2. Assets Download      ✅ (Pexels API + local assets)
   ↓
3. Video Assembly       ✅ (FFmpeg production)
   ↓
4. TTS Narration       🔜 (next phase - replace placeholder audio)
   ↓
5. YouTube Upload      🔜 (future enhancement)
```

## 🎉 Test It Now!

Everything is ready to go. Just:
1. `npm run dev`
2. Generate script → Generate assets → Assemble video
3. Watch your AI-generated video!

The entire process from idea to final video takes about 5-7 minutes.

---

**Questions or issues?** Check the detailed docs in `lib/video/README.md`
