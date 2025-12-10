/**
 * Pexels Stock Footage Client
 * Fetches stock video clips from Pexels API
 */

export interface StockClip {
  url: string;
  width: number;
  height: number;
  duration: number;
}

const PEXELS_API_KEY = process.env.PEXELS_API_KEY || '';

/**
 * Fetch stock video clips for a given keyword from Pexels
 * @param keyword - Search keyword
 * @param maxClips - Maximum number of clips to return (default: 3)
 * @param minDuration - Minimum duration in seconds (optional, filters clips shorter than this)
 * @returns Array of StockClip objects
 */
export async function fetchClipsForKeyword(
  keyword: string,
  maxClips: number = 3,
  minDuration?: number
): Promise<StockClip[]> {
  if (!PEXELS_API_KEY) {
    console.error('❌ PEXELS_API_KEY not found in environment variables');
    return [];
  }

  try {
    const durationFilter = minDuration ? ` (min ${minDuration.toFixed(1)}s)` : '';
    console.log(`🔍 Searching Pexels for keyword: "${keyword}"${durationFilter}`);

    // Fetch more results to have better filtering options
    const fetchCount = minDuration ? Math.max(maxClips * 3, 10) : maxClips;

    const response = await fetch(
      `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(keyword)}&per_page=${fetchCount}`,
      {
        headers: {
          Authorization: PEXELS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ Pexels API error for "${keyword}": ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();

    if (!data.videos || data.videos.length === 0) {
      console.log(`⚠️ No videos found for keyword: "${keyword}"`);
      return [];
    }

    // Process videos and extract best quality clips
    let clips: StockClip[] = data.videos
      .map((video: any) => {
        // Find the best video file (HD MP4)
        const videoFiles = video.video_files || [];

        // Sort by quality: prefer HD, then width
        const bestFile = videoFiles
          .filter((file: any) => file.file_type === 'video/mp4')
          .sort((a: any, b: any) => {
            // Prefer 'hd' quality
            if (a.quality === 'hd' && b.quality !== 'hd') return -1;
            if (b.quality === 'hd' && a.quality !== 'hd') return 1;
            // Then sort by width
            return (b.width || 0) - (a.width || 0);
          })[0];

        if (!bestFile) {
          return null;
        }

        return {
          url: bestFile.link,
          width: bestFile.width || 1920,
          height: bestFile.height || 1080,
          duration: video.duration || 10,
        };
      })
      .filter((clip: StockClip | null): clip is StockClip => clip !== null);

    // Apply minimum duration filter if specified
    if (minDuration && minDuration > 0) {
      const filteredClips = clips.filter(clip => clip.duration >= minDuration);
      if (filteredClips.length > 0) {
        clips = filteredClips;
        console.log(`✅ Found ${clips.length} clips meeting duration requirement (>=${minDuration.toFixed(1)}s)`);
      } else {
        console.log(`⚠️ No clips meet duration requirement, returning all ${clips.length} clips`);
      }
    }

    // Sort by duration (prefer longer clips to reduce looping)
    clips.sort((a, b) => b.duration - a.duration);

    const result = clips.slice(0, maxClips);
    console.log(`✅ Returning ${result.length} clips for "${keyword}"`);
    return result;
  } catch (error) {
    console.error(`❌ Error fetching clips for "${keyword}":`, error);
    return [];
  }
}
