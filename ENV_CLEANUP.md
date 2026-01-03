# Environment Variables by Job - Cleaned Up

## Summary of Changes

Removed unnecessary environment variables from GitHub Actions workflow. Each job now only has the env vars it actually needs.

## Job Environment Requirements

### 1. Generate Script
**Required:**
- `WEBSITE_DOMAIN` - API endpoint for script generation
- `REDIS_HOST` - Redis queue host
- `REDIS_PORT` - Redis port
- `REDIS_PASSWORD` - Redis authentication

**Removed:**
- ❌ `GEMINI_API_KEY_1` - Not used (API handles Gemini internally)
- ❌ `GEMINI_API_KEY_2` - Not used

---

### 2. Render Scenes (Parallel)
**Required:**
- `CLOUDINARY_CLOUD_NAME` - Upload rendered scenes
- `CLOUDINARY_API_KEY` - Cloudinary auth
- `CLOUDINARY_API_SECRET` - Cloudinary auth

**Removed:**
- ❌ `GEMINI_API_KEY_1` - Scene rendering doesn't use Gemini
- ❌ `GEMINI_API_KEY_2` - Scene rendering doesn't use Gemini

---

### 3. Generate Voice-Overs (Parallel)
**Required:**
- `CLOUDINARY_CLOUD_NAME` - Upload audio files
- `CLOUDINARY_API_KEY` - Cloudinary auth
- `CLOUDINARY_API_SECRET` - Cloudinary auth
- `GEMINI_API_KEY_1` - TTS generation (key rotation)
- `GEMINI_API_KEY_2` - TTS generation (key rotation)

**No changes** - All env vars needed ✓

---

### 4. Assemble Video
**Required:**
- `CLOUDINARY_CLOUD_NAME` - Download assets & upload final video
- `CLOUDINARY_API_KEY` - Cloudinary auth
- `CLOUDINARY_API_SECRET` - Cloudinary auth

**Already correct** - No unnecessary vars ✓

---

### 5. Generate Thumbnail
**Required:**
- `WEBSITE_DOMAIN` - API endpoint for thumbnail generation

**Removed:**
- ❌ `CLOUDINARY_CLOUD_NAME` - API handles this internally
- ❌ `CLOUDINARY_API_KEY` - API handles this internally
- ❌ `CLOUDINARY_API_SECRET` - API handles this internally
- ❌ `GEMINI_API_KEY_1` - API handles this internally
- ❌ `GEMINI_API_KEY_2` - API handles this internally

---

### 6. Upload to YouTube
**Required:**
- `YT_CLIENT_ID` - YouTube API auth
- `YT_CLIENT_SECRET` - YouTube API auth
- `YT_REFRESH_TOKEN` - YouTube API auth

**Already correct** - No unnecessary vars ✓

---

### 7. Process Shorts
**Required:**
- `CLOUDINARY_CLOUD_NAME` - Asset management
- `CLOUDINARY_API_KEY` - Cloudinary auth
- `CLOUDINARY_API_SECRET` - Cloudinary auth
- `GEMINI_API_KEY_1` - Voice-over generation (key rotation)
- `GEMINI_API_KEY_2` - Voice-over generation (key rotation)
- `YT_CLIENT_ID` - Upload shorts to YouTube
- `YT_CLIENT_SECRET` - YouTube API auth
- `YT_REFRESH_TOKEN` - YouTube API auth

**Already correct** - All vars needed ✓

---

## Updated validateConfig Calls

Fixed script validation to match actual requirements:

```typescript
// generate-script.ts
validateConfig(['website']);  // Was: ['website', 'gemini']

// render-scenes.ts  
validateConfig(['cloudinary']);  // Was: ['cloudinary', 'gemini']

// generate-thumbnail.ts
validateConfig(['website']);  // Was: ['cloudinary', 'gemini']

// Other scripts unchanged (already correct)
```

---

## Benefits

✅ **Cleaner configuration** - Only necessary secrets exposed
✅ **Easier debugging** - Clear what each job needs
✅ **Better security** - Minimal credential exposure
✅ **Accurate validation** - Scripts validate what they actually use
✅ **Consistent pattern** - API-calling scripts only need WEBSITE_DOMAIN

---

## Testing

Build still passes after cleanup:
```bash
npm run build  # ✓ All workspaces build successfully
```

All GitHub Actions warnings remain expected (secrets not configured in repo yet).
