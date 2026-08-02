#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { google } from 'googleapis';
import { HtmlToVideoService } from './workers/video-scene-renderer/src/lib/scene-rendring/htmlToVideoService';
import VideoAssemblyService from './workers/video-assembler/src/lib/video/video-assembly';
import { getVideoDuration } from './workers/video-assembler/src/lib/video/ffmpeg-utils';
import { validateConfig } from './shared/config';
import { generateTimestamps, canGenerateTimestamps } from './workers/youtube-upload/src/utils/timestamp-generator';
import { formatYouTubeTitle } from './shared/utils/title-formatter';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

type PrivacyStatus = 'public' | 'unlisted' | 'private';
type CliParams = Record<string, string | boolean>;
type ParsedArgs = {
  params: CliParams;
  positional: string[];
};
type ScriptMetadata = {
  videoId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  sceneTitles?: string[];
  perSceneNarration?: string[];
};

function parseArgs(args: string[]): ParsedArgs {
  const params: CliParams = {};
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      params[key] = next;
      i++;
    } else {
      params[key] = true;
    }
  }

  return { params, positional };
}

function asString(params: CliParams, key: string, fallback = ''): string {
  const value = params[key];
  return typeof value === 'string' ? value : fallback;
}

function hasFlag(params: CliParams, key: string): boolean {
  return params[key] === true || params[key] === 'true';
}

function printUsage(): void {
  console.error(`
Usage:
  npx tsx assemble-local-assets-and-publish.ts \\
    --scene-dir ./docs/video-documentation/visuals/html \\
    --audio-dir ./docs/video-documentation/audios \\
    --thumbnail ./thumbnail.jpg \\
    --script-file ./script-generation-output.json

Required:
  --scene-dir      Directory containing scene HTML files.
  --audio-dir      Directory containing matching voiceover files. (OR --audio-url)
  --audio-url      Comma-separated URLs to audio narration files.
  --thumbnail      Local thumbnail image path for the long-form video. (OR --thumbnail-url)
  --thumbnail-url  URL to the thumbnail image.
  --title          YouTube title, unless provided by --script-file.

Optional:
  --script-file    Existing script-generation JSON. Markdown docs are also accepted.
  --description    YouTube description. Defaults to empty.
  --tags           Comma-separated YouTube tags.
  --video-id       Local output id. Defaults to local-video-<timestamp>.
  --output-dir     Local output root. Defaults to ./videos/local-runs.
  --privacy        public, unlisted, or private. Defaults to private.
  --publish-at     ISO timestamp for scheduled publishing. Forces privacy=private.
  --music          Optional background music file.
  --intro          Optional intro MP4.
  --outro          Optional outro MP4.
  --logo           Optional logo image.
  --width          Render width. Defaults to 1920.
  --height         Render height. Defaults to 1080.
  --fps            Render fps. Defaults to 30.
  --skip-upload    Render and assemble only; do not publish to YouTube.
`);
}

async function listFiles(dir: string, extensions: string[]): Promise<string[]> {
  const entries = await fsPromises.readdir(dir);
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  return entries
    .filter(file => extensions.includes(path.extname(file).toLowerCase()))
    .sort((a, b) => collator.compare(a, b))
    .map(file => path.resolve(dir, file));
}

