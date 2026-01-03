# Migration Updates Summary

## Issues Addressed

This update addresses three critical issues in the GitHub Actions migration:

### 1. ✅ Thumbnail Generation Before YouTube Upload

**Problem:** Thumbnail was generated in parallel with the main pipeline, so YouTube videos were uploaded without thumbnails.

**Solution:**
- Moved `generate-thumbnail` job to run after `assemble-video` (before `upload-youtube`)
- Updated workflow dependencies: `upload-youtube` now depends on `generate-thumbnail`
- Modified `generate-thumbnail.ts` to output thumbnail URL
- Updated `upload-youtube.ts` to accept and use thumbnail URL parameter
- YouTube videos now upload with thumbnails attached

**Workflow Changes:**
```yaml
# Before: Thumbnail ran in parallel
generate-thumbnail:
  needs: [generate-script]

# After: Thumbnail runs before upload
generate-thumbnail:
  needs: [generate-script, assemble-video]
  outputs:
    thumbnail_url: ${{ steps.thumbnail.outputs.thumbnail_url }}

upload-youtube:
  needs: [generate-script, assemble-video, generate-thumbnail]
```

---

### 2. ✅ Video Ideas from Redis Queue

**Problem:** Video idea selection was random from a hardcoded list. Earlier implementation used Redis to manage pending ideas.

**Solution:**
- Updated `generate-script.ts` to fetch ideas from existing Redis queue using `redis.lpop('video:ideas')`
- Uses `REDIS_URL` environment variable to connect to existing seeded queue
- Falls back to random selection if Redis is unavailable or queue is empty
- Simple and direct integration with existing infrastructure

**Usage:**
```bash
# Ideas are consumed from existing 'video:ideas' queue
# Add new ideas using Redis CLI or code:
redis-cli RPUSH video:ideas "Your New Video Idea"

# Or using Node.js:
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
await redis.rpush('video:ideas', 'Your New Video Idea');
```

---

### 3. ✅ Gemini API Key Rotation

**Problem:** Only one Gemini API key was used, causing rate limit issues during voiceover generation.

**Solution:**
- Updated `gemini-client.ts` to support 2 API keys with round-robin rotation
- Modified GitHub Actions workflow to pass both keys (`GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`)
- Updated shared config to support key rotation with fallback to single key
- Applied to all jobs: script generation, scene rendering, voiceover, shorts, thumbnail

**Key Rotation Logic:**
```typescript
// In gemini-client.ts
public getGenAI(): GoogleGenAI {
    // Round-robin between two API keys
    this.lastUsedKey = this.lastUsedKey === 1 ? 2 : 1;
    return this.lastUsedKey === 1 ? this.genAI1 : this.genAI2;
}
```

**Environment Variables Required:**
```bash
GEMINI_API_KEY_1=your_first_key_here
GEMINI_API_KEY_2=your_second_key_here
```

---

## Files Changed

### New Files Created:
1. `shared/services/video-ideas-queue.ts` - Redis queue service
2. `.github/scripts/manage-ideas.ts` - Queue management CLI
3. `MIGRATION_UPDATES.md` - This documentation

### Files Changed:

**New:**
- `shared/config/index.ts` - Centralized configuration
- `shared/services/cloudinary-service.ts` - Unified Cloudinary service
- `.github/workflows/main.yml` - GitHub Actions workflow
- `.github/scripts/*.ts` - 7 workflow scripts
- Documentation files

**Updated:**
- `.github/scripts/generate-script.ts` - Redis queue integration
- `.github/scripts/generate-thumbnail.ts` - Output thumbnail URL
- `.github/scripts/upload-youtube.ts` - Accept thumbnail URL parameter
- `shared/config/index.ts` - Redis config and Gemini key rotation
- `.env.example` - Updated with REDIS_URL

---

## GitHub Secrets Required

Update your GitHub repository secrets with these values:

