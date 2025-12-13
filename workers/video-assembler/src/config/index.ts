/**
 * Worker Configuration
 * Loads environment variables and exports configuration objects
 */

import dotenv from 'dotenv';
import path from 'path';
import { ASSETS, VIDEO } from '../constants';

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
    worker: {
        pollInterval: 5000, // Poll Redis every 5 seconds
        jobTimeout: 3600000, // 1 hr job timeout
        workDir: path.join(__dirname, VIDEO),
        assetsDir: path.join(__dirname, ASSETS),
    },
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

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }

    console.log('✅ Configuration validated successfully');
}

export default config;