async function assertFile(filePath: string, label: string): Promise<void> {
  try {
    const stats = await fsPromises.stat(filePath);
    if (!stats.isFile()) throw new Error();
  } catch {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

async function assertDir(dirPath: string, label: string): Promise<void> {
  try {
    const stats = await fsPromises.stat(dirPath);
    if (!stats.isDirectory()) throw new Error();
  } catch {
    throw new Error(`${label} not found: ${dirPath}`);
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function loadScriptMetadata(scriptFile: string): Promise<ScriptMetadata> {
  const resolved = path.resolve(scriptFile);
  const content = await fsPromises.readFile(resolved, 'utf-8');
  const ext = path.extname(resolved).toLowerCase();

  if (ext === '.json') {
    const raw = JSON.parse(content);
    const script = raw.script || raw;
    return {
      videoId: raw.videoId || script.videoId,
      title: script.title,
      description: script.description,
      tags: Array.isArray(script.tags) ? script.tags : undefined,
      sceneTitles: Array.isArray(script.scenes)
        ? script.scenes.map((scene: any, index: number) => scene.sceneTitle || scene.title || `Scene ${index + 1}`)
        : undefined,
      perSceneNarration: Array.isArray(script.scenes)
        ? script.scenes.map((scene: any) => scene.narration || '')
        : undefined,
    };
  }

  return parseMarkdownScript(content);
}

function parseMarkdownScript(content: string): ScriptMetadata {
  const sections: Record<string, string> = {};
  const headingPattern = /^#\s+([A-Z0-9_ -]+)\s*$/gm;
  const matches = [...content.matchAll(headingPattern)];

  for (let i = 0; i < matches.length; i++) {
    const heading = matches[i][1].trim().replace(/\s+/g, '_').toUpperCase();
    const start = (matches[i].index || 0) + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index || content.length : content.length;
    sections[heading] = content.slice(start, end).trim();
  }

  const structure = sections.VIDEO_STRUCTURE || '';
  const sceneTitles = structure
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^\d{1,2}:\d{2}(?::\d{2})?\s+/, '').trim())
    .filter(Boolean);

  const narration = sections.NARRATION_SCRIPT || '';
  const perSceneNarration = narration.split(/(?:^|\r?\n)\s*\d+\.\s*(?:\r?\n|$)/)
    .map(block => block.trim())
    .filter(Boolean);

  return {
    title: sections.VIDEO_TITLE,
    description: sections.VIDEO_DESCRIPTION,
    sceneTitles: sceneTitles.length > 0 ? sceneTitles : undefined,
    perSceneNarration: perSceneNarration.length > 0 ? perSceneNarration : undefined,
  };
}

async function uploadLocalVideoToYouTube({
  videoPath,
  thumbnailPath,
  title,
  description,
  tags,
  privacyStatus,
  scheduledPublishTime,
}: {
  videoPath: string;
  thumbnailPath?: string;
  title: string;
  description: string;
  tags: string[];
  privacyStatus: PrivacyStatus;
  scheduledPublishTime?: string;
}): Promise<string> {
  validateConfig(['youtube']);

  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YT_REFRESH_TOKEN,
  });

  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });

  const status: Record<string, string | boolean> = {
    privacyStatus,
    selfDeclaredMadeForKids: false,
  };

  if (scheduledPublishTime) {
    status.privacyStatus = 'private';
    status.publishAt = scheduledPublishTime;
  }

  const safeTitle = formatYouTubeTitle(title, 100);
  if (title && title.length > 100) {
    console.warn(`⚠️ Warning: Video title (${title.length} chars) exceeded YouTube's 100-character limit! Truncated to: "${safeTitle}" (${safeTitle.length} chars).`);
  }

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: safeTitle,
        description,
        tags,
        categoryId: '28',
      },
      status,
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const youtubeId = response.data.id;
  if (!youtubeId) {
    throw new Error('YouTube upload completed without returning a video id');
  }

  if (thumbnailPath) {
    await youtube.thumbnails.set({
      videoId: youtubeId,
      media: {
        mimeType: getMimeType(thumbnailPath),
        body: fs.createReadStream(thumbnailPath),
      },
    });
  }

  return youtubeId;
}

