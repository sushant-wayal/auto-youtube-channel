import { google, Auth } from 'googleapis';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface TrendingItem {
    title: string;
    source: 'youtube' | 'hackernews' | 'reddit';
    score?: number;       // HN points / Reddit upvotes / YouTube view count (approx)
    url?: string;
    metadata?: string;    // category, subreddit, etc.
}

export interface TrendingSignals {
    youtube: TrendingItem[];
    hackerNews: TrendingItem[];
    reddit: TrendingItem[];
    fetchedAt: string;
    errors: string[];     // non-fatal fetch errors logged here
}

// ─── YouTube Trending ─────────────────────────────────────────────────────────

/**
 * Fetch top trending Science & Technology videos from YouTube.
 * Uses the existing OAuth credentials (same as the rest of the app).
 */
async function fetchYouTubeTrending(): Promise<TrendingItem[]> {
    const oauth2Client = new google.auth.OAuth2(
        process.env.YT_CLIENT_ID,
        process.env.YT_CLIENT_SECRET
    ) as Auth.OAuth2Client;

    oauth2Client.setCredentials({ refresh_token: process.env.YT_REFRESH_TOKEN });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const response = await youtube.videos.list({
        part: ['snippet', 'statistics'],
        chart: 'mostPopular',
        videoCategoryId: '28', // Science & Technology
        maxResults: 15,
        regionCode: 'IN',      // target region (India)
    });

    const items = response.data.items || [];

    return items.map(v => ({
        source: 'youtube' as const,
        title: v.snippet?.title || '',
        score: parseInt(v.statistics?.viewCount || '0', 10),
        metadata: `category=Science&Technology, channel=${v.snippet?.channelTitle || ''}`,
    })).filter(v => v.title);
}

// ─── Hacker News ──────────────────────────────────────────────────────────────

/**
 * Fetch top front-page Hacker News stories via the Algolia API (no auth needed).
 * Filters to tech/programming relevant titles.
 */
