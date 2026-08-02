/**
 * Utility for formatting and sanitizing YouTube video titles.
 * YouTube strictly enforces a maximum title length of 100 characters.
 * Any title longer than 100 characters will cause the YouTube API upload to fail (400 Bad Request / videoTitleTooLong).
 */

export const YOUTUBE_MAX_TITLE_LENGTH = 100;

/**
 * Ensures a YouTube video title meets YouTube's strict <= 100 character limit.
 * - Normalizes excessive whitespace and newlines into single spaces.
 * - Trims leading and trailing whitespace.
 * - If the title exceeds maxLength (default 100), cleanly truncates it:
 *   - Attempts to break at the last word boundary near the end and append '...'.
 *   - Falls back to hard cutoff + '...' if no clean word boundary exists.
 *   - Strictly guarantees result.length <= maxLength in all cases.
 *
 * @param title - The raw input title.
 * @param maxLength - The maximum allowed character count (default 100).
 * @returns The formatted title string guaranteed to be <= maxLength characters.
 */
export function formatYouTubeTitle(title?: string | null, maxLength: number = YOUTUBE_MAX_TITLE_LENGTH): string {
    if (!title || typeof title !== 'string') {
        return 'Untitled Video';
    }

    // Collapse newlines and multiple spaces into a single space, then trim
    const normalized = title.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();

    if (!normalized) {
        return 'Untitled Video';
    }

    if (normalized.length <= maxLength) {
        return normalized;
    }

    // If max length is very small (e.g., <= 3), return direct substring
    if (maxLength <= 3) {
        return normalized.slice(0, maxLength);
    }

    const maxContentLength = maxLength - 3; // Reserve 3 characters for "..."
    const slice = normalized.slice(0, maxContentLength).trim();

    // Look for last word boundary
    const lastSpaceIndex = slice.lastIndexOf(' ');

    // If there's a space within the latter part (at least 60% into the sliced text), break cleanly at word boundary
    if (lastSpaceIndex > maxContentLength * 0.6) {
        return `${slice.slice(0, lastSpaceIndex).trim()}...`;
    }

    return `${slice}...`;
}
