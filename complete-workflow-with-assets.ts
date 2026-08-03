#!/usr/bin/env npx tsx

import { renderScenes } from './workers/video-scene-renderer/src/index';
import { assembleVideo } from './workers/video-assembler/src/index';
import { uploadToYouTube } from './workers/youtube-upload/src/index';
import { validateConfig, config } from './shared/config';
import { getShortsPublishTimeByRank, getLongFormPublishTime } from './shared/services/shorts-publish-time-service';
import CloudinaryService from './shared/services/cloudinary-service';
import fs from 'fs/promises';
import path from 'path';

// Helper function to parse voiceover URLs from either a JSON file or comma-separated string
// Returns string[] for long-form, or string[] | string[][] for shorts (array of arrays)
async function parseVoiceoverUrls(urlsParam: string | undefined): Promise<string[] | string[][]> {
    if (!urlsParam) return [];

    try {
        const input = urlsParam.trim();

        // 1) Inline JSON array string, e.g. '["u1","u2"]' or '[[...],[...]]'
        if (input.startsWith('[')) {
            const parsed = JSON.parse(input);
            if (!Array.isArray(parsed)) {
                throw new Error('Expected JSON array of URLs');
            }
            return parsed;
        }

        // 2) Comma-separated URLs
        if (input.includes(',')) {
            return input.split(',').map(url => url.trim()).filter(url => url);
        }

        // 3) Single direct URL
        if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('file://')) {
            return [input];
        }

        // 4) Backward compatibility: local JSON file path
        try {
            await fs.access(input);
            const content = await fs.readFile(input, 'utf-8');
            const urls = JSON.parse(content);
            if (!Array.isArray(urls)) {
                throw new Error('Expected JSON array of URLs');
            }
            return urls;
        } catch {
            // 5) Fallback: treat as a single URL/value
            return [input];
        }
    } catch (error) {
        throw new Error(`Failed to parse voiceover URLs from "${urlsParam}": ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Helper function to parse rendered scene URLs from either a JSON file or comma-separated string
async function parseRenderedSceneUrls(urlsParam: string | undefined): Promise<string[]> {
    if (!urlsParam) return [];

    try {
        if (urlsParam.endsWith('.json')) {
            const content = await fs.readFile(urlsParam, 'utf-8');
            const urls = JSON.parse(content);
            if (!Array.isArray(urls)) {
                throw new Error('Expected JSON array of rendered scene URLs');
            }
            return urls;
        }

        return urlsParam.split(',').map(url => url.trim()).filter(url => url);
    } catch (error) {
        throw new Error(`Failed to parse rendered scene URLs from "${urlsParam}": ${error instanceof Error ? error.message : String(error)}`);
    }
}


interface ScriptData {
    script: {
        narration: string;
        title: string;
        description: string;
        tags?: string[];
        scenes: Array<{
            id: string;
            narration: string;
            sceneTitle?: string;
            baseDuration: number;
            holdDuration: number;
            actions: any[];
        }>;
        shorts: Array<{
            id: string;
            hook: string;
            scenes: Array<{
                id: string;
                narration: string;
                baseDuration: number;
                holdDuration: number;
                actions: any[];
            }>;
        }>;
    };
}

function getPublishTimeFromISTTime(timeIST: string, dayOffset: number = 0): string {
    const now = new Date();
    const [hours, minutes] = timeIST.split(':').map(Number);

    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;

    // Shift 'now' into IST context so date arithmetic is correct
    const istNow = new Date(now.getTime() + istOffset);

    // Set target time within IST context
    const targetIST = new Date(istNow);
    targetIST.setUTCHours(hours, minutes, 0, 0);
    targetIST.setUTCDate(targetIST.getUTCDate() + dayOffset);

    // Convert back to UTC for YouTube API
    return new Date(targetIST.getTime() - istOffset).toISOString();
}

async function main() {
    const args = process.argv.slice(2);
    const params: Record<string, string> = {};

    for (let i = 0; i < args.length; i++) {
        if (args[i].startsWith('--')) {
            const key = args[i].substring(2);
            const next = args[i + 1];
            if (next && !next.startsWith('--')) {
                // key has an explicit value
                params[key] = next;
                i++;
            } else {
                // boolean flag, record 'true'
                params[key] = 'true';
            }
        }
    }

    const videoId = params['video-id'];
    const scriptFile = params['script-file'];
    const voiceoverDir = params['voiceover-dir'];
    const voiceoverUrlsParam = params['voiceover-urls']; // JSON file or comma-separated URLs
    const shortVoiceoverDir = params['short-voiceover-dir']; // optional
    const shortVoiceoverUrlsParam = params['short-voiceover-urls']; // JSON file or comma-separated URLs per short
    const thumbnailUrl = params['thumbnail-url'];
    const renderedSceneUrlsParam = params['rendered-scene-urls']; // JSON file or comma-separated rendered scene URLs for long-form
    const longFormVideoUrlParam = params['long-form-video-url'] || params['main-video-url']; // final long-form URL; skip long-form generation

    // support both `--shorts-only` and `--short-only` for backward compatibility
    // treat the *presence* of the flag as enabling shortsOnly, regardless of
    // whether the shell accidentally attached a comment or value to it. this
    // makes the CLI more forgiving when users copy-paste the example and add
    // inline comments.
    let shortsOnly =
        Object.prototype.hasOwnProperty.call(params, 'shorts-only') ||
        Object.prototype.hasOwnProperty.call(params, 'short-only');

    // support --long-form-only to skip shorts generation
    const longFormOnly =
        Object.prototype.hasOwnProperty.call(params, 'long-form-only') ||
        Object.prototype.hasOwnProperty.call(params, 'longform-only');


    if (
        !videoId ||
        !scriptFile ||
        (!shortsOnly && !longFormVideoUrlParam && !voiceoverDir && !voiceoverUrlsParam)
    ) {
        console.error('❌ Missing required parameters:');
        console.error('  --video-id              (unique identifier)');
        console.error('  --script-file           (path to script.json)');
        console.error('  --voiceover-dir OR      (directory containing voiceover .wav/.mp3 files for long-form)');
        console.error('  --voiceover-urls        (direct URL input: single URL, comma-separated URLs, or JSON array string; local JSON file also supported)');
        console.error('  --long-form-video-url   (optional; final long-form video URL to upload directly; skips long-form voiceover/render/assembly)');
        console.error('  --thumbnail-url         (optional; Cloudinary URL of thumbnail image)');
        console.error('  --rendered-scene-urls   (optional; JSON file OR comma-separated pre-rendered scene URLs for long-form)');
        console.error('  --short-voiceover-dir OR (optional; root dir containing subfolders for each short)');
        console.error('  --short-voiceover-urls   (optional; JSON file with voiceover URLs per short)');
        console.error('      if omitted, first scene (hook) will be silent and subsequent scenes reuse long-form audio when IDs match');
        console.error('  --shorts-only            (optional flag; skip long form generation)');
        console.error('  --long-form-only         (optional flag; skip shorts generation)');
        console.error('');
        console.error('💡 Tip: do not append shell comments (#) on the same line as a flag.');
        console.error('       a stray comment may be interpreted as the flag value, e.g.');
        console.error('         --short-only \ # comment');
        console.error('       which converts to params["short-only"]="#" and disables');
        console.error('       shorts-only mode. put comments on separate lines or remove them.');
        console.error('');
        console.error('📌 Voiceovers can be supplied as either local files (--voiceover-dir) or direct URLs (--voiceover-urls).');
        console.error('📌 If --rendered-scene-urls is provided, long-form scene rendering is skipped and assembly starts directly from those scene URLs.');
        console.error('📌 If --long-form-video-url is provided, long-form generation is skipped and upload starts directly from that URL.');
        console.error('Example 1 (with local files):');
        console.error('  npx tsx complete-workflow-with-assets.ts \\');
        console.error('    --video-id "my-video" \\');
        console.error('    --script-file "./script.json" \\');
        console.error('    --voiceover-dir "./voiceovers" \\');
        console.error('    # --thumbnail-url "https://res.cloudinary.com/..."  # optional \\');
        console.error('    --short-voiceover-dir "./short-voiceovers"  # optional');
        console.error('');
        console.error('Example 1b (skip render, assemble from pre-rendered scene URLs):');
        console.error('  npx tsx complete-workflow-with-assets.ts \\');
        console.error('    --video-id "my-video" \\');
        console.error('    --script-file "./script.json" \\');
        console.error('    --voiceover-urls "./voiceover-urls.json" \\');
        console.error('    --rendered-scene-urls "./rendered-scene-urls.json" \\');
        console.error('    # --thumbnail-url "https://res.cloudinary.com/..."  # optional');
        console.error('');
        console.error('Example 2 (with voiceover URLs directly):');
        console.error('  npx tsx complete-workflow-with-assets.ts \\');
        console.error('    --video-id "my-video" \\');
        console.error('    --script-file "./script.json" \\');
        console.error('    --voiceover-urls "https://example.com/voiceover-1.mp3,https://example.com/voiceover-2.mp3" \\');
        console.error('    # --thumbnail-url "https://res.cloudinary.com/..."  # optional');
        console.error('');
        console.error('Example 3 (direct upload using prebuilt long-form video URL):');
        console.error('  npx tsx complete-workflow-with-assets.ts \\');
        console.error('    --video-id "my-video" \\');
        console.error('    --script-file "./script.json" \\');
        console.error('    --long-form-video-url "https://res.cloudinary.com/.../main-video.mp4"');
        console.error('');
        console.error('Voiceover URLs JSON array format (also accepted inline):');
        console.error('  [');
        console.error('    "https://example.com/voiceover-1.mp3",');
        console.error('    "https://example.com/voiceover-2.mp3"');
        console.error('  ]');
        process.exit(1);
    }

    try {
        validateConfig(['cloudinary', 'youtube']);

        // Load script - handle both { script: {...} } and direct format
        const scriptContent = await fs.readFile(scriptFile, 'utf-8');
        const rawScript = JSON.parse(scriptContent);
        // Normalize: if script has a "script" wrapper, use it; otherwise wrap it
        const script: ScriptData = rawScript.script ? rawScript : { script: rawScript };

        const title = script.script.title;
        const description = script.script.description;
        const tags = script.script.tags || [];
        const shorts = script.script.shorts || [];

        // automatically enable shorts-only when no long-form inputs are provided
        if (!shortsOnly && shorts.length > 0 && !longFormVideoUrlParam && !voiceoverDir && !thumbnailUrl) {
            console.warn('⚠️  No long-form assets provided; automatically enabling shorts-only');
            shortsOnly = true;
        }

        console.log('\n🎬 Starting workflow...');
        console.log(`📝 Video: ${title}`);
        console.log(`📂 Script: ${scriptFile}`);
        if (voiceoverDir) console.log(`🎤 Voiceovers (files): ${voiceoverDir}`);
        if (voiceoverUrlsParam) console.log(`🎤 Voiceovers (URLs): ${voiceoverUrlsParam}`);
        if (longFormVideoUrlParam) console.log(`🎞️  Prebuilt long-form video: ${longFormVideoUrlParam}`);
        if (renderedSceneUrlsParam) console.log(`🎞️  Pre-rendered long-form scenes: ${renderedSceneUrlsParam}`);
        if (shortVoiceoverDir) console.log(`🎤 Shorts voiceovers dir: ${shortVoiceoverDir}`);
        if (shortVoiceoverUrlsParam) console.log(`🎤 Shorts voiceovers URLs: ${shortVoiceoverUrlsParam}`);
        console.log(`🎨 Thumbnail: ${thumbnailUrl}`);
        console.log(`✅ Loaded script with ${script.script.scenes.length} scenes and ${shorts.length} shorts`);

        const cloudinaryService = CloudinaryService.getInstance();
        // variables for potential long-form results
        let assembled: any | null = null;
        let longFormUrl = '';
        // map sceneId -> voiceover URL from long-form
        const voiceoverMap: Record<string, string> = {};


        let voiceoverUrls: string[] = [];
        if (!longFormVideoUrlParam) {
            // ===== LONG-FORM ASSETS =====
            // load & upload voiceovers (if provided) so they can be reused by shorts
            console.log('\n════════════════════════════════════════');
            console.log('🎤 LONG-FORM VOICEOVER SETUP');
            console.log('════════════════════════════════════════');

            if (voiceoverUrlsParam) {
                // Load voiceover URLs (expect flat array for long-form)
                voiceoverUrls = await parseVoiceoverUrls(voiceoverUrlsParam) as string[];

                if (voiceoverUrls.length !== script.script.scenes.length) {
                    throw new Error(
                        `Mismatch: ${voiceoverUrls.length} voiceover URLs but ${script.script.scenes.length} scenes`
                    );
                }
                console.log(`✅ Loaded ${voiceoverUrls.length} voiceover URLs`);

                // Build voiceover map from URLs
                for (let i = 0; i < voiceoverUrls.length; i++) {
                    const sceneId = script.script.scenes[i]?.id || `scene_${i}`;
                    voiceoverMap[sceneId] = voiceoverUrls[i];
                }
            } else if (voiceoverDir) {
                // Load voiceover files
                const voiceoverFiles = await fs.readdir(voiceoverDir);
                const voiceoverPaths = voiceoverFiles
                    .filter(f => f.endsWith('.wav') || f.endsWith('.mp3'))
                    .sort()
                    .map(f => path.join(voiceoverDir, f));

                if (voiceoverPaths.length !== script.script.scenes.length) {
                    throw new Error(
                        `Mismatch: ${voiceoverPaths.length} voiceover files but ${script.script.scenes.length} scenes`
                    );
                }
                console.log(`✅ Loaded ${voiceoverPaths.length} voiceover files`);

                console.log('\n📤 Uploading voiceovers to Cloudinary...');
                for (let i = 0; i < voiceoverPaths.length; i++) {
                    const upload = await cloudinaryService.uploadVideo(
                        voiceoverPaths[i],
                        `${videoId}/voiceovers`,
                        `voiceover_${i}`
                    );
                    const url = upload.secureUrl;
                    voiceoverUrls.push(url);
                    const sceneId = script.script.scenes[i]?.id || `scene_${i}`;
                    voiceoverMap[sceneId] = url;
                }
                console.log(`✅ Uploaded ${voiceoverUrls.length} voiceovers`);
            } else {
                console.log('⚠️  no long-form voiceover directory or URLs specified; shorts will not reuse any audio');
            }
        } else {
            console.log('\n⏩ --long-form-video-url provided; skipping long-form voiceover setup');
        }

        if (thumbnailUrl) {
            console.log('\n🎨 Using provided thumbnail URL');
            console.log('✅ Thumbnail ready');
        } else {
            console.log('\n🎨 No thumbnail URL provided; YouTube will keep default thumbnail');
        }

        // optionally render/assemble long form
        let renderResult: any;
        if (!shortsOnly) {
            console.log('\n📺 LONG-FORM VIDEO GENERATION');
            if (longFormVideoUrlParam) {
                console.log('\n⏩ Skipping long-form rendering and assembly; using provided main video URL');
            } else {
                if (renderedSceneUrlsParam) {
                    const renderedSceneUrls = await parseRenderedSceneUrls(renderedSceneUrlsParam);
                    if (renderedSceneUrls.length !== script.script.scenes.length) {
                        throw new Error(
                            `Mismatch: ${renderedSceneUrls.length} rendered scene URLs but ${script.script.scenes.length} scenes`
                        );
                    }
                    renderResult = {
                        urls: renderedSceneUrls,
                        timings: undefined,
                        animationStopTimes: undefined,
                    };
                    console.log(`\n⏩ Skipping rendering; using ${renderedSceneUrls.length} pre-rendered scenes`);
                } else {
                    // Render long-form scenes
                    console.log('\n🎬 Rendering scenes...');
                    renderResult = await renderScenes({
                        scenes: script.script.scenes,
                        videoId,
                        isShort: false,
                    });
                    console.log(`✅ Rendered ${renderResult.urls.length} scenes`);
                }

                console.log('\n🧩 Assembling video...');
                assembled = await assembleVideo({
                    jobId: videoId,
                    videoId,
                    narration: script.script.narration,
                    perSceneNarration: script.script.scenes.map(s => s.narration),
                    narrationAudios: voiceoverUrls,
                    clips: renderResult.urls,
                    clipTimings: renderResult.timings,
                    animationStopTimes: renderResult.animationStopTimes,
                    perSceneSoundEvents: renderResult.perSceneSoundEvents,
                    isShort: false,
                    voiceoverProvider: config.voiceover.provider,
                });
                console.log(`✅ Video assembled: ${assembled.duration}s`);
            }
        } else {
            console.log('⚠️  short-only mode: skipping long-form generation');
        }

        if (!shortsOnly) {
            // Upload long-form to YouTube (scheduled)
            console.log('\n📤 Uploading long-form to YouTube...');
            const longFormTime = await getLongFormPublishTime();
            const longFormScheduledTime = getPublishTimeFromISTTime(longFormTime, 0);
            console.log(`📅 Scheduling long-form for ${longFormTime} IST (${longFormScheduledTime})`);
            const sceneTitles = script.script.scenes.map(s => s.sceneTitle || 'Scene');
            const youtube = await uploadToYouTube({
                videoUrl: longFormVideoUrlParam || assembled!.outputUrl,
                isShort: false,
                title,
                description,
                tags,
                thumbnailUrl,
                privacyStatus: 'private', // Required for scheduled publishing
                scheduledPublishTime: longFormScheduledTime,
                sceneTitles,
                sceneDurations: assembled?.sceneDurations,
                hasIntro: true,
                introDuration: 8,
                introTitle: 'Intro',
                hasOutro: true,
                outroDuration: 8,
                outroTitle: 'Outro',
            });

            longFormUrl = `https://youtube.com/watch?v=${youtube.videoId}`;
            console.log(`✅ Long-form uploaded to YouTube: ${longFormUrl}`);
        } else {
            console.log('⚠️  short-only mode: skipping YouTube upload for long-form');
        }

        // ===== SHORTS GENERATION =====
        if (shorts.length > 0 && !longFormOnly) {
            console.log('\n════════════════════════════════════════');
            console.log(`📱 SHORTS GENERATION (${shorts.length} shorts)`);
            console.log('════════════════════════════════════════');

            const shortResults = [];

            for (let i = 0; i < shorts.length; i++) {
                const short = shorts[i];
                const shortId = `${videoId}-short-${i}`;

                console.log(`\n📱 Processing short ${i + 1}/${shorts.length}: ${short.hook || '(no hook)'}`);

                // Derive title: use hook field if present, otherwise fall back to first scene narration or shortId
                const shortTitle = short.hook
                    || short.scenes.find(s => s.narration)?.narration.slice(0, 60)
                    || shortId;

                const isAiRender = config.sceneRendering.method === 'ai';

                if (!isAiRender) {
                    // Validate first scene is hook scene
                    const hookScene = short.scenes[0];
                    if (!hookScene || hookScene.id !== 'hook') {
                        throw new Error(`Short ${i} must have first scene as hook (id='hook')`);
                    }
                }

                // 1. Render short scenes
                console.log(`  🎬 Rendering ${short.scenes.length} scenes...`);
                const shortRenderResult = await renderScenes({
                    scenes: short.scenes,
                    isShort: true,
                    videoId: shortId,
                });

                // 2. Voice-overs for short can be provided via --short-voiceover-urls, --short-voiceover-dir, or long-form reuse
                console.log(`  🎤 Preparing voice-overs for short ${i + 1}...`);
                let shortVoiceoverUrls: string[];

                if (shortVoiceoverUrlsParam) {
                    // Load voiceover URLs from JSON file with per-short URLs
                    const shortUrlsArray = await parseVoiceoverUrls(shortVoiceoverUrlsParam);
                    // Expect an array of arrays: [[urls for short 0], [urls for short 1], ...]
                    if (!Array.isArray(shortUrlsArray[0])) {
                        // If it's a single array, treat it as URLs for the first short only
                        const flatUrls = shortUrlsArray as string[];
                        shortVoiceoverUrls = new Array(short.scenes.length).fill('');
                        if (i === 0) {
                            if (isAiRender) {
                                for (let j = 0; j < flatUrls.length && j < short.scenes.length; j++) {
                                    shortVoiceoverUrls[j] = flatUrls[j];
                                }
                            } else {
                                for (let j = 0; j < flatUrls.length && j < short.scenes.length - 1; j++) {
                                    shortVoiceoverUrls[j + 1] = flatUrls[j];
                                }
                            }
                        }
                    } else {
                        // It's an array of arrays
                        const shortsUrls = shortUrlsArray as string[][];
                        shortVoiceoverUrls = new Array(short.scenes.length).fill('');
                        if (shortsUrls[i]) {
                            const urls = shortsUrls[i];
                            if (isAiRender) {
                                for (let j = 0; j < urls.length && j < short.scenes.length; j++) {
                                    shortVoiceoverUrls[j] = urls[j];
                                }
                            } else {
                                for (let j = 0; j < urls.length && j < short.scenes.length - 1; j++) {
                                    shortVoiceoverUrls[j + 1] = urls[j];
                                }
                            }
                        }
                    }
                    console.log(`  ✅ Using ${shortVoiceoverUrls.filter(u => u).length} voiceover URLs`);
                } else if (shortVoiceoverDir) {
                    // Try a set of likely folder names so users can provide either
                    // `short-0`, `short-1`, or the short's `id` (e.g. `short-1`)
                    const candidates = [
                        path.join(shortVoiceoverDir, `short-${i}`),
                        path.join(shortVoiceoverDir, short.id),
                        path.join(shortVoiceoverDir, `short-${i + 1}`),
                    ];

                    let files: string[] = [];
                    let usedDir: string | null = null;
                    for (const c of candidates) {
                        try {
                            const listing = await fs.readdir(c);
                            files = listing;
                            usedDir = c;
                            break;
                        } catch (e) {
                            // ignore and try next candidate
                        }
                    }

                    if (!usedDir) {
                        console.warn(`  ⚠️  No short voiceover directory found for short ${i}. Tried: ${candidates.join(', ')}`);
                        files = [];
                    }

                    const filtered = files.filter(f => f.endsWith('.wav') || f.endsWith('.mp3')).sort();

                    const expected = isAiRender ? short.scenes.length : Math.max(0, short.scenes.length - 1);
                    if (filtered.length > expected) {
                        console.warn(
                            `  ⚠️  More voiceover files (${filtered.length}) than content scenes (${expected}) for short ${i}`
                        );
                    }

                    // Strict mode: when a shorts dir is provided, only use those
                    // files for this short. Do NOT fall back to long-form audio.
                    shortVoiceoverUrls = new Array(short.scenes.length).fill('');
                    for (let j = 0; j < filtered.length && j < expected; j++) {
                        const p = path.join(usedDir || path.join(shortVoiceoverDir, `short-${i}`), filtered[j]);
                        const upload = await cloudinaryService.uploadVideo(
                            p,
                            `${shortId}/voiceovers`,
                            isAiRender ? `voiceover_${j}` : `voiceover_${j + 1}`
                        );
                        if (isAiRender) {
                            shortVoiceoverUrls[j] = upload.secureUrl;
                        } else {
                            shortVoiceoverUrls[j + 1] = upload.secureUrl;
                        }
                    }
                    console.log(`  ✅ Uploaded ${filtered.length} provided voiceovers${isAiRender ? '' : ' (hook omitted)'}`);
                } else {
                    // no directory or URLs supplied: reuse long-form audio for content scenes
                    shortVoiceoverUrls = new Array(short.scenes.length).fill('');
                    const startIdx = isAiRender ? 0 : 1;
                    for (let j = startIdx; j < short.scenes.length; j++) {
                        const sceneId = short.scenes[j].id;
                        const longFormByIndex = (voiceoverUrls && voiceoverUrls[isAiRender ? j : j - 1]) || '';
                        if (longFormByIndex) {
                            shortVoiceoverUrls[j] = longFormByIndex;
                        } else if (voiceoverMap[sceneId]) {
                            shortVoiceoverUrls[j] = voiceoverMap[sceneId];
                        } else {
                            // leave empty => silence for this scene
                            shortVoiceoverUrls[j] = '';
                        }
                    }
                    console.log(`  ⚠️  No short-voiceover URLs or directory; reused long-form audio by index or scene id where available`);
                }

                // 3. Assemble short
                console.log(`  🧩 Assembling short...`);
                const shortContentScenes = isAiRender ? short.scenes : short.scenes.slice(1); // Skip hook if not AI
                const shortContentNarrations = shortContentScenes.map(s => s.narration);
                const shortFullNarration = shortContentNarrations.join(' ');

                const assembledShort = await assembleVideo({
                    jobId: shortId,
                    videoId: shortId,
                    narration: shortFullNarration,
                    perSceneNarration: short.scenes.map(s => s.narration),
                    narrationAudios: shortVoiceoverUrls,
                    clips: shortRenderResult.urls,
                    clipTimings: shortRenderResult.timings,
                    animationStopTimes: shortRenderResult.animationStopTimes,
                    perSceneSoundEvents: shortRenderResult.perSceneSoundEvents,
                    isShort: true,
                    voiceoverProvider: config.voiceover.provider,
                });

                // 4. Upload short to YouTube
                console.log(`  📤 Uploading to YouTube...`);
                const shortsRank = Math.min(i, 4); // Cap at rank 4 (5 slots)
                const shortsTime = await getShortsPublishTimeByRank(shortsRank);
                const scheduledPublishTime = getPublishTimeFromISTTime(shortsTime, 0);

                const shortYoutube = await uploadToYouTube({
                    videoUrl: assembledShort.outputUrl,
                    isShort: true,
                    title: shortTitle,
                    description,
                    tags,
                    privacyStatus: 'private', // Required for scheduled publishing
                    scheduledPublishTime,
                });

                const shortUrl = `https://youtube.com/watch?v=${shortYoutube.videoId}`;
                console.log(`  ✅ Short ${i + 1} uploaded (Rank ${shortsRank + 1}): ${shortUrl}`);

                shortResults.push({
                    shortId,
                    youtubeId: shortYoutube.videoId,
                    hook: short.hook,
                    publishTime: shortsTime,
                    url: shortUrl,
                });
            }

            console.log('\n✅ All shorts completed!');
            shortResults.forEach((sr, idx) => {
                console.log(`  Short ${idx + 1}: ${sr.url}`);
            });
        } else if (longFormOnly && shorts.length > 0) {
            console.log(`\n⚠️  long-form-only mode: skipping ${shorts.length} shorts`);
        }

        console.log('\n✨ Workflow complete!');
        console.log(JSON.stringify({
            videoId,
            longFormUrl: longFormUrl || undefined,
            shortsCount: longFormOnly ? 0 : shorts.length,
            duration: assembled ? assembled.duration : undefined,
        }, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
