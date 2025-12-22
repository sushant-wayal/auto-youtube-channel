/**
 * Worker Configuration
 * Loads environment variables and exports configuration objects
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from parent .env.local
dotenv.config({ path: path.join(__dirname, '../..', '.env.local') });

export const config = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
    },
    website: {
        domain: process.env.WEBSITE_DOMAIN || 'http://localhost:3000',
    },
    worker: {
        pollInterval: 5000, // Poll Redis every 5 seconds
        jobTimeout: 3600000, // 1 hr job timeout
    },
    thumbnail: {
        enabled: process.env.ENABLE_THUMBNAIL_GENERATION === 'true',
    }
};

// Validate required configuration
export function validateConfig(): void {
    const errors: string[] = [];

    if (!config.redis.url) {
        errors.push('REDIS_URL is required');
    }
    if (!config.website.domain) {
        errors.push('WEBSITE_DOMAIN is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(err => console.error(`   - ${err}`));
        process.exit(1);
    }

    console.log('✅ Configuration validated successfully');
}

export default config;
