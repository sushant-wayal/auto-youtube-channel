/**
 * Worker Configuration
 * Loads environment variables and exports configuration objects
 */

import dotenv from 'dotenv';
import path from 'path';
import { CLIPS } from '../constants';

// Load environment variables from parent .env.local
dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });

export const config = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
        apiKey: process.env.CLOUDINARY_API_KEY || '',
        apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    },
    video: {
        long: {
            width: 1280,
            height: 720,
            fps: 30,
        },
        short: {
            width: 720,
            height: 1280,
            fps: 30,
        },
    },
    worker: {
        pollInterval: 5000, // Poll Redis every 5 seconds
        jobTimeout: 3600000, // 1 hr job timeout
        workDir: path.join(__dirname, CLIPS),
    },
    prod: process.env.PROD === 'true'
};

// Validate required configuration
export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.redis.url) {
        errors.push('REDIS_URL is required');
    }
    if (!config.cloudinary.cloudName) {
        errors.push('CLOUDINARY_CLOUD_NAME is required');
    }
    if (!config.cloudinary.apiKey) {
        errors.push('CLOUDINARY_API_KEY is required');
    }
    if (!config.cloudinary.apiSecret) {
        errors.push('CLOUDINARY_API_SECRET is required');
    }
    if (!config.worker.workDir) {
        errors.push('Worker workDir is required');
    }
    if (!config.video.long.width || !config.video.long.height) {
        errors.push('Video long dimensions are required');
    }
    if (!config.video.short.width || !config.video.short.height) {
        errors.push('Video short dimensions are required');
    }
    if (!config.video.long.fps) {
        errors.push('Video long fps is required');
    }
    if (!config.video.short.fps) {
        errors.push('Video short fps is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }

    console.log('✅ Configuration validated successfully');
    console.log(`Running in ${config.prod ? 'PROD' : 'NON-PROD'} mode`);
}

export default config;
