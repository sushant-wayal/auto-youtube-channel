# Video Generation Pipeline - GitHub Actions

Automated video generation and YouTube upload pipeline powered by GitHub Actions.

## 🎯 Overview

This project automates the entire video generation pipeline:
1. **Script Generation** - AI-generated video scripts
2. **Scene Rendering** - Parallel scene rendering with animations
3. **Voice-Over Generation** - AI text-to-speech narration (parallel with scenes)
4. **Video Assembly** - Combine scenes, narration, music, and branding
5. **YouTube Upload** - Automatic upload to YouTube
6. **Shorts Processing** - Generate and upload short-form videos
7. **Thumbnail Generation** - AI-generated thumbnails (parallel to main pipeline)

## 🏗️ Architecture

### GitHub Actions Workflow

The pipeline runs as a single GitHub Actions workflow with parallel execution where possible:

```
generate-script
      ↓
parallel-rendering (scenes + voiceover in parallel)
      ↓
assemble-video
      ↓
upload-youtube
      ↓
process-shorts

(thumbnail generation runs in parallel with the main pipeline)
```

### Directory Structure

```
.github/
  workflows/
    main.yml                    # Main cron workflow
  scripts/                      # Workflow scripts
    generate-script.ts
    render-scenes.ts
    generate-voiceover.ts
    assemble-video.ts
    upload-youtube.ts
    generate-thumbnail.ts
    process-shorts.ts

shared/                         # Shared utilities
  config/
    index.ts                    # Centralized configuration
  services/
    cloudinary-service.ts       # Cloudinary upload service

workers/                        # Pipeline workers (pure functions)
  video-scene-renderer/
  voice-over-generation/
  video-assembler/
  youtube-upload/
  auto-video-generation-and-upload/
```

## 🚀 Setup

### 1. Required Secrets

Add these to your GitHub repository secrets:

```bash
# Cloudinary (for video/asset storage)
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET

# Gemini AI (for script generation and TTS)
GEMINI_API_KEY

# YouTube API
YT_CLIENT_ID
YT_CLIENT_SECRET
YT_REFRESH_TOKEN

# Website domain (for API calls)
WEBSITE_DOMAIN
```

### 2. Optional Variables

Set these in repository variables (optional):

```bash
ENABLE_THUMBNAIL_GENERATION=true  # Enable/disable thumbnail generation
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build Workers

```bash
npm run build
```

## 📅 Scheduled Execution

The workflow runs automatically:
- **Schedule**: Daily at 2 AM UTC (configured via cron)
- **Manual**: Can be triggered manually via GitHub Actions UI

### Cron Configuration

Edit `.github/workflows/main.yml`:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:      # Allow manual triggers
```

## 🔧 Configuration

### Video Ideas

Edit `.github/scripts/generate-script.ts` to customize video topics:

```typescript
const VIDEO_IDEAS = [
    "The Science Behind Dreams",
    "How Quantum Computing Works",
    // Add your topics here
];
```

### Video Settings

Edit `shared/config/index.ts`:

```typescript
video: {
    long: {
        width: 1280,
        height: 720,
        fps: 30,
    },
    short: {
        width: 720,
        height: 1280,
        fps: 30,
    },
}
```

## 🧪 Testing Locally

### Test Individual Workers

```bash
# Render scenes
npx tsx .github/scripts/render-scenes.ts "video-123" '{"script":{"scenes":[...]}}'

# Generate voiceovers
npx tsx .github/scripts/generate-voiceover.ts "video-123" '{"script":{"scenes":[...]}}'

# Assemble video
npx tsx .github/scripts/assemble-video.ts "video-123" ...args

# Upload to YouTube
npx tsx .github/scripts/upload-youtube.ts "url" '{"script":{...}}'
```

### Test Full Pipeline

```bash
npx tsx workers/auto-video-generation-and-upload/src/index.ts
```

## 📊 Pipeline Features

### ✅ Parallel Execution

- Scene rendering and voice-over generation run in parallel
- Thumbnail generation runs parallel to the main pipeline
- Significantly reduces total execution time

### ✅ Independent Steps

Each step is isolated and can be:
- Tested independently
- Debugged easily
- Rerun if failed
- Monitored separately

### ✅ No External Dependencies

- No Redis required
- No external queue services
- Fully self-contained in GitHub Actions
- All state managed via workflow artifacts and outputs

### ✅ Cost Effective

- Free GitHub Actions minutes (2000-3000/month depending on plan)
- No additional infrastructure costs
- Cloudinary free tier for storage

## 🔍 Monitoring

View pipeline execution:
1. Go to **Actions** tab in your repository
2. Click on the latest **Video Generation Pipeline** run
3. View individual job status and logs
4. Check the **Summary** for final results

## 🐛 Debugging

### View Logs

Each job produces detailed logs:
- Script generation logs
- Scene rendering progress
- Voice-over generation status
- Assembly details
- Upload confirmation

### Failed Jobs

If a job fails:
1. Check the specific job logs
2. Review error messages
3. Rerun individual jobs if needed
4. Update configuration and retry

### Common Issues

**Script generation fails:**
- Check GEMINI_API_KEY is set correctly
- Verify WEBSITE_DOMAIN is accessible

**Scene rendering fails:**
- Check CLOUDINARY credentials
- Verify sufficient disk space in runner

**YouTube upload fails:**
- Verify YT credentials are valid
- Check video meets YouTube requirements

## 🔄 Migration from Redis Workers

This version **replaces** the Redis worker implementation:

### Removed:
- ❌ Redis queue management
- ❌ Worker polling loops
- ❌ Job processor classes
- ❌ Railway deployment
- ❌ Manual server management

### Added:
- ✅ GitHub Actions workflows
- ✅ Scheduled cron execution
- ✅ Parallel job execution
- ✅ Pure function architecture
- ✅ Shared services and config
- ✅ Better error handling and logs

## 📦 Shared Services

All workers now use centralized services from `shared/`:

### CloudinaryService
- Upload videos, audio, images
- Download files
- Clean up temporary files

### Config
- Centralized environment variables
- Validation helpers
- Consistent configuration across workers

## 🎬 Workflow Jobs

### 1. generate-script
- Duration: ~1-2 minutes
- Generates video script via AI
- Outputs: video_id, script_data

### 2. parallel-rendering
- Duration: ~30-60 minutes
- Renders scenes AND generates voiceovers in parallel
- Outputs: clips_urls, voiceover_urls, timings

### 3. assemble-video
- Duration: ~10-20 minutes
- Combines all assets into final video
- Outputs: video_url

### 4. upload-youtube
- Duration: ~5-10 minutes
- Uploads to YouTube
- Outputs: youtube_id

### 5. process-shorts
- Duration: ~30-60 minutes
- Processes all shorts sequentially
- Parallel processing within each short

### 6. generate-thumbnail (parallel)
- Duration: ~2-5 minutes
- Runs independently
- Non-blocking to main pipeline

## 📝 Development

### Adding New Features

1. Create script in `.github/scripts/`
2. Add job to `.github/workflows/main.yml`
3. Import worker functions from `workers/`
4. Use shared services from `shared/`

### Code Organization

- **Pure functions**: All workers export pure functions
- **No side effects**: Workers don't manage state
- **Shared utilities**: Common code in `shared/`
- **Type safety**: Full TypeScript support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

- **Gemini AI** - Script generation and TTS
- **Cloudinary** - Video and asset storage
- **YouTube API** - Video uploads
- **GitHub Actions** - Pipeline automation
