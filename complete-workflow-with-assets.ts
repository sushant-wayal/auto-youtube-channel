#!/usr/bin/env npx tsx

import { renderScenes } from './workers/video-scene-renderer/src/index';
import { assembleVideo } from './workers/video-assembler/src/index';
import { uploadToYouTube } from './workers/youtube-upload/src/index';
import { validateConfig } from './shared/config';
import { getShortsPublishTimeByRank, getLongFormPublishTime } from './shared/services/shorts-publish-time-service';
import CloudinaryService from './shared/services/cloudinary-service';
import fs from 'fs/promises';
import path from 'path';


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
    const shortVoiceoverDir = params['short-voiceover-dir']; // optional
    const thumbnailUrl = params['thumbnail-url'];

    // support both `--shorts-only` and `--short-only` for backward compatibility
    // treat the *presence* of the flag as enabling shortsOnly, regardless of
    // whether the shell accidentally attached a comment or value to it. this
    // makes the CLI more forgiving when users copy-paste the example and add
    // inline comments.
    let shortsOnly =
        Object.prototype.hasOwnProperty.call(params, 'shorts-only') ||
        Object.prototype.hasOwnProperty.call(params, 'short-only');


    if (
        !videoId ||
        !scriptFile ||
        (!shortsOnly && !voiceoverDir) ||
        (!shortsOnly && !thumbnailUrl)
    ) {
        console.error('❌ Missing required parameters:');
        console.error('  --video-id          (unique identifier)');
        console.error('  --script-file       (path to script.json)');
        console.error('  --voiceover-dir     (directory containing voiceover .wav/.mp3 files for long-form)');
        console.error('  --thumbnail-url     (Cloudinary URL of thumbnail image)');
        console.error('  --short-voiceover-dir (optional; root dir containing subfolders for each short)');
        console.error('      if omitted, first scene (hook) will be silent and subsequent scenes reuse long-form audio when IDs match');
        console.error('  --shorts-only        (optional flag; skip long form generation)');
        console.error('');
        console.error('💡 Tip: do not append shell comments (#) on the same line as a flag.');
        console.error('       a stray comment may be interpreted as the flag value, e.g.');
        console.error('         --short-only \ # comment');
        console.error('       which converts to params["short-only"]="#" and disables');
        console.error('       shorts-only mode. put comments on separate lines or remove them.');
        console.error('');
        console.error('📌 Voiceovers are never generated; you must supply them ahead of time.');
        console.error('Example:');
        console.error('  npx tsx complete-workflow-with-assets.ts \\');
        console.error('    --video-id "my-video" \\');
        console.error('    --script-file "./script.json" \\');
        console.error('    --voiceover-dir "./voiceovers" \\');
        console.error('    --thumbnail-url "https://res.cloudinary.com/..." \\');
        console.error('    --short-voiceover-dir "./short-voiceovers"  # optional; hook auto-silent, content may reuse long-form');
        console.error('    --shorts-only                    # run only shorts');
        process.exit(1);
    }

    try {
        validateConfig(['cloudinary', 'youtube']);

        // Load script
        const scriptContent = await fs.readFile(scriptFile, 'utf-8');
        const script: ScriptData = JSON.parse(scriptContent);

        const title = script.script.title;
        const description = script.script.description;
        const tags = script.script.tags || [];
        const shorts = script.script.shorts || [];

        // automatically enable shorts-only when no long-form voiceovers/thumb provided
        if (!shortsOnly && shorts.length > 0 && !voiceoverDir && !thumbnailUrl) {
            console.warn('⚠️  No long-form assets provided; automatically enabling shorts-only');
            shortsOnly = true;
        }

        console.log('\n🎬 Starting workflow...');
        console.log(`📝 Video: ${title}`);
        console.log(`📂 Script: ${scriptFile}`);
        console.log(`🎤 Voiceovers: ${voiceoverDir}`);
        if (shortVoiceoverDir) console.log(`🎤 Shorts voiceovers dir: ${shortVoiceoverDir}`);
        console.log(`🎨 Thumbnail: ${thumbnailUrl}`);
        console.log(`✅ Loaded script with ${script.script.scenes.length} scenes and ${shorts.length} shorts`);

        const cloudinaryService = CloudinaryService.getInstance();
        // variables for potential long-form results
        let assembled: any | null = null;
        let longFormUrl = '';
        // map sceneId -> voiceover URL from long-form
        const voiceoverMap: Record<string, string> = {};


        // ===== LONG-FORM ASSETS =====
        // load & upload voiceovers (if provided) so they can be reused by shorts
        console.log('\n════════════════════════════════════════');
        console.log('🎤 LONG-FORM VOICEOVER SETUP');
        console.log('════════════════════════════════════════');

        let voiceoverUrls: string[] = [];
        if (voiceoverDir) {
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
            console.log('⚠️  no long-form voiceover directory specified; shorts will not reuse any audio');
        }

        // Use provided Cloudinary thumbnail URL
        console.log('\n🎨 Using provided thumbnail URL');
        console.log(`✅ Thumbnail ready`);

        // optionally render/assemble long form
        let renderResult: any;
        if (!shortsOnly) {
            console.log('\n📺 LONG-FORM VIDEO GENERATION');
            // Render long-form scenes
            console.log('\n🎬 Rendering scenes...');
            renderResult = await renderScenes({
                scenes: script.script.scenes,
                videoId,
                isShort: false,
            });
            console.log(`✅ Rendered ${renderResult.urls.length} scenes`);

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
                isShort: false,
            });
            console.log(`✅ Video assembled: ${assembled.duration}s`);
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
                videoUrl: assembled!.outputUrl,
                isShort: false,
                title,
                description,
                tags,
                thumbnailUrl,
                privacyStatus: 'private', // Required for scheduled publishing
                scheduledPublishTime: longFormScheduledTime,
                sceneTitles,
                sceneDurations: assembled!.sceneDurations,
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
        if (shorts.length > 0) {
            console.log('\n════════════════════════════════════════');
            console.log(`📱 SHORTS GENERATION (${shorts.length} shorts)`);
            console.log('════════════════════════════════════════');

            const shortResults = [];

            for (let i = 0; i < shorts.length; i++) {
                const short = shorts[i];
                const shortId = `${videoId}-short-${i}`;

                console.log(`\n📱 Processing short ${i + 1}/${shorts.length}: ${short.hook}`);

                // Validate first scene is hook scene
                const hookScene = short.scenes[0];
                if (!hookScene || hookScene.id !== 'hook') {
                    throw new Error(`Short ${i} must have first scene as hook (id='hook')`);
                }

                // 1. Render short scenes
                console.log(`  🎬 Rendering ${short.scenes.length} scenes...`);
                const shortRenderResult = await renderScenes({
                    scenes: short.scenes,
                    isShort: true,
                    videoId: shortId,
                });

                // 2. Voice-overs for short must be provided via --short-voiceover-dir
                console.log(`  🎤 Preparing voice-overs for short ${i + 1}...`);
                let shortVoiceoverUrls: string[];

                if (shortVoiceoverDir) {
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

                    const expected = Math.max(0, short.scenes.length - 1);
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
                            `voiceover_${j + 1}` // offset by one because hook slot is empty
                        );
                        shortVoiceoverUrls[j + 1] = upload.secureUrl;
                    }
                    console.log(`  ✅ Uploaded ${filtered.length} provided voiceovers (hook omitted)`);
                } else {
                    // no directory supplied: reuse long-form audio for content scenes
                    // Behavior:
                    //  - index-first: try to reuse the long-form voiceover at the
                    //    same position (skip hook), i.e. voiceoverUrls[j-1]
                    //  - fallback: if index missing, try to map by scene id
                    //  - hook (index 0) remains silent
                    shortVoiceoverUrls = new Array(short.scenes.length).fill('');
                    for (let j = 1; j < short.scenes.length; j++) {
                        const sceneId = short.scenes[j].id;
                        const longFormByIndex = (voiceoverUrls && voiceoverUrls[j - 1]) || '';
                        if (longFormByIndex) {
                            shortVoiceoverUrls[j] = longFormByIndex;
                        } else if (voiceoverMap[sceneId]) {
                            shortVoiceoverUrls[j] = voiceoverMap[sceneId];
                        } else {
                            // leave empty => silence for this scene
                            shortVoiceoverUrls[j] = '';
                        }
                    }
                    console.log(`  ⚠️  No short-voiceover-dir; reused long-form audio by index or scene id where available`);
                }

                // 3. Assemble short
                console.log(`  🧩 Assembling short...`);
                const shortContentScenes = short.scenes.slice(1); // Skip hook
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
                    isShort: true,
                });

                // 4. Upload short to YouTube
                console.log(`  📤 Uploading to YouTube...`);
                const shortsRank = Math.min(i, 4); // Cap at rank 4 (5 slots)
                const shortsTime = await getShortsPublishTimeByRank(shortsRank);
                const scheduledPublishTime = getPublishTimeFromISTTime(shortsTime, 0);

                const shortYoutube = await uploadToYouTube({
                    videoUrl: assembledShort.outputUrl,
                    isShort: true,
                    title: short.hook,
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
        }

        console.log('\n✨ Workflow complete!');
        console.log(JSON.stringify({
            videoId,
            longFormUrl: longFormUrl || undefined,
            shortsCount: shorts.length,
            duration: assembled ? assembled.duration : undefined,
        }, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();
