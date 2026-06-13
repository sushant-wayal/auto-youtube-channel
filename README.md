# Automated Video Generation & YouTube Upload Pipeline

🎬 Fully automated video generation pipeline powered by GitHub Actions.

## 📺 Video Explainer

<video src="docs/video-documentation/video_explainer_compressed.mp4" width="100%" controls></video>
<br/>


## 🌟 Features

- ✅ **Automated Script Generation** - AI-powered video scripts with chapter timestamps
- ✅ **Parallel Scene Rendering** - Supports multiple render modes: `code` (deterministic HTML canvas) and `ai` (generative visuals with queue synchronization)
- ✅ **Advanced Voice-Overs** - Supports `gemini` (API-based) and `f5` (F5-TTS local batch inference with zero-overhead WAV injection)
- ✅ **Video Assembly** - Professional video editing pipeline with intro/outro (FFmpeg filter graphs)
- ✅ **YouTube Upload** - Automatic publishing with thumbnails and chapters
- ✅ **Shorts Generation** - Create short-form content with ranked schedule times
- ✅ **Thumbnail Generation** - AI-generated thumbnails
- ✅ **GitHub Actions Orchestration** - Passes state via a Hex-Encoded Bus to bypass runner payload limits
- ✅ **Parallel Execution** - 40% faster pipeline through async promise overlapping
- ✅ **Redis Integration** - Video ideas queue management with Lua deadlock recovery
- ✅ **Mobile Dashboard** - React Native app for on-the-go management
- ✅ **Schedule Management** - Ranked publish times for optimal engagement

---

## 🚀 Quick Start (5 Minutes)

### 1. Clone and Install
```bash
git clone <your-repo>
cd video-genration-on-worker
npm install
```

### 2. Set GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

**Required Secrets:**
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY_1=your_first_gemini_key
GEMINI_API_KEY_2=your_second_gemini_key
YT_CLIENT_ID=your_youtube_client_id
YT_CLIENT_SECRET=your_youtube_client_secret
YT_REFRESH_TOKEN=your_youtube_refresh_token
WEBSITE_DOMAIN=https://your-website.com
REDIS_URL=redis://your-redis-host:6379
```

**Optional Variables:**
```
ENABLE_THUMBNAIL_GENERATION=true
```

### 3. Test Manually

Go to: **Actions → Video Generation Pipeline → Run workflow**

### 4. Check Results

Monitor the workflow execution in the Actions tab!

---

## 🏗️ Architecture

### High-Level Components

**Control Plane (Next.js Brain)** → **Compute Plane (GH Actions Muscle)** → **Data Plane (Cloudinary / Hex Bus)**

1. **Worker 1: Idea Selector** - Deterministic math filtering to dedupe and rank ideas via Gemini.
2. **Worker 2 & 3: Parallel Render & Redis AI Queue** - Orchestrates \`scene_render_method\` (\`code\` / \`ai\`). Uses Lua deadlock recovery for parallel tasks and overlaps Puppeteer renders with background API sleeps to manage rate-limits.
3. **Worker 4: F5-TTS Batching** - When \`voiceover_provider\` is \`f5\`, bypasses model load overhead by generating 44-byte WAV headers instantly for empty hooks and batch inferencing the rest via Python subprocess. Uses \`gemini\` as API fallback.
4. **Worker 5: The Assembler** - Advanced FFmpeg filter graphs for merging audio, video, intros, and background music.
5. **The Hex-Encoded Bus** - Passes massive JSON states between GitHub Actions steps by piping \`echo $JSON | xxd -p\` and decoding downstream, bypassing standard runner limits.

### GitHub Actions Workflow

**GitHub Actions Cron** → **Parallel Execution** → **YouTube Upload**

```
Generate Script (2 min)
├─ Fetch idea from Redis queue
├─ Generate script with scene titles
└─ Output state to Hex-Encoded Bus
      ↓
Parallel Rendering (60 min)
├─ Render Scenes (Method: Code vs AI)
└─ Generate Voiceover (Provider: F5-TTS vs Gemini)
      ↓
