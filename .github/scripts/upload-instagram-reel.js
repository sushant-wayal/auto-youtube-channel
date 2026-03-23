const Redis = require('ioredis');
const fetch = require('node-fetch');

const redis = new Redis(process.env.REDIS_URL);

const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_PAGE_ID = process.env.INSTAGRAM_PAGE_ID;
const SHORT_INDEX_INPUT = process.env.SHORT_INDEX_INPUT;

const DEFAULT_SHORTS_TIMES = ['06:45', '07:45', '08:45', '12:00', '14:00'];

/**
 * Convert current UTC time to IST and return HH:MM format
 */
function getCurrentTimeIST() {
    const now = new Date();
    // IST is UTC+5:30
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Determine which short index to upload based on current time
 * Matches current time (within 5 minute window) against scheduled times
 */
async function determineShortIndex() {
    // If manual input provided, use it
    if (SHORT_INDEX_INPUT && SHORT_INDEX_INPUT.trim() !== '') {
        const idx = parseInt(SHORT_INDEX_INPUT.trim());
        if (idx >= 0 && idx <= 4) {
            console.error(`📝 Using manual short index: ${idx}`);
            return idx;
        }
    }

    // Get scheduled times from Redis
    const shortsTimesRaw = await redis.get('shorts:publish-times');
    const shortsTimes = shortsTimesRaw
        ? JSON.parse(shortsTimesRaw)
        : DEFAULT_SHORTS_TIMES;

    const currentTime = getCurrentTimeIST();
    console.error(`⏰ Current time (IST): ${currentTime}`);
    console.error(`📅 Scheduled times: ${shortsTimes.join(', ')}`);

    // Parse current time to minutes since midnight
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const currentTotalMins = currentHour * 60 + currentMin;

    // Find matching short (within 5 minute window)
    for (let i = 0; i < shortsTimes.length; i++) {
        const [schedHour, schedMin] = shortsTimes[i].split(':').map(Number);
        const schedTotalMins = schedHour * 60 + schedMin;

        const diff = Math.abs(currentTotalMins - schedTotalMins);
        if (diff <= 5) {
            console.error(`✅ Matched short index ${i} (scheduled ${shortsTimes[i]} IST)`);
            return i;
        }
    }

    console.error(`❌ No matching schedule found for current time ${currentTime}`);
    console.error(`   Expected one of: ${shortsTimes.join(', ')}`);
    process.exit(1);
}

/**
 * Upload video to Instagram as a Reel
 */
async function uploadToInstagram(videoUrl, caption) {
    // Step 1: Create media container
    console.error('📤 Creating Instagram media container...');

    const createResponse = await fetch(
        `https://graph.facebook.com/v21.0/${IG_PAGE_ID}/media`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                media_type: 'REELS',
                video_url: videoUrl,
                caption: caption,
                access_token: IG_TOKEN,
            }),
        }
    );

    const createData = await createResponse.json();

    if (createData.error) {
        throw new Error(`Instagram API error: ${createData.error.message}`);
    }

    const containerId = createData.id;
    console.error(`✅ Media container created: ${containerId}`);

    // Step 2: Wait for video processing and check status
    console.error('⏳ Waiting for Instagram to process video...');
    let status = 'IN_PROGRESS';
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max (10s * 30)

    while (status === 'IN_PROGRESS' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
        attempts++;

        const statusResponse = await fetch(
            `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${IG_TOKEN}`
        );
        const statusData = await statusResponse.json();
        status = statusData.status_code;
        console.error(`   Processing status: ${status} (attempt ${attempts}/${maxAttempts})`);
    }

    if (status !== 'FINISHED') {
        throw new Error(`Video processing failed or timed out. Status: ${status}`);
    }

    // Step 3: Publish the media container
    console.error('📤 Publishing Instagram Reel...');

    const publishResponse = await fetch(
        `https://graph.facebook.com/v21.0/${IG_PAGE_ID}/media_publish`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id: containerId,
                access_token: IG_TOKEN,
            }),
        }
    );

    const publishData = await publishResponse.json();

    if (publishData.error) {
        throw new Error(`Instagram publish error: ${publishData.error.message}`);
    }

    const instagramId = publishData.id;
    console.error(`✅ Instagram Reel published: ${instagramId}`);

    // Get permalink
    const permalinkResponse = await fetch(
        `https://graph.facebook.com/v21.0/${instagramId}?fields=permalink&access_token=${IG_TOKEN}`
    );
    const permalinkData = await permalinkResponse.json();
    const permalink = permalinkData.permalink || null;

    return { instagramId, permalink };
}

async function main() {
    try {
        console.error('\n🎬 Instagram Reel Upload Starting\n');

        // Determine which short to upload
        const shortIndex = await determineShortIndex();

        // Get latest pipeline status to find video ID
        const statusRaw = await redis.get('pipeline:latest-status');
        if (!statusRaw) {
            console.error('⚠️  No pipeline status found in Redis. Skipping upload.');
            process.exit(0);
        }

        const status = JSON.parse(statusRaw);
        const videoId = status.videoId;

        console.error(`📹 Video ID: ${videoId}`);
        console.error(`🔢 Short Index: ${shortIndex}\n`);

        // Fetch reel data from Redis
        const reelKey = `reel:${videoId}:${shortIndex}`;
        const reelDataRaw = await redis.get(reelKey);

        // Check if reel data exists - if not, skip gracefully (not all days have 5 shorts)
        if (!reelDataRaw) {
            console.error(`⚠️  No reel data found for short index ${shortIndex} (key: ${reelKey}).`);
            console.error(`   This is normal if fewer than ${shortIndex + 1} shorts were generated today.`);
            console.error(`   Skipping this upload.\n`);
            process.exit(0);
        }

        const reelData = JSON.parse(reelDataRaw);
        const { cloudinaryUrl, caption, shortId, hook } = reelData;

        console.error(`📝 Hook: ${hook}`);
        console.error(`💬 Caption: ${caption}`);
        console.error(`🔗 Video URL: ${cloudinaryUrl}\n`);

        // Upload to Instagram
        const { instagramId, permalink } = await uploadToInstagram(cloudinaryUrl, caption);

        console.error(`\n✅ Instagram Reel uploaded successfully!`);
        console.error(`📱 Instagram ID: ${instagramId}`);
        console.error(`🔗 Permalink: ${permalink}\n`);

        // Store Instagram result in Redis
        const igResultKey = `pipeline:instagram:${videoId}`;
        const igResult = {
            shortIndex,
            shortId,
            instagramId,
            permalink,
            uploadedAt: new Date().toISOString(),
            rank: shortIndex,
        };

        await redis.rpush(igResultKey, JSON.stringify(igResult));
        await redis.expire(igResultKey, 60 * 60 * 24 * 7); // 7-day TTL

        console.error(`💾 Instagram result stored in Redis`);

        // Clean up reel data to prevent duplicate uploads tomorrow
        await redis.del(reelKey);
        console.error(`🧹 Reel data cleaned up (${reelKey}) to prevent duplicate uploads\n`);

    } catch (error) {
        console.error('❌ Error uploading to Instagram:', error);
        process.exit(1);
    } finally {
        await redis.quit();
    }
}

main();
