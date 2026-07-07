import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function checkScopes() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YT_CLIENT_ID,
    process.env.YT_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YT_REFRESH_TOKEN,
  });

  try {
    const tokenInfo = await oauth2Client.getTokenInfo(
      (await oauth2Client.getAccessToken()).token!
    );
    console.log("Token scopes:", tokenInfo.scopes);
  } catch (error) {
    console.error("Error fetching token info:", error);
  }
}

checkScopes();