Assemble Video (15 min)
├─ Combine scenes + voiceover + music
├─ Add intro (8s) and outro (8s)
└─ Track scene durations
      ↓
Generate Thumbnail & Process Shorts (60 min)
├─ AI-generated thumbnail with URL output
├─ Generate 5 shorts from main video
└─ Assign to ranked schedule times
      ↓
Upload to YouTube (10 min)
├─ Generate chapter timestamps
├─ Attach thumbnail
└─ Schedule publish time
      ↓
Pipeline Summary
└─ Display results

Total: ~90 minutes (vs 150 min sequential)
```

### Directory Structure

```
.github/
  workflows/
    main.yml                    # Main cron workflow
  scripts/                      # 7 workflow scripts
    generate-script.ts          # Script generation with Redis
    render-scenes.ts
    generate-voiceover.ts
    assemble-video.ts
    upload-youtube.ts           # With timestamps
    generate-thumbnail.ts
    process-shorts.ts           # With ranked schedule times

shared/                         # Shared utilities
  config/
    index.ts                    # Centralized configuration
  services/
    cloudinary-service.ts       # Cloudinary upload service
    shorts-publish-time-service.ts  # Schedule management

workers/                        # Pipeline workers (pure functions)
  video-scene-renderer/
  voice-over-generation/
  video-assembler/
  youtube-upload/
  auto-video-generation-and-upload/

website/                        # Next.js dashboard
  app/
    dashboard/                  # Web dashboard UI
    api/
      ideas-queue/              # Ideas management API
      schedule-times/           # Schedule management API

mobile-app/                     # React Native mobile dashboard
  dashboard-app/
    screens/
      IdeasScreen.tsx           # Ideas management
      ScheduleTimesScreen.tsx   # Schedule management
```

---

## 💰 Cost

**Free!** Uses GitHub Actions free tier (2000-3000 minutes/month)

- No Redis infrastructure costs (use existing)
- No Railway deployment costs
- No server management overhead
- Free tier quotas for Cloudinary, Gemini, YouTube API

---

## 📅 Schedule & Publishing

### Cron Schedule

Runs daily at 2 AM UTC (configurable in `.github/workflows/main.yml`)

```yaml
schedule:
  - cron: '0 0 * * *'  # Daily at Midnight UTC
```

**Common Cron Patterns:**
- `'0 2 * * *'` - 2 AM UTC
- `'0 6 * * *'` - 6 AM UTC
- `'0 */6 * * *'` - Every 6 hours
- `'0 0 * * 0'` - Weekly (Sunday)

### Shorts Schedule Times (Ranked)

Shorts are automatically assigned to 5 ranked schedule times based on performance:

1. **Rank 1 (Best)**: 16:30 IST (4:30 PM) - Best performing time slot
2. **Rank 2**: 18:00 IST (6:00 PM)
3. **Rank 3**: 20:00 IST (8:00 PM)
4. **Rank 4**: 12:00 IST (12:00 PM)
5. **Rank 5 (Worst)**: 14:00 IST (2:00 PM)

**Usage:** First short gets Rank 1 time, second gets Rank 2, etc.

### Long-Form Video Time

Long-form videos are scheduled to: **18:30 IST (6:30 PM)**

### Managing Schedule Times

**Via Website Dashboard:**
1. Navigate to `/dashboard`
2. Scroll to "Shorts Schedule Times" and "Long-Form Video Time" cards
3. Adjust times as needed
4. Click "Save Schedule Times"

**Via Mobile App:**
1. Open "Publish Schedule" tab
2. Tap times to edit with native time picker
3. Use quick preset buttons if needed
4. Tap "Save Changes"

**Via API:**
```bash
# Get current times
GET /api/schedule-times