async function main(): Promise<void> {
  const { params, positional } = parseArgs(process.argv.slice(2));
  applyPositionalFallbacks(params, positional);

  const sceneDirParam = asString(params, 'scene-dir');
  const audioDirParam = asString(params, 'audio-dir');
  const audioUrlParam = asString(params, 'audio-url');
  const thumbnailParam = asString(params, 'thumbnail');
  const thumbnailUrlParam = asString(params, 'thumbnail-url');
  const scriptFile = asString(params, 'script-file');
  const scriptMetadata = scriptFile ? await loadScriptMetadata(scriptFile) : {};
  const title = asString(params, 'title', scriptMetadata.title || '');

  if (!sceneDirParam || (!audioDirParam && !audioUrlParam) || (!thumbnailParam && !thumbnailUrlParam) || !title) {
    printUsage();
    process.exit(1);
  }

  const sceneDir = path.resolve(sceneDirParam);
  let audioDir = audioDirParam ? path.resolve(audioDirParam) : '';
  let thumbnail = thumbnailParam ? path.resolve(thumbnailParam) : '';
  const description = asString(params, 'description', scriptMetadata.description || '');
  const tagParam = asString(params, 'tags');
  const tags = tagParam
    ? tagParam.split(',').map(tag => tag.trim()).filter(Boolean)
    : scriptMetadata.tags || [];
  const videoId = asString(params, 'video-id', scriptMetadata.videoId || `local-video-${Date.now()}`);
  const outputRoot = path.resolve(asString(params, 'output-dir', './videos/local-runs'));
  const width = Number(asString(params, 'width', '1920'));
  const height = Number(asString(params, 'height', '1080'));
  const fps = Number(asString(params, 'fps', '30'));
  const music = asString(params, 'music');
  const intro = asString(params, 'intro');
  const outro = asString(params, 'outro');
  const logo = asString(params, 'logo');
  const scheduledPublishTime = asString(params, 'publish-at');
  const privacy = (scheduledPublishTime ? 'private' : asString(params, 'privacy', 'private')) as PrivacyStatus;
  const skipUpload = hasFlag(params, 'skip-upload');

  await assertDir(sceneDir, 'Scene directory');

  if (thumbnailUrlParam) {
    console.log(`Downloading thumbnail from ${thumbnailUrlParam}...`);
    const response = await fetch(thumbnailUrlParam);
    if (!response.ok) throw new Error(`Failed to fetch thumbnail url: ${response.statusText}`);
    const urlPath = new URL(thumbnailUrlParam).pathname;
    let ext = path.extname(urlPath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      ext = '.jpg';
    }
    thumbnail = path.join(process.cwd(), `.tmp-thumbnail-${Date.now()}${ext}`);
    const buffer = await response.arrayBuffer();
    await fsPromises.writeFile(thumbnail, Buffer.from(buffer));
  }
  
  if (audioUrlParam) {
    audioDir = path.join(process.cwd(), '.tmp-audio-dir-' + Date.now());
    await fsPromises.mkdir(audioDir, { recursive: true });
    
    console.log('Downloading audio files from URLs...');
    const urls = audioUrlParam.split(',').map(u => u.trim()).filter(Boolean);
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`  Downloading ${url}...`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch audio url: ${response.statusText}`);
      
      const urlPath = new URL(url).pathname;
      let ext = path.extname(urlPath).toLowerCase();
      // Only keep known audio extensions or default to .mp3
      if (!['.wav', '.mp3', '.m4a', '.aac'].includes(ext)) {
        ext = '.mp3';
      }
      
      const dest = path.join(audioDir, `narration_${String(i + 1).padStart(2, '0')}${ext}`);
      
      const buffer = await response.arrayBuffer();
      await fsPromises.writeFile(dest, Buffer.from(buffer));
    }
  } else {
    await assertDir(audioDir, 'Audio directory');
  }

  await assertFile(thumbnail, 'Thumbnail');
  if (music) await assertFile(path.resolve(music), 'Music');
  if (intro) await assertFile(path.resolve(intro), 'Intro');
  if (outro) await assertFile(path.resolve(outro), 'Outro');
  if (logo) await assertFile(path.resolve(logo), 'Logo');

  const sceneHtmlFiles = await listFiles(sceneDir, ['.html', '.htm']);
  const audioFiles = await listFiles(audioDir, ['.wav', '.mp3', '.m4a', '.aac']);

  if (sceneHtmlFiles.length === 0) {
    throw new Error(`No HTML scene files found in ${sceneDir}`);
  }
  if (sceneHtmlFiles.length !== audioFiles.length) {
    throw new Error(`Scene/audio count mismatch: ${sceneHtmlFiles.length} HTML files, ${audioFiles.length} audio files`);
  }

  const runDir = path.join(outputRoot, videoId);
  const renderedDir = path.join(runDir, 'rendered-scenes');
  await fsPromises.mkdir(renderedDir, { recursive: true });

  console.log(`Rendering ${sceneHtmlFiles.length} HTML scenes...`);
  const renderer = new HtmlToVideoService();
  const renderedClips: string[] = [];
  const sceneDurations: number[] = [];

  for (let i = 0; i < sceneHtmlFiles.length; i++) {
    const audioDuration = await getVideoDuration(audioFiles[i]);
    const duration = Math.max(0.5, audioDuration + 0.5);
    const html = await fsPromises.readFile(sceneHtmlFiles[i], 'utf-8');
    const output = path.join(renderedDir, `scene_${String(i + 1).padStart(2, '0')}.mp4`);

    console.log(`  Scene ${i + 1}/${sceneHtmlFiles.length}: ${path.basename(sceneHtmlFiles[i])} (${duration.toFixed(2)}s)`);
    await renderer.render({
      html,
      width,
      height,
      fps,
      duration,
      output,
    });

    renderedClips.push(output);
    sceneDurations.push(duration);
  }

  console.log('Assembling final video...');
  const assembler = new VideoAssemblyService(runDir);
  const assembled = await assembler.assembleVideo({
    jobId: videoId,
    videoId,
    clips: renderedClips,
    narrationAudios: audioFiles,
    perSceneNarration: scriptMetadata.perSceneNarration && scriptMetadata.perSceneNarration.length >= audioFiles.length
      ? scriptMetadata.perSceneNarration.slice(0, audioFiles.length)
      : audioFiles.map((_, index) => `Scene ${index + 1}`),
    animationStopTimes: sceneDurations,
    music: music ? path.resolve(music) : undefined,
    branding: {
      intro: intro ? path.resolve(intro) : undefined,
      outro: outro ? path.resolve(outro) : undefined,
      logo: logo ? path.resolve(logo) : undefined,
    },
    isShort: false,
  });

  let finalDescription = description;
  const sceneTitles = scriptMetadata.sceneTitles && scriptMetadata.sceneTitles.length >= sceneHtmlFiles.length
    ? scriptMetadata.sceneTitles.slice(0, sceneHtmlFiles.length)
    : sceneHtmlFiles.map((file, index) => {
      const name = path.basename(file, path.extname(file)).replace(/[_-]+/g, ' ');
      return name || `Scene ${index + 1}`;
    });

  if (canGenerateTimestamps(sceneTitles, assembled.sceneDurations || [])) {
    const timestamps = generateTimestamps(sceneTitles, assembled.sceneDurations || []);
    if (timestamps) {
      finalDescription = `${description}\n\nChapters:\n${timestamps}`.trim();
    }
  }

  console.log(`Video assembled: ${assembled.outputPath}`);
  console.log(`Duration: ${assembled.duration.toFixed(2)}s`);

  if (skipUpload) {
    console.log('Skipping YouTube upload because --skip-upload was provided.');
    return;
  }

  console.log('Uploading local video and thumbnail to YouTube...');
  const youtubeId = await uploadLocalVideoToYouTube({
    videoPath: assembled.outputPath,
    thumbnailPath: thumbnail,
    title,
    description: finalDescription,
    tags,
    privacyStatus: privacy,
    scheduledPublishTime,
  });

  console.log(`YouTube upload complete: https://youtube.com/watch?v=${youtubeId}`);

  if (audioUrlParam && audioDir.includes('.tmp-audio-dir-')) {
    console.log('Cleaning up temporary audio directory...');
    await fsPromises.rm(audioDir, { recursive: true, force: true }).catch(() => {});
  }

  if (thumbnailUrlParam && thumbnail.includes('.tmp-thumbnail-')) {
    console.log('Cleaning up temporary thumbnail...');
    await fsPromises.rm(thumbnail, { force: true }).catch(() => {});
  }
}

main().catch(error => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});

function applyPositionalFallbacks(params: CliParams, positional: string[]): void {
  if (positional.length === 0) return;

  const [scriptFile, sceneDir, audioDir, thumbnail, privacy] = positional;
  if (!params['script-file'] && scriptFile) params['script-file'] = scriptFile;
  if (!params['scene-dir'] && sceneDir) params['scene-dir'] = sceneDir;
  if (!params['audio-dir'] && audioDir) params['audio-dir'] = audioDir;
  if (!params.thumbnail && thumbnail) params.thumbnail = thumbnail;
  if (!params.privacy && privacy) params.privacy = privacy;
}
