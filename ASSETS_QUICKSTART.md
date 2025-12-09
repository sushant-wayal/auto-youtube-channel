# Assets Layer - Quick Start Guide

## ✅ What's Implemented

The complete Footage/Assets layer for your auto YouTube video pipeline is now live!

### Features
1. **Keyword Extraction** - Automatically extracts visual keywords from narration
2. **Stock Footage Download** - Fetches and downloads HD clips from Pexels
3. **Background Music Selection** - Randomly picks copyright-free music
4. **Branding Assets** - Includes logo, intro, and outro videos
5. **UI Integration** - Shows progress and completion status
6. **API Route** - `/api/generate-assets` for programmatic access

## 🚀 Getting Started

### Step 1: Get Pexels API Key (Free)

1. Visit https://www.pexels.com/api/
2. Sign up (free, no credit card)
3. Copy your API key
4. Add to `.env.local`:
   ```bash
   PEXELS_API_KEY=your_actual_key_here
   ```

### Step 2: Add Background Music

Download 2-3 copyright-free MP3 tracks and place in `assets/music/`:

**Quick sources:**
- YouTube Audio Library: https://www.youtube.com/audiolibrary/music
- Free Music Archive: https://freemusicarchive.org/

### Step 3: (Optional) Add Branding

Place these files in `assets/branding/`:
- `logo.png` - Your logo (512x512+ with transparency)
- `intro.mp4` - Opening video (3-5 sec, 1920x1080)
- `outro.mp4` - Closing video (5-10 sec, 1920x1080)

### Step 4: Test It Out!

1. Restart your dev server (to load new env vars)
2. Generate a script in the UI
3. Click "Generate Assets"
4. Watch as 10 HD clips are downloaded automatically!

## 📁 File Structure

```
lib/assets/
├── keyword-extractor.ts     ✅ Pure function for keyword extraction
├── pexels-client.ts          ✅ Pexels API integration
├── clip-downloader.ts        ✅ Download & save clips
├── music-branding.ts         ✅ Music & branding helpers
└── README.md                 ✅ Full documentation

lib/pipeline/
├── index.ts                  ✅ Updated with generateAssets()
└── types.ts                  ✅ Added VideoAssets type

app/api/generate-assets/
└── route.ts                  ✅ POST endpoint for assets

app/page.tsx                  ✅ UI with assets generation

assets/
├── music/                    📂 Place MP3 files here
│   └── README.md
└── branding/                 📂 Place logo/intro/outro here
    └── README.md

tmp/footage/                  📂 Downloaded clips saved here
└── video-XXXX/
    ├── clip-001.mp4
    ├── clip-002.mp4
    └── ...
```

## 🎯 What Happens When You Click "Generate Assets"

1. **Keyword Extraction** (instant)
   - Analyzes narration text
   - Extracts 10 most relevant visual keywords
   - Example: "react", "hooks", "development", "code"...

2. **Stock Footage Search** (~30-60 sec)
   - Searches Pexels for each keyword
   - Downloads 3 HD clips per keyword
   - Stops at 10 total clips
   - Saves to `tmp/footage/video-XXXX/`

3. **Music Selection** (instant)
   - Randomly picks one MP3 from `assets/music/`

4. **Branding Scan** (instant)
   - Checks for logo.png, intro.mp4, outro.mp4
   - Includes what's available

5. **Returns Paths**
   - All file paths ready for FFmpeg layer
   - UI shows completion status

## 🎨 UI Features

- ✅ Progress indicator during download
- ✅ Shows clips count when complete
- ✅ Displays selected music track
- ✅ Lists found branding assets
- ✅ Disables button after completion
- ✅ Clear error messages
- ✅ Guidance for next steps

## 🔧 Configuration Options

### Adjust Clip Count
Edit `lib/pipeline/index.ts`:
```typescript
// Download 15 clips instead of 10
const clips = await downloadClipsForVideo(videoId, narration, 15);
```

### Change Keyword Count
Edit `lib/assets/clip-downloader.ts`:
```typescript
// Extract 15 keywords instead of 10
const keywords = extractKeywords(narration, 15);
```

### Clips Per Keyword
Edit `lib/assets/clip-downloader.ts`:
```typescript
// Fetch 5 clips per keyword instead of 3
const clips = await fetchClipsForKeyword(keyword, 5);
```

## ⚠️ Important Notes

1. **Audio Generation Skipped**: As requested, the Hugging Face TTS step is now skipped in the pipeline
2. **Pexels Attribution**: Required for published videos (add in description/credits)
3. **Storage**: ~100-200MB per video (10 HD clips)
4. **API Limits**: Pexels free tier = 200 requests/hour
5. **Music Licensing**: Ensure your music tracks are properly licensed

## 🐛 Troubleshooting

### No API key error?
- Add `PEXELS_API_KEY` to `.env.local`
- Restart Next.js dev server

### No music found?
- Add at least one `.mp3` file to `assets/music/`

### Downloads failing?
- Check your internet connection
- Verify API key is valid
- Check Pexels API status

### Slow downloads?
- Normal! HD clips are 5-20MB each
- ~30-60 seconds for 10 clips is expected

## 🎬 Next Steps

The assets layer is complete! Next phases:
1. ✅ Script Generation
2. ✅ **Assets Layer (YOU ARE HERE)**
3. ⏭️ Audio Generation (skipped for now)
4. 🔜 FFmpeg Video Composition (next to implement)
5. 🔜 Final Rendering & Export

## 📚 Full Documentation

See `lib/assets/README.md` for complete technical documentation.

---

**Ready to try it out?** Start your dev server and generate your first video with automatic stock footage! 🚀