# Update times
POST /api/schedule-times
{
  "shortsTimes": ["16:30", "18:00", "20:00", "12:00", "14:00"],
  "longFormTime": "18:30"
}
```

---

## 🎬 YouTube Chapter Timestamps

Videos automatically include chapter timestamps for better navigation:

### How It Works

1. **Script Generation**: AI creates `sceneTitle` for each scene (3-7 words)
2. **Video Assembly**: Tracks actual duration of each scene
3. **Timestamp Generation**: Creates formatted chapters (0:00, 0:38, 1:10, etc.)
4. **YouTube Description**: Chapters appended automatically

**Example Output:**
```
📚 Chapters:
0:00 - Intro
0:08 - Introduction to HTTP Statelessness
0:46 - Understanding the Vending Machine Analogy
1:18 - Why Adopt a Stateless Design
2:03 - Simplicity and Resilience Benefits
...
7:45 - Outro
```

### Benefits

- 🎯 Viewers can jump to specific topics
- 📈 Chapter titles are indexed for SEO
- 👀 See video structure at a glance
- ⏩ Skip to relevant sections
- 📊 YouTube provides per-chapter analytics

**Note:** Chapters are only added to long-form videos (not shorts).

---

## 🔑 Gemini API Key Rotation

The system uses 2 Gemini API keys with automatic round-robin rotation:

- Doubles the API rate limit capacity
- Prevents rate limiting during voiceover generation
- Automatic rotation between keys
- Falls back to single key if only one provided

**GitHub Secrets:**
```
GEMINI_API_KEY_1=your_first_key
GEMINI_API_KEY_2=your_second_key
```

---

## 💡 Video Ideas Queue

### Redis Integration

Video ideas are managed via Redis queue at key `video:ideas`:

- **Fetch**: `redis.lpop('video:ideas')` to get next idea
- **Add**: `redis.rpush('video:ideas', 'New Idea')`
- **List**: `redis.lrange('video:ideas', 0, -1)`
- **Count**: `redis.llen('video:ideas')`

### Managing Ideas

**Via Website Dashboard:**
1. Navigate to `/dashboard`
2. View all ideas in the queue
3. Add new ideas with text input
4. Edit, delete, or reorder existing ideas
5. Clear all ideas with confirmation

**Via Mobile App:**
1. Open "Ideas" tab
2. Pull to refresh to see latest
3. Add new ideas quickly
4. Edit inline or delete with confirmation
5. Reorder with up/down arrows

**Via Redis CLI:**
```bash
# Add new idea
redis-cli RPUSH video:ideas "Your New Video Idea"

# View queue
redis-cli LRANGE video:ideas 0 -1

# Check count
redis-cli LLEN video:ideas
```

**Fallback:** If Redis is unavailable, the system uses random ideas from a hardcoded list.

---

## 📱 Mobile Dashboard App

React Native mobile app for on-the-go management.

### Features

- ✅ **Ideas Management**: Add, edit, delete, reorder video ideas
- ✅ **Schedule Management**: Update shorts and long-form publish times
- ✅ **Pull-to-Refresh**: Manual data updates
- ✅ **Native Time Picker**: Platform-appropriate UI (iOS/Android)
- ✅ **Change Detection**: Enable/disable save based on changes
- ✅ **Quick Presets**: Fast time selection
- ✅ **Error Handling**: User-friendly error messages

### Quick Setup

```bash
# 1. Navigate to mobile app
cd mobile-app/dashboard-app

# 2. Install dependencies
npm install

# 3. Find your local IP
npm run get-ip

# 4. Update config.ts with your IP
# Change: export const API_BASE_URL = 'http://YOUR_IP:3000';

# 5. Start backend (in another terminal)
cd ../../website
npm run dev

# 6. Start mobile app
cd ../../mobile-app/dashboard-app
npm start

