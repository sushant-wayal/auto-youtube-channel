/**
 * Local Helper: Link Shorts to Long-form Video
 * Run with: npm run link:shorts [longFormVideoId] [shortVideoId1] [shortVideoId2]...
 * 
 * Or run without arguments to automatically fetch the latest uploaded video IDs from Redis.
 */

import puppeteer from 'puppeteer';
import { google } from 'googleapis';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

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

(async () => {
    try {
        const args = process.argv.slice(2);
        let longFormYoutubeId = args[0];
        let shortYoutubeIds = args.slice(1);

        console.log(`\n======================================================`);
        console.log(`🎬 LOCAL HELPER: LINK SHORTS TO LONG-FORM VIDEO`);
        console.log(`======================================================\n`);

        // If arguments not provided, attempt to get latest from Redis
        if (!longFormYoutubeId && process.env.REDIS_URL) {
            console.log(`Fetching latest video IDs from Redis...`);
            const redis = new Redis(process.env.REDIS_URL);
            const keys = await redis.keys('pipeline:shorts:*');
            if (keys && keys.length > 0) {
                // Pick the most recent key
                const latestKey = keys[keys.length - 1];
                const rawShorts = await redis.lrange(latestKey, 0, -1);
                if (rawShorts.length > 0) {
                    shortYoutubeIds = rawShorts.map(s => JSON.parse(s).youtubeId).filter(Boolean);
                    console.log(`Found ${shortYoutubeIds.length} shorts in Redis key: ${latestKey}`);
                }
            }
            await redis.quit();
        }

        if (!longFormYoutubeId) {
            console.log(`Usage:`);
            console.log(`  npm run link:shorts <longFormYoutubeId> [shortYoutubeId1] [shortYoutubeId2]...\n`);
            console.log(`Example:`);
            console.log(`  npm run link:shorts dQw4w9WgXcQ 12345Short1 12345Short2\n`);
            process.exit(1);
        }

        console.log(`📺 Target Long-Form Video: https://youtu.be/${longFormYoutubeId}`);
        console.log(`📱 Shorts to link: ${shortYoutubeIds.join(', ') || '(none detected)'}\n`);

        // Layer 1: Update descriptions via API
        if (process.env.YT_CLIENT_ID && process.env.YT_REFRESH_TOKEN) {
            console.log(`🔗 [Layer 1] Updating Shorts descriptions via official YouTube API...`);
            const youtube = getYouTubeClient();
            for (const shortId of shortYoutubeIds) {
                try {
                    const videoRes = await youtube.videos.list({ part: ['snippet'], id: [shortId] });
                    const video = videoRes.data.items?.[0];
                    if (video?.snippet) {
                        const currentDesc = video.snippet.description || '';
                        if (!currentDesc.includes(longFormYoutubeId)) {
                            const updatedDescription = `👉 Watch full episode: https://youtu.be/${longFormYoutubeId}\n\n${currentDesc}`;
                            await youtube.videos.update({
                                part: ['snippet'],
                                requestBody: {
                                    id: shortId,
                                    snippet: { ...video.snippet, description: updatedDescription }
                                }
                            });
                            console.log(`   ✅ Short ${shortId} description updated!`);
                        } else {
                            console.log(`   ℹ️ Short ${shortId} description already contains long-form link.`);
                        }
                    }
                } catch (err: any) {
                    console.error(`   ⚠️ Could not update short ${shortId} via API:`, err.message);
                }
            }
        }

        // Layer 2: Open YouTube Studio with local Chrome profile or saved cookies
        console.log(`\n🤖 [Layer 2] Opening YouTube Studio to set native "Related video" button...`);
        const cookiePath = path.join(process.cwd(), 'youtube-cookies.json');
        let cookies: any[] | null = null;
        if (fs.existsSync(cookiePath)) {
            cookies = JSON.parse(fs.readFileSync(cookiePath, 'utf-8'));
        }

        // Default Chrome user data dir on Windows
        const localChromeUserData = path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');

        const launchOptions: any = {
            headless: false, // Visible so you can see it or intervene if 2FA is prompted
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };

        if (fs.existsSync(localChromeUserData) && !cookies) {
            console.log(`Using local Chrome user profile: ${localChromeUserData}`);
            launchOptions.userDataDir = localChromeUserData;
        }

        const browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setViewport({ width: 1400, height: 900 });

        if (cookies) {
            await page.setCookie(...cookies);
        }

        for (const shortId of shortYoutubeIds) {
            console.log(`\nNavigating to Studio editor for Short: ${shortId}...`);
            await page.goto(`https://studio.youtube.com/video/${shortId}/edit`, { waitUntil: 'networkidle2', timeout: 60000 });

            console.log(`Setting related video to: ${longFormYoutubeId}...`);
            try {
                // Wait for Related video selector
                const relatedBtn = await page.waitForSelector('#related-video-button, [aria-label*="Related video"]', { timeout: 15000 });
                if (relatedBtn) {
                    await relatedBtn.click();
                    await page.waitForSelector('ytcp-video-pick-dialog, [role="dialog"]', { timeout: 10000 });
                    await new Promise(r => setTimeout(r, 1000));

                    const searchInput = await page.$('ytcp-video-pick-dialog input, [role="dialog"] input');
                    if (searchInput) {
                        await searchInput.type(longFormYoutubeId, { delay: 50 });
                        await new Promise(r => setTimeout(r, 1500));
                    }

                    const videoRow = await page.waitForSelector('ytcp-video-pick-dialog ytcp-entity-card, [role="dialog"] ytcp-entity-card', { timeout: 10000 });
                    if (videoRow) {
                        await videoRow.click();
                        await new Promise(r => setTimeout(r, 1500));
                        const saveBtn = await page.$('#save-button:not([disabled])');
                        if (saveBtn) {
                            await saveBtn.click();
                            console.log(`✅ Successfully linked short ${shortId} to long-form video in YouTube Studio!`);
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }
                }
            } catch (err: any) {
                console.log(`⚠️ Note on short ${shortId}: ${err.message}. You can link manually in the open window.`);
            }
        }

        console.log(`\n🎉 Done! Closing browser in 5 seconds...`);
        await new Promise(r => setTimeout(r, 5000));
        await browser.close();

    } catch (e: any) {
        console.error('Error:', e.message || e);
    }
})();
