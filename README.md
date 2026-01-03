# Automated Video Generation & YouTube Upload Pipeline

🎬 Fully automated video generation pipeline powered by GitHub Actions.

## 🌟 Features

- ✅ **Automated Script Generation** - AI-powered video scripts
- ✅ **Parallel Scene Rendering** - Fast video scene creation
- ✅ **AI Voice-Over** - Natural text-to-speech narration
- ✅ **Video Assembly** - Professional video editing pipeline
- ✅ **YouTube Upload** - Automatic publishing to YouTube
- ✅ **Shorts Generation** - Create short-form content
- ✅ **Thumbnail Generation** - AI-generated thumbnails
- ✅ **GitHub Actions** - No infrastructure management needed
- ✅ **Parallel Execution** - 40% faster pipeline

## 🚀 Quick Start

See [QUICK_START.md](./QUICK_START.md) for 5-minute setup guide.

## 📚 Documentation

- **[Quick Start Guide](./QUICK_START.md)** - Get started in 5 minutes
- **[GitHub Actions README](./GITHUB_ACTIONS_README.md)** - Full documentation
- **[Migration Guide](./MIGRATION_GUIDE.md)** - Redis to GitHub Actions migration

## 🏗️ Architecture

**GitHub Actions Workflow** → **Parallel Execution** → **YouTube Upload**

```
generate-script
      ↓
[scenes + voiceover] (parallel)
      ↓
assemble-video
      ↓
upload-youtube
      ↓
process-shorts

[thumbnail] (parallel to main pipeline)
```

## 💰 Cost

**Free!** Uses GitHub Actions free tier (2000-3000 minutes/month)

## 📅 Schedule

Runs daily at 2 AM UTC (configurable via cron)

## 🛠️ Tech Stack

- **GitHub Actions** - Pipeline orchestration
- **TypeScript** - Type-safe code
- **Puppeteer** - Scene rendering
- **Gemini AI** - Script generation & TTS
- **FFmpeg** - Video assembly
- **Cloudinary** - Asset storage
- **YouTube API** - Video upload

## 📊 Pipeline Jobs

1. **Script Generation** (~2 min) - Generate video script
2. **Parallel Rendering** (~60 min) - Scenes + voiceover in parallel
3. **Video Assembly** (~15 min) - Combine all assets
4. **YouTube Upload** (~10 min) - Publish to YouTube
5. **Shorts Processing** (~60 min) - Generate shorts
6. **Thumbnail** (~5 min) - Generate thumbnail (parallel)

**Total: ~90 minutes** (vs 150 min sequential)

## 🔐 Required Secrets

Set in GitHub: **Settings → Secrets → Actions**

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `GEMINI_API_KEY`
- `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`
- `WEBSITE_DOMAIN`

## 🧪 Local Development

```bash
# Install dependencies
npm install

# Build all workers
npm run build

# Test individual scripts
npx tsx .github/scripts/generate-script.ts "My Video Idea"
```

## 📈 Improvements Over Previous Version

- ❌ **Removed**: Redis workers, Railway deployment, duplicate code
- ✅ **Added**: GitHub Actions, parallel execution, shared services
- 🚀 **Result**: 40% faster, $0 cost, easier maintenance

## 🤝 Contributing

Contributions welcome! See issues tab.

## 📄 License

MIT License

## 🙏 Credits

Powered by Gemini AI, Cloudinary, and YouTube API