# 7. Scan QR code with Expo Go app
```

### Supported Platforms

- ✅ iOS (iPhone/iPad)
- ✅ Android (Phone/Tablet)
- ✅ iOS Simulator (Mac only)
- ✅ Android Emulator

---

## 🛠️ Tech Stack

- **GitHub Actions** - Pipeline orchestration
- **TypeScript** - Type-safe code
- **Puppeteer** - Scene rendering
- **Gemini AI** - Script generation & TTS
- **FFmpeg** - Video assembly
- **Cloudinary** - Asset storage
- **YouTube API** - Video upload
- **Redis** - Ideas queue management
- **Next.js** - Web dashboard
- **React Native + Expo** - Mobile dashboard

---

## 📊 Pipeline Jobs Breakdown

### 1. Generate Script (~2 min)
- Fetch video idea from Redis queue (or use custom input)
- Generate script via AI with scene titles
- Mark idea as completed in Redis
- Output: `video_id`, `script_data`

### 2. Parallel Rendering (~60 min)
**Render Scenes:**
- Uses Puppeteer to render visual scenes
- Uploads to Cloudinary
- Uses GEMINI_API_KEY rotation

**Generate Voice-Overs (Parallel):**
- Text-to-speech with Gemini AI
- Uploads audio to Cloudinary
- Uses GEMINI_API_KEY rotation
- Output: `clips_urls`, `voiceover_urls`, `timings`

### 3. Assemble Video (~15 min)
- Combine scenes + voiceover + music
- Add intro (8s) and outro (8s)
- Track actual scene durations
- Upload final video to Cloudinary
- Output: `video_url`, `scene_durations`

### 4. Generate Thumbnail (~5 min)
- AI-generated thumbnail via API
- Output thumbnail URL
- Output: `thumbnail_url`

### 5. Upload to YouTube (~10 min)
- Generate chapter timestamps (intro + scenes + outro)
- Attach thumbnail
- Schedule to long-form publish time (18:30 IST)
- Set privacy to 'private' (until scheduled time)
- Output: `youtube_id`

### 6. Process Shorts (~60 min)
- Generate 5 shorts from main video
- Assign each to ranked schedule time:
  - Short 1 → Rank 1 (16:30 IST - best time)
  - Short 2 → Rank 2 (18:00 IST)
  - Short 3 → Rank 3 (20:00 IST)
  - Short 4 → Rank 4 (12:00 IST)
  - Short 5 → Rank 5 (14:00 IST - worst time)
- Upload to YouTube with scheduled times
- Output: Shorts video IDs

### 7. Pipeline Summary
- Display all results
- Show video IDs, URLs, and scheduled times

**Total Pipeline Time: ~90 minutes** (40% faster than sequential)

---

## 🧪 Local Development

### Install Dependencies
```bash
npm install
```

### Build All Workers
```bash
npm run build
```

### Test Individual Scripts
```bash
# Generate script
npx tsx .github/scripts/generate-script.ts "My Video Idea"

# Render scenes
npx tsx .github/scripts/render-scenes.ts "video-123" '{...script...}'

# Assemble video
npx tsx .github/scripts/assemble-video.ts "video-123" ...args

