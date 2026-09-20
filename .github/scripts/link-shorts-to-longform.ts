/**
 * GitHub Actions Script: Link Shorts to Long-form Video
 * Runs after both upload-youtube and process-short complete.
 * 
 * Layer 1: Updates YouTube Shorts descriptions & pinned comments via YouTube Data API v3.
 * Layer 2: Updates the native "Related video" button in YouTube Studio via Puppeteer (if cookies provided).
 */

import Redis from 'ioredis';
import { google } from 'googleapis';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });

interface ShortResult {
    shortIndex: number;
    shortId: string;
    youtubeId: string;
    videoUrl: string;
    scheduledPublishTime?: string;
    rank?: number;
}

/**
 * Initialize authenticated YouTube Data API client
 */
function getYouTubeClient() {
    const oauth2Client = new google.auth.OAuth2(
        process.env.YT_CLIENT_ID,
        process.env.YT_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
        refresh_token: process.env.YT_REFRESH_TOKEN,
    });

    return google.youtube({
        version: 'v3',
        auth: oauth2Client,
    });
}

/**
 * Layer 1: Update Short description and post comment with long-form video link
 */
async function linkViaYouTubeApi(
    youtube: any,
    shortYoutubeId: string,
    longFormYoutubeId: string
) {
    const longFormUrl = `https://youtu.be/${longFormYoutubeId}`;
    console.error(`\n🔗 [Layer 1 API] Linking Short ${shortYoutubeId} -> Long Video ${longFormYoutubeId}`);

    // 1. Update Video Description
    try {
        const videoRes = await youtube.videos.list({
            part: ['snippet'],
            id: [shortYoutubeId]
        });

        const video = videoRes.data.items?.[0];
        if (video && video.snippet) {
            const currentDesc = video.snippet.description || '';
            if (!currentDesc.includes(longFormYoutubeId)) {
                const updatedDescription = `👉 Watch full episode: ${longFormUrl}\n\n${currentDesc}`;
                await youtube.videos.update({
                    part: ['snippet'],
                    requestBody: {
                        id: shortYoutubeId,
                        snippet: {
                            ...video.snippet,
                            description: updatedDescription
                        }
                    }
                });
                console.error(`   ✅ Updated Short description with full video link`);
            } else {
                console.error(`   ℹ️ Short description already contains long-form video link`);
            }
        }
    } catch (descErr) {
        console.error(`   ⚠️ Failed to update Short description:`, descErr);
    }

    // 2. Insert Pinned / Top-level Comment
    try {
        await youtube.commentThreads.insert({
            part: ['snippet'],
            requestBody: {
                snippet: {
                    videoId: shortYoutubeId,
                    topLevelComment: {
                        snippet: {
                            textOriginal: `⚡ Watch the full deep-dive video here: ${longFormUrl}`
                        }
                    }
                }
            }
        });
        console.error(`   ✅ Inserted top-level comment with full video link`);
    } catch (commentErr: any) {
        // Comment insertion might be disabled for scheduled/private videos or specific channel permissions
        console.error(`   ℹ️ Comment note:`, commentErr.message || commentErr);
    }
}

/**
 * Layer 2: Set native "Related video" button in YouTube Studio web UI via Puppeteer
 */
async function setNativeRelatedVideoInStudio(
    shortYoutubeId: string,
    longFormYoutubeId: string,
    cookies: any[]
): Promise<boolean> {
    console.error(`\n🤖 [Layer 2 Studio UI] Automating YouTube Studio Related Video button...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Set cookies for studio.youtube.com
        await page.setCookie(...cookies);

        const editUrl = `https://studio.youtube.com/video/${shortYoutubeId}/edit`;
        console.error(`   Navigating to: ${editUrl}`);
        await page.goto(editUrl, { waitUntil: 'networkidle2', timeout: 45000 });

        // Check if redirected to login page (cookies expired)
        const currentUrl = page.url();
        if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
            console.error(`   ⚠️ YouTube Studio session cookies expired or invalid. Skipped UI click.`);
            return false;
        }

        // Wait for edit container
        await page.waitForSelector('#main, #basics, ytcp-video-metadata-basics', { timeout: 15000 });
        console.error(`   ✅ Video edit page loaded`);

        // Find "Related video" button on the right sidebar
        // In YouTube Studio, the button usually has text "Related video" or aria-label="Related video"
        const relatedButtonSelector = [
            '#related-video-button',
            'button[aria-label*="Related video"]',
            'ytcp-button[aria-label*="Related video"]',
            'div[aria-label*="Related video"]',
            'ytcp-video-metadata-basics ytcp-button'
        ].join(', ');

        const relatedBtn = await page.waitForSelector(relatedButtonSelector, { timeout: 10000 });
        if (!relatedBtn) {
            console.error(`   ⚠️ Could not find Related Video button selector in Studio.`);
            return false;
        }

        await relatedBtn.click();
        console.error(`   Clicked "Related video" button`);

        // Wait for video picker dialog
        await page.waitForSelector('ytcp-video-pick-dialog, [role="dialog"]', { timeout: 10000 });
        console.error(`   Video picker dialog opened`);

        // Wait a short moment for items to render
        await new Promise(r => setTimeout(r, 1500));

        // In the picker dialog, either search for the longFormYoutubeId or select the first video
        const searchInput = await page.$('ytcp-video-pick-dialog input, [role="dialog"] input');
        if (searchInput) {
            await searchInput.type(longFormYoutubeId, { delay: 50 });
            await new Promise(r => setTimeout(r, 1500));
        }

        // Click the matching video row / item in the dialog
        const videoRowSelector = 'ytcp-video-pick-dialog ytcp-entity-card, ytcp-video-pick-dialog tr, [role="dialog"] ytcp-entity-card';
        const videoRow = await page.waitForSelector(videoRowSelector, { timeout: 10000 });
        if (videoRow) {
            await videoRow.click();
            console.error(`   Selected long-form video in picker dialog`);
        }

        // Wait for dialog to close
        await new Promise(r => setTimeout(r, 1500));

        // Click Save button (#save-button)
        const saveButtonSelector = '#save-button:not([disabled]), ytcp-button#save-button:not([disabled])';
        const saveBtn = await page.$(saveButtonSelector);
        if (saveBtn) {
            await saveBtn.click();
            console.error(`   Clicked Save button`);
            await new Promise(r => setTimeout(r, 3000));
            console.error(`   ✅ Successfully saved Related Video in YouTube Studio!`);
            return true;
        } else {
            console.error(`   ℹ️ Save button was not active or already saved.`);
            return true;
        }

    } catch (uiErr: any) {
        console.error(`   ⚠️ Studio browser automation notice:`, uiErr.message || uiErr);
        return false;
    } finally {
        await browser.close();
    }
}

