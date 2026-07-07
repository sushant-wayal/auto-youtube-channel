import { google } from "googleapis";
import dotenv from "dotenv";
dotenv.config();

const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET
);

oauth2Client.setCredentials({
    refresh_token: process.env.YT_REFRESH_TOKEN,
});

const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client,
});

async function testPlaylistAccess() {
    try {
        console.log("Checking token scopes and playlist access...");
        const response = await youtube.playlists.list({
            part: ["snippet"],
            mine: true,
            maxResults: 1,
        });
        
        console.log("✅ Success! The token has access to playlists.");
        console.log(`Found ${response.data.pageInfo?.totalResults} playlists.`);
    } catch (error: any) {
        console.error("❌ Error accessing playlists:");
        console.error(error.message || error);
    }
}

testPlaylistAccess();