async function fetchHackerNewsTrending(): Promise<TrendingItem[]> {
    const url = 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=25';
    const response = await fetch(url, {
        headers: { 'User-Agent': 'video-pipeline-trend-detector/1.0' },
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new Error(`HN API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        hits: Array<{ title?: string; points?: number; url?: string; story_text?: string }>;
    };

    // Filter to tech-relevant stories
    const techKeywords = [
        'javascript', 'typescript', 'node', 'react', 'python', 'rust', 'go',
        'ai', 'llm', 'gpt', 'machine learning', 'ml', 'deep learning',
        'software', 'programming', 'developer', 'open source', 'github',
        'database', 'api', 'framework', 'library', 'web', 'backend', 'frontend',
        'cloud', 'docker', 'kubernetes', 'devops', 'architecture',
        'startup', 'tech', 'coding', 'engineer', 'algorithm',
    ];

    return (data.hits || [])
        .filter(hit => {
            if (!hit.title) return false;
            const lower = hit.title.toLowerCase();
            return techKeywords.some(kw => lower.includes(kw));
        })
        .slice(0, 15)
        .map(hit => ({
            source: 'hackernews' as const,
            title: hit.title || '',
            score: hit.points || 0,
            url: hit.url,
            metadata: 'source=HackerNews front_page',
        }));
}

// ─── Reddit ───────────────────────────────────────────────────────────────────

const REDDIT_SUBREDDITS = [
    'programming',
    'webdev',
    'javascript',
    'typescript',
    'node',
    'ExperiencedDevs',
    'devops',
    'learnprogramming',
].join('+');

/**
 * Fetch top posts from tech subreddits (today) via the Reddit JSON API (no auth).
 */
async function fetchRedditTrending(): Promise<TrendingItem[]> {
    const url = `https://www.reddit.com/r/${REDDIT_SUBREDDITS}/top.json?t=day&limit=20`;
    const response = await fetch(url, {
        headers: { 'User-Agent': 'video-pipeline-trend-detector/1.0' },
        signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
        throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        data?: { children?: Array<{ data: { title?: string; score?: number; subreddit?: string; url?: string } }> };
    };

    const posts = data.data?.children || [];

    return posts
        .filter(p => p.data.title)
        .map(p => ({
            source: 'reddit' as const,
            title: p.data.title || '',
            score: p.data.score || 0,
            url: p.data.url,
            metadata: `subreddit=r/${p.data.subreddit || ''}`,
        }));
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetch trending signals from all sources concurrently.
 * Each source failure is caught individually — errors are logged but never
 * propagate, so idea selection continues even if all sources are down.
 */
export async function fetchTrendingSignals(): Promise<TrendingSignals> {
    console.error('📡 Fetching trending signals from all sources (concurrent)...');

    const errors: string[] = [];

    const [ytResult, hnResult, redditResult] = await Promise.allSettled([
        fetchYouTubeTrending(),
        fetchHackerNewsTrending(),
        fetchRedditTrending(),
    ]);

    const youtube = ytResult.status === 'fulfilled'
        ? ytResult.value
        : (errors.push(`YouTube trending: ${(ytResult.reason as Error)?.message}`), []);

    const hackerNews = hnResult.status === 'fulfilled'
        ? hnResult.value
        : (errors.push(`Hacker News: ${(hnResult.reason as Error)?.message}`), []);

    const reddit = redditResult.status === 'fulfilled'
        ? redditResult.value
        : (errors.push(`Reddit: ${(redditResult.reason as Error)?.message}`), []);

    const signals: TrendingSignals = {
        youtube,
        hackerNews,
        reddit,
        fetchedAt: new Date().toISOString(),
        errors,
    };

    const totalSignals = youtube.length + hackerNews.length + reddit.length;
    console.error(`   ✅ YouTube: ${youtube.length} trends`);
    console.error(`   ✅ Hacker News: ${hackerNews.length} stories`);
    console.error(`   ✅ Reddit: ${reddit.length} posts`);
    if (errors.length > 0) {
        console.error(`   ⚠️  ${errors.length} source(s) failed (non-fatal): ${errors.join('; ')}`);
    }
    console.error(`   📊 Total trending signals: ${totalSignals}`);

    return signals;
}

/**
 * Formats trending signals into a compact string for injection into AI prompts.
 *
 * Score legend (included in output so the AI can normalise across sources):
 *   YouTube  → view count (e.g. 1 200 000). Scale: millions. Higher = more reach.
 *   HN       → upvote points (e.g. 842). Scale: hundreds. Higher = more developer interest.
 *   Reddit   → upvote score (e.g. 4 300). Scale: thousands. Higher = more community engagement.
 *
 * Because the scales differ by orders of magnitude, Gemini must treat them as
 * relative signals within each source, not compare raw numbers across sources.
 */
export function formatTrendingSignalsForPrompt(signals: TrendingSignals): string {
    const lines: string[] = [];

    // ── Score legend ────────────────────────────────────────────────────────
    lines.push('SCORE LEGEND (scores are NOT comparable across sources — different scales):');
    lines.push('  YouTube score  = total view count (scale: millions).  Higher → broader audience reach.');
    lines.push('  HN score       = upvote points     (scale: hundreds). Higher → stronger dev community interest.');
    lines.push('  Reddit score   = upvote score       (scale: thousands). Higher → more community engagement.');
    lines.push('  Use each source\'s score only to rank items WITHIN that source.');

    if (signals.youtube.length > 0) {
        lines.push('\nYOUTUBE TRENDING (Science & Technology, India today):');
        signals.youtube
            .slice(0, 10)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .forEach((item, i) => {
                const views = item.score != null
                    ? `[${(item.score / 1_000_000).toFixed(2)}M views]`
                    : '[views N/A]';
                lines.push(`  ${i + 1}. ${views} ${item.title}`);
            });
    }

    if (signals.hackerNews.length > 0) {
        lines.push('\nHACKER NEWS FRONT PAGE (tech stories today):');
        signals.hackerNews
            .slice(0, 10)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .forEach((item, i) => lines.push(`  ${i + 1}. [${item.score} pts] ${item.title}`));
    }

    if (signals.reddit.length > 0) {
        lines.push('\nREDDIT TOP POSTS (r/programming+webdev+javascript+… today):');
        signals.reddit
            .slice(0, 10)
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .forEach((item, i) => lines.push(`  ${i + 1}. [↑${item.score}] ${item.title} (${item.metadata})`));
    }

    if (signals.youtube.length === 0 && signals.hackerNews.length === 0 && signals.reddit.length === 0) {
        return '(No trending signals available — using channel data only)';
    }

    return lines.join('\n');
}
