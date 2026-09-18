import dotenv from 'dotenv';
import path from 'path';
import { google } from 'googleapis';

// Load root .env.local
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function testCommentAuth() {
    console.log('🔍 Testing YouTube OAuth Credentials for Comment Permissions...\n');

    const clientId = process.env.YT_CLIENT_ID;
    const clientSecret = process.env.YT_CLIENT_SECRET;
    const refreshToken = process.env.YT_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        console.error('❌ Missing credentials! Ensure YT_CLIENT_ID, YT_CLIENT_SECRET, and YT_REFRESH_TOKEN are set in .env.local');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
        console.log('1️⃣ Fetching channel identity (channels.list)...');
        const channelRes = await youtube.channels.list({
            part: ['id', 'snippet'],
            mine: true,
        });

        const channel = channelRes.data.items?.[0];
        if (!channel) {
            throw new Error('No channel found for authenticated account');
        }

        console.log(`   ✅ Authenticated Channel: "${channel.snippet?.title}" (ID: ${channel.id})`);

        console.log('\n2️⃣ Testing comment thread read permissions (commentThreads.list)...');
        try {
            const commentRes = await youtube.commentThreads.list({
                part: ['snippet'],
                allThreadsRelatedToChannelId: channel.id!,
                maxResults: 5,
            });

            const count = commentRes.data.items?.length || 0;
            console.log(`   ✅ Comment read scope is ACTIVE! Retrieved ${count} recent comment threads.`);
            if (count > 0) {
                const sample = commentRes.data.items![0]?.snippet?.topLevelComment?.snippet;
                console.log(`   Sample comment: "${sample?.authorDisplayName}": "${sample?.textOriginal?.slice(0, 50)}..."`);
            }
        } catch (commentErr: any) {
            if (commentErr?.code === 403 && commentErr?.message?.includes('insufficientPermissions')) {
                console.warn('\n⚠️ INSUFFICIENT PERMISSIONS DETECTED!');
                console.warn('Your YouTube OAuth refresh token does NOT currently include the comment management scope.');
                console.warn('Required scope: https://www.googleapis.com/auth/youtube.force-ssl or https://www.googleapis.com/auth/youtube');
                console.warn('Please re-authorize your OAuth application with the `youtube.force-ssl` scope and update YT_REFRESH_TOKEN.');
                process.exit(2);
            } else {
                console.warn(`⚠️ commentThreads.list notice: ${commentErr?.message}`);
            }
        }

        console.log('\n🎉 Pre-flight OAuth check completed successfully!');
    } catch (err: any) {
        console.error('\n❌ OAuth check failed:', err?.message || err);
        process.exit(1);
    }
}

testCommentAuth();
