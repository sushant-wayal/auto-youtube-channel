/**
 * Music and Branding Asset Utilities
 * Handles background music selection and branding asset retrieval
 */

import fs from 'fs';
import path from 'path';

const assetsDir = path.join(__dirname, '../../assets');

/**
 * Pick a random background music track from assets/music
 * @returns Absolute path to a random .mp3 file
 */
export function pickBackgroundTrack(): string {
  const musicDir = path.join(assetsDir, 'music');

  // Check if directory exists
  if (!fs.existsSync(musicDir)) {
    throw new Error(
      `Music directory not found: ${musicDir}\n` +
      'Please create assets/music and add some copyright-free .mp3 tracks.'
    );
  }

  // Find all .mp3 files
  const files = fs.readdirSync(musicDir);
  const mp3Files = files.filter(file => file.toLowerCase().endsWith('.mp3'));

  if (mp3Files.length === 0) {
    throw new Error(
      `No .mp3 files found in ${musicDir}\n` +
      'Please add some copyright-free music tracks to assets/music/'
    );
  }

  // Pick random track
  const randomTrack = mp3Files[Math.floor(Math.random() * mp3Files.length)];
  const trackPath = path.join(musicDir, randomTrack);

  console.log(`🎵 Selected background track: ${randomTrack}`);
  return trackPath;
}

export interface BrandingAssets {
  logo?: string;
  intro?: string;
  outro?: string;
}

/**
 * Get available branding assets (logo, intro, outro)
 * @returns Object containing paths to available branding assets
 */
export function getBrandingAssets(): BrandingAssets {
  const brandingDir = path.join(assetsDir, 'branding');
  const assets: BrandingAssets = {};

  // Check for logo.png
  const logoPath = path.join(brandingDir, 'logo.png');
  if (fs.existsSync(logoPath)) {
    assets.logo = logoPath;
    console.log('🎨 Found branding asset: logo.png');
  }

  // Check for intro.mp4
  const introPath = path.join(brandingDir, 'intro.mp4');
  if (fs.existsSync(introPath)) {
    assets.intro = introPath;
    console.log('🎨 Found branding asset: intro.mp4');
  }

  // Check for outro.mp4
  const outroPath = path.join(brandingDir, 'outro.mp4');
  if (fs.existsSync(outroPath)) {
    assets.outro = outroPath;
    console.log('🎨 Found branding asset: outro.mp4');
  }

  const assetCount = Object.keys(assets).length;
  if (assetCount === 0) {
    console.log('⚠️  No branding assets found in assets/branding/');
  } else {
    console.log(`✅ Found ${assetCount} branding asset(s)`);
  }

  return assets;
}