# Upload to YouTube
npx tsx .github/scripts/upload-youtube.ts "video-url" '{...script...}'
```

### Test Full Workflow
```bash
./test-workflow-locally.sh all
```

### Test Mobile App
```bash
cd mobile-app/dashboard-app
npm start
# Scan QR code with Expo Go app
```

---

## 🔍 Monitoring & Debugging

### View Logs

1. Go to **Actions** tab in your repository
2. Click on the latest **Video Generation Pipeline** run
3. View individual job status and logs
4. Check the **Summary** for final results

### Monitor Key Events

**Expected Logs:**
- `"Using Gemini API Key 1"` / `"Using Gemini API Key 2"` - Key rotation
- `"Video idea from Redis queue"` - Successful Redis fetch
- `"📊 Scene metadata: 7 titles, 7 durations"` - Timestamp generation
- `"📚 Generated 7 chapter timestamps"` - Chapters added
- `"📅 Scheduling long-form video for 18:30 IST"` - Long-form scheduled
- `"📤 Scheduling short 1 (Rank 1) for 16:30 IST"` - Short assigned

### Common Issues

**Script generation fails:**
- Check `GEMINI_API_KEY_1` and `GEMINI_API_KEY_2` are valid
- Verify `WEBSITE_DOMAIN` is accessible
- Check Redis connection if using queue

**Scene rendering fails:**
- Check `CLOUDINARY_*` credentials are correct
- Verify sufficient GitHub Actions minutes available
- Check runner has enough disk space

**YouTube upload fails:**
- Verify YouTube credentials are valid
- Check refresh token is not expired
- Ensure video meets YouTube requirements
- Verify YouTube API quota not exceeded

**Thumbnail fails:**
- Workflow continues even if thumbnail fails
- Videos will upload without thumbnails
- Check thumbnail API endpoint

**Redis unavailable:**
- System falls back to random idea selection
- Logs warning: `"⚠️ Redis not available, using random idea"`

---

## 📈 Improvements Over Previous Version

### Removed ❌
- Redis workers with polling loops
- Railway deployment and costs
- Duplicate Cloudinary services (3 copies)
- Duplicate config files (5 copies)
- Duplicate Redis services (5 copies)
- Worker class boilerplate
- Manual server management
- `ioredis` worker dependencies

### Added ✅
- GitHub Actions cron workflow
- Parallel job execution (40% faster)
- Shared services and centralized config
- Pure function architecture
- Gemini API key rotation (2x rate limit)
- Video ideas queue with Redis integration
- YouTube chapter timestamps
- Ranked schedule times for shorts
- Intro/outro support in timestamps
- Mobile dashboard app
- Better error handling and monitoring
- Built-in logging and notifications

### Result 🚀
- **40% faster** pipeline execution
- **$0/month** infrastructure cost
- **Easier maintenance** with cleaner codebase
- **Better reliability** with built-in retries
- **More features** with less code
- **Mobile access** for on-the-go management

---

## 🔐 Security & Configuration

### Environment Variables

All sensitive data stored as GitHub Secrets (not in code):

**Cloudinary:**
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

**Gemini AI:**
- `GEMINI_API_KEY_1`
- `GEMINI_API_KEY_2`

**YouTube:**
- `YT_CLIENT_ID`
- `YT_CLIENT_SECRET`
- `YT_REFRESH_TOKEN`

**Redis:**
- `REDIS_URL` (format: `redis://host:port` or with password)

**Website:**
- `WEBSITE_DOMAIN` (for API calls)

### Validation

All environment variables are validated at runtime:
```typescript
validateConfig(['cloudinary', 'gemini', 'youtube']);
```

---

## 🤝 Contributing

Contributions welcome! Here's how:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `npm run build` and `./test-workflow-locally.sh all`
5. Submit a pull request

### Code Standards

- TypeScript throughout
- Pure functions in workers
- Shared services for common functionality
- Comprehensive error handling
- Detailed logging for debugging

---

## 📄 License

MIT License

---

## 🙏 Credits

**Powered by:**
- Gemini AI (script generation & TTS)
- Cloudinary (video storage & CDN)
- YouTube API (video publishing)
- GitHub Actions (pipeline orchestration)
- Redis (queue management)
- FFmpeg (video processing)
- Puppeteer (scene rendering)

---

## 📞 Support

**For issues or questions:**
- Check workflow logs in Actions tab
- Review error messages in job outputs
- Verify all secrets are set correctly
- Test individual scripts locally first
- Ensure backend is running for mobile app
- Check Redis connection for ideas queue

---

## 🔮 Future Enhancements

Potential improvements:
- [ ] Day-of-week specific schedules
- [ ] Automatic time optimization based on analytics
- [ ] Multi-language chapter titles
- [ ] A/B testing for different prompts
- [ ] Web UI for queue management
- [ ] Webhook to add ideas from external sources
- [ ] Analytics dashboard
- [ ] Holiday/special event scheduling
- [ ] Multi-platform publishing (TikTok, Instagram)

---

**🎉 The pipeline is production-ready! No configuration needed beyond GitHub Secrets.**
