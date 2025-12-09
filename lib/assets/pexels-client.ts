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
 * @returns Array of StockClip objects
 */
export async function fetchClipsForKeyword(
  keyword: string,
  maxClips: number = 3
): Promise<StockClip[]> {
  if (!PEXELS_API_KEY) {
    console.error('❌ PEXELS_API_KEY not found in environment variables');
    return [];
  }

  try {
    console.log(`🔍 Searching Pexels for keyword: "${keyword}"`);

    const response = await fetch(
      `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(keyword)}&per_page=${maxClips}`,
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
    const clips: StockClip[] = data.videos
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
      .filter((clip: StockClip | null): clip is StockClip => clip !== null)
      .slice(0, maxClips);

    console.log(`✅ Found ${clips.length} clips for "${keyword}"`);
    return clips;
  } catch (error) {
    console.error(`❌ Error fetching clips for "${keyword}":`, error);
    return [];
  }
}
