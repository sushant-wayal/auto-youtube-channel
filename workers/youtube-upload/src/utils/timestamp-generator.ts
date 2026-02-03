/**
 * Timestamp Generator Utility
 * Generates YouTube chapter timestamps from scene data
 */

/**
 * Format seconds to YouTube timestamp format (MM:SS or HH:MM:SS)
 * @param seconds Total seconds
 * @returns Formatted timestamp string
 */
export function formatTimestamp(seconds: number): string {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate YouTube chapter timestamps from scene titles and durations
 * @param sceneTitles Array of chapter/scene titles
 * @param sceneDurations Array of scene durations in seconds (actual from assembly)
 * @param options Optional configuration
 * @param options.introTitle Title for intro section (if intro exists)
 * @param options.introDuration Duration of intro in seconds (default: 8)
 * @param options.outroTitle Title for outro section (if outro exists)
 * @param options.outroDuration Duration of outro in seconds (default: 8)
 * @returns Formatted timestamp string for YouTube description
 */
export function generateTimestamps(
    sceneTitles: string[],
    sceneDurations: number[],
    options?: {
        introTitle?: string;
        introDuration?: number;
        outroTitle?: string;
        outroDuration?: number;
    }
): string {
    if (sceneTitles.length === 0 || sceneDurations.length === 0) {
        return '';
    }

    if (sceneTitles.length !== sceneDurations.length) {
        console.warn(`Warning: sceneTitles (${sceneTitles.length}) and sceneDurations (${sceneDurations.length}) length mismatch`);
        // Use minimum length to avoid errors
        const minLength = Math.min(sceneTitles.length, sceneDurations.length);
        sceneTitles = sceneTitles.slice(0, minLength);
        sceneDurations = sceneDurations.slice(0, minLength);
    }

    // YouTube requires at least 3 timestamps
    const hasIntro = options?.introTitle && options?.introDuration;
    const hasOutro = options?.outroTitle && options?.outroDuration;
    const totalChapters = sceneTitles.length + (hasIntro ? 1 : 0) + (hasOutro ? 1 : 0);

    if (totalChapters < 3) {
        console.warn('Need at least 3 chapters for YouTube timestamps');
        return '';
    }

    const timestamps: string[] = [];
    const introDuration = options?.introDuration || 8;
    const outroDuration = options?.outroDuration || 8;
    let currentTime = 0;

    // Add intro chapter if it exists
    if (hasIntro) {
        timestamps.push(`0:00 - ${options.introTitle}`);
        currentTime = introDuration;
    }

    // Add scene chapters (offset by intro duration if intro exists)
    for (let i = 0; i < sceneTitles.length; i++) {
        const timestamp = formatTimestamp(currentTime);
        timestamps.push(`${timestamp} - ${sceneTitles[i]}`);
        currentTime += sceneDurations[i];
    }

    // Add outro chapter if it exists
    if (hasOutro) {
        const timestamp = formatTimestamp(currentTime);
        timestamps.push(`${timestamp} - ${options.outroTitle}`);
    }

    return timestamps.join('\n');
}

/**
 * Validate if timestamp generation is viable
 * @param sceneTitles Scene titles array
 * @param sceneDurations Scene durations array
 * @param hasIntro Whether video has intro
 * @param hasOutro Whether video has outro
 * @returns true if can generate valid timestamps
 */
export function canGenerateTimestamps(
    sceneTitles: string[],
    sceneDurations: number[],
    hasIntro: boolean = false,
    hasOutro: boolean = false
): boolean {
    // Need at least 3 total chapters (scenes + intro + outro)
    const totalChapters = sceneTitles.length + (hasIntro ? 1 : 0) + (hasOutro ? 1 : 0);

    if (totalChapters < 3) {
        return false;
    }

    if (sceneDurations.length < sceneTitles.length) {
        return false;
    }

    // Check if any duration is too short (< 10 seconds per YouTube requirement)
    const hasTooShortScene = sceneDurations.some(d => d < 10);
    if (hasTooShortScene) {
        console.warn('Some scenes are < 10 seconds, which may not meet YouTube chapter requirements');
        // Still allow, YouTube will just warn
    }

    return true;
}