### Required Secrets:
```
REDIS_URL=<redis-connection-string>
GEMINI_API_KEY_1=<your-first-gemini-key>
GEMINI_API_KEY_2=<your-second-gemini-key>
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-cloudinary-api-key>
CLOUDINARY_API_SECRET=<your-cloudinary-api-secret>
YT_CLIENT_ID=<your-youtube-client-id>
YT_CLIENT_SECRET=<your-youtube-client-secret>
YT_REFRESH_TOKEN=<your-youtube-refresh-token>
WEBSITE_DOMAIN=https://your-domain.com
```

### Optional Variables:
```
ENABLE_THUMBNAIL_GENERATION=true
```

---

## Testing Locally

### 1. Setup Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your actual values
nano .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Redis Queue
```bash
# Seed queue with default ideas
npx tsx .github/scripts/manage-ideas.ts seed

# Check queue status
npx tsx .github/scripts/manage-ideas.ts stats
```

### 4. Test Complete Pipeline
```bash
# Run full pipeline locally
./test-workflow-locally.sh all
```

### 5. Test Individual Components
```bash
# Test script generation with Redis
npx tsx .github/scripts/generate-script.ts

# Test with custom idea
npx tsx .github/scripts/generate-script.ts "Custom video idea"
```

---

## Workflow Execution Flow

```
1. Generate Script
   ├─ Fetch idea from Redis queue (or use custom input)
   ├─ Generate script via API
   └─ Mark idea as completed in Redis

2. Parallel Rendering (using key rotation)
   ├─ Render Scenes (GEMINI_API_KEY_1/2)
   └─ Generate Voiceover (GEMINI_API_KEY_1/2)

3. Assemble Video
   └─ Combine scenes + voiceover + music

4. Generate Thumbnail (NEW POSITION)
   ├─ Generate AI thumbnail
   └─ Output thumbnail URL

5. Upload to YouTube
   ├─ Download video from Cloudinary
   ├─ Upload to YouTube
   └─ Attach thumbnail if available

6. Process Shorts
   └─ Generate and upload shorts

7. Pipeline Summary
   └─ Display results
```

---

## Benefits

### Thumbnail Integration
- ✅ Professional appearance with custom thumbnails
- ✅ Automated thumbnail generation and upload
- ✅ Graceful fallback if thumbnail generation fails

### Redis Queue
- ✅ Centralized idea management
- ✅ Priority-based scheduling
- ✅ Prevents duplicate processing
- ✅ Easy to add new ideas programmatically
- ✅ Track completion history

### Key Rotation
- ✅ Double the API rate limit capacity
- ✅ Reduced rate limit errors
- ✅ Better handling of long voiceovers
- ✅ Improved reliability

---

## Monitoring

### Queue Health Check
```bash
# Check queue statistics
npx tsx .github/scripts/manage-ideas.ts stats

# Requeue stale items (older than 1 hour)
npx tsx .github/scripts/manage-ideas.ts requeue-stale
```

### GitHub Actions Logs
Monitor the workflow runs for:
- Key rotation messages: "Using Gemini API Key 1" / "Using Gemini API Key 2"
- Redis queue messages: "Video idea from Redis queue" vs "Random video idea"
- Thumbnail generation: "Thumbnail generated" → "Uploading thumbnail..."

---

## Troubleshooting

### Redis Connection Issues
If Redis is unavailable, the system will:
1. Log warning: "⚠️ Redis not available, using random idea"
2. Fall back to random idea selection
3. Continue pipeline execution normally

### Thumbnail Generation Fails
The workflow is configured to continue even if thumbnail fails:
```yaml
if: always() && needs.assemble-video.result == 'success'
```
Videos will upload without thumbnails if generation fails.

### Rate Limiting
With 2 keys, you get:
- 2x the requests per minute
- Automatic rotation between keys
- Better handling of burst requests

---

## Future Enhancements

Potential improvements:
1. Web UI for queue management
2. Webhook to add ideas from external sources
3. Analytics on idea performance
4. A/B testing for different prompts
5. Scheduled idea releases
6. Integration with social media for trending topics
