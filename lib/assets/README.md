# Assets Layer Documentation

## Overview

The Assets Layer is responsible for gathering all media assets needed for video production:
- **Stock Footage**: Downloads relevant video clips from Pexels based on script keywords
- **Background Music**: Selects random music tracks from your library
- **Branding Assets**: Includes logo, intro, and outro videos

## Architecture

```
lib/assets/
├── keyword-extractor.ts    - Extracts visual keywords from narration
├── pexels-client.ts         - Fetches stock videos from Pexels API
├── clip-downloader.ts       - Downloads and saves video clips
└── music-branding.ts        - Manages music and branding assets
```

## Setup

### 1. Get Pexels API Key

1. Visit [Pexels API](https://www.pexels.com/api/)
2. Sign up for a free account
3. Generate an API key (completely free, no credit card required)
4. Add to `.env.local`:
   ```bash
   PEXELS_API_KEY=your_api_key_here
   ```

### 2. Add Music Assets

Place copyright-free `.mp3` files in `assets/music/`:

```
assets/music/
├── track1.mp3
├── track2.mp3
└── track3.mp3
```

**Recommended sources:**
- [YouTube Audio Library](https://www.youtube.com/audiolibrary/music)
- [Free Music Archive](https://freemusicarchive.org/)
- [Incompetech](https://incompetech.com/music/royalty-free/)

### 3. Add Branding Assets (Optional)

Place these files in `assets/branding/`:

- `logo.png` - PNG logo with transparency (512x512+)
- `intro.mp4` - Opening video (3-5 seconds, 1920x1080)
- `outro.mp4` - Closing video (5-10 seconds, 1920x1080)

All are optional - the system adapts to what's available.

## Usage

### API Route

```typescript
POST /api/generate-assets

Body:
{
  "videoId": "video-1234567890",
  "title": "Video Title",
  "narration": "Full narration text..."
}

Response:
{
  "success": true,
  "assets": {
    "videoId": "video-1234567890",
    "clips": [
      "/absolute/path/to/clip-001.mp4",
      "/absolute/path/to/clip-002.mp4",
      ...
    ],
    "music": "/absolute/path/to/selected-track.mp3",
    "branding": {
      "logo": "/absolute/path/to/logo.png",
      "intro": "/absolute/path/to/intro.mp4",
      "outro": "/absolute/path/to/outro.mp4"
    }
  }
}
```

### Programmatic Usage

```typescript
import VideoGenerationPipeline from "@/lib/pipeline";

const pipeline = new VideoGenerationPipeline();

const assets = await pipeline.generateAssets(
  "video-123",
  "My Video Title",
  "Full narration text..."
);

console.log(`Downloaded ${assets.clips.length} clips`);
console.log(`Music: ${assets.music}`);
console.log(`Branding: ${Object.keys(assets.branding).length} assets`);
```

## How It Works

### 1. Keyword Extraction

The `extractKeywords()` function:
- Converts narration to lowercase
- Removes punctuation and stopwords
- Filters words ≤ 3 characters
- Counts word frequency
- Returns top N keywords (default: 10)

**Example:**
```typescript
Input: "React hooks are powerful features in React development..."
Output: ["react", "hooks", "powerful", "features", "development", ...]
```

### 2. Stock Footage Search

For each keyword, the system:
1. Searches Pexels Video API
2. Filters for MP4 format
3. Selects highest quality (HD preferred)
4. Downloads up to 3 clips per keyword
5. Continues until target count reached (default: 10 clips)

### 3. File Organization

Downloaded clips are organized as:
```
tmp/footage/
└── video-1234567890/
    ├── clip-001.mp4
    ├── clip-002.mp4
    ├── clip-003.mp4
    └── ...
```

### 4. Error Handling

The system is designed to be resilient:
- **No API key**: Logs error, returns empty array
- **No videos found**: Logs warning, tries next keyword
- **Download fails**: Logs error, continues with next clip
- **No music files**: Throws clear error with instructions
- **No branding**: Returns empty object (not an error)

## Configuration

### Adjusting Clip Count

Edit the API call or pipeline:

```typescript
// Download 15 clips instead of 10
const clips = await downloadClipsForVideo(videoId, narration, 15);
```

### Changing Keyword Count

```typescript
// Extract 15 keywords instead of 10
const keywords = extractKeywords(narration, 15);
```

### Clips Per Keyword

Edit `clip-downloader.ts`:

```typescript
// Fetch 5 clips per keyword instead of 3
const clips = await fetchClipsForKeyword(keyword, 5);
```

## Integration with Pipeline

The assets layer is integrated into the main video generation pipeline:

1. **Stage 1**: Script generation ✅
2. **Stage 2**: Assets generation ✅ (NEW)
3. **Stage 3**: Audio generation (paused)
4. **Stage 4**: Video composition (TODO)
5. **Stage 5**: Final rendering (TODO)

The assets are automatically passed to subsequent stages for video composition.

## UI Integration

The updated UI shows:
- ✅ Assets generation button (after script is generated)
- ✅ Real-time progress indicator
- ✅ Assets summary (clips count, music, branding)
- ✅ Success/error states
- ✅ Next step guidance

## Performance Considerations

- **API Rate Limits**: Pexels free tier: 200 requests/hour
- **Download Time**: ~30-60 seconds for 10 HD clips
- **Storage**: ~100-200MB per video (10 clips)
- **Bandwidth**: Consider for production deployments

## Troubleshooting

### "PEXELS_API_KEY not found"
- Add the key to `.env.local`
- Restart your Next.js dev server

### "No .mp3 files found"
- Add MP3 files to `assets/music/`
- Check file extensions are lowercase

### Downloads are slow
- Normal for HD clips (5-20MB each)
- Check your internet connection
- Consider reducing clip count

### No clips downloaded
- Verify API key is valid
- Check Pexels API status
- Try simpler/more common keywords

## Future Enhancements

Potential improvements:
- [ ] Cache downloaded clips for reuse
- [ ] Support additional stock footage APIs (Pixabay, etc.)
- [ ] Smart clip selection based on duration
- [ ] Clip preview/thumbnails in UI
- [ ] Batch download optimization
- [ ] Clip quality preferences
- [ ] Custom keyword input

## License & Attribution

- Pexels videos are free to use (requires attribution in final video)
- Ensure your music is properly licensed
- Check individual asset licenses before commercial use