/**
 * Load YouTube Studio cookies from secret or local file
 */
function loadCookies(): any[] | null {
    // 1. From environment variable (GitHub Secret YOUTUBE_STUDIO_COOKIES)
    const envCookies = process.env.YOUTUBE_STUDIO_COOKIES;
    if (envCookies) {
        try {
            const parsed = JSON.parse(envCookies);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            console.error('⚠️ Could not parse YOUTUBE_STUDIO_COOKIES JSON:', e);
        }
    }

    // 2. From local file
    const localCookiePath = path.join(process.cwd(), 'youtube-cookies.json');
    if (fs.existsSync(localCookiePath)) {
        try {
            const raw = fs.readFileSync(localCookiePath, 'utf-8');
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (e) {
            console.error('⚠️ Could not parse local youtube-cookies.json:', e);
        }
    }

    return null;
}

// ── Main Execution ────────────────────────────────────────────────────────────
(async () => {
    try {
        const videoId = process.argv[2];
        const longFormYoutubeId = process.argv[3];

        if (!videoId || !longFormYoutubeId) {
            throw new Error('Usage: npx tsx link-shorts-to-longform.ts <videoId> <longFormYoutubeId>');
        }

        console.error(`\n======================================================`);
        console.error(`🎬 LINKING SHORTS TO LONG-FORM VIDEO OF THE DAY`);
        console.error(`📌 Internal Video ID: ${videoId}`);
        console.error(`📺 Long-Form YouTube ID: ${longFormYoutubeId}`);
        console.error(`======================================================\n`);

        // Connect to Redis to get uploaded shorts
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            throw new Error('Missing required REDIS_URL environment variable');
        }

        const redis = new Redis(redisUrl, {
            connectTimeout: 5000,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null
        });

        let rawShorts: string[] = [];
        try {
            rawShorts = await redis.lrange(`pipeline:shorts:${videoId}`, 0, -1);
            await redis.quit();
        } catch (rErr) {
            console.error('⚠️ Redis connection error:', rErr);
            redis.disconnect();
        }

        if (!rawShorts || rawShorts.length === 0) {
            console.error(`ℹ️ No shorts found in Redis key: pipeline:shorts:${videoId}`);
            process.exit(0);
        }

        const shorts: ShortResult[] = rawShorts.map(r => JSON.parse(r));
        console.error(`📱 Found ${shorts.length} uploaded Shorts to link:\n`);
        shorts.forEach((s, i) => console.error(`   ${i + 1}. Short #${s.shortIndex} -> YouTube ID: ${s.youtubeId}`));

        // 1. Run Layer 1 (YouTube Data API)
        const youtube = getYouTubeClient();
        for (const short of shorts) {
            if (short.youtubeId) {
                await linkViaYouTubeApi(youtube, short.youtubeId, longFormYoutubeId);
            }
        }

        // 2. Run Layer 2 (YouTube Studio UI Automation if cookies available)
        const cookies = loadCookies();
        if (cookies && cookies.length > 0) {
            console.error(`\n🍪 Loaded ${cookies.length} YouTube Studio cookies for UI automation.`);
            for (const short of shorts) {
                if (short.youtubeId) {
                    await setNativeRelatedVideoInStudio(short.youtubeId, longFormYoutubeId, cookies);
                }
            }
        } else {
            console.error(`\nℹ️ [Layer 2 Note] To automate the native YouTube Studio "Related video" button:`);
            console.error(`   Add your exported YouTube Studio cookies to GitHub Secret "YOUTUBE_STUDIO_COOKIES"`);
            console.error(`   or save them to youtube-cookies.json. (Layer 1 description linking is active)`);
        }

        console.error(`\n✅ Finished linking all shorts to long-form video!`);
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error linking shorts to long-form video:', error.message || error);
        // Do not fail the whole pipeline if linking has a warning
        process.exit(0);
    }
})();
