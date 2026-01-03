# Quick Setup Guide

## 🚀 Getting Started in 5 Minutes

### 1. Clone and Install
```bash
git clone <your-repo>
cd video-genration-on-worker
npm install
```

### 2. Set GitHub Secrets

Go to: **Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
GEMINI_API_KEY=your_gemini_key
YT_CLIENT_ID=your_youtube_client_id
YT_CLIENT_SECRET=your_youtube_client_secret
YT_REFRESH_TOKEN=your_youtube_refresh_token
WEBSITE_DOMAIN=https://your-website.com
```

### 3. Test Manually

Go to: **Actions → Video Generation Pipeline → Run workflow**

### 4. Check Results

Monitor the workflow execution in the Actions tab!

## 📅 Schedule

The pipeline runs automatically **daily at 2 AM UTC**.

To change:
1. Edit `.github/workflows/main.yml`
2. Update the cron expression:
   ```yaml
   schedule:
     - cron: '0 2 * * *'  # Change this
   ```

## 🎬 Customize Video Topics

Edit `.github/scripts/generate-script.ts`:
```typescript
const VIDEO_IDEAS = [
    "Your Topic 1",
    "Your Topic 2",
    // Add more topics
];
```

## 📊 Monitor

View pipeline execution:
- Go to **Actions** tab
- Click latest **Video Generation Pipeline** run
- Check individual job logs

## 🐛 Troubleshooting

**Workflow fails?**
1. Check job logs for errors
2. Verify all secrets are set
3. Test individual scripts locally:
   ```bash
   npx tsx .github/scripts/generate-script.ts "Test Video"
   ```

**Need help?**
- Check [GITHUB_ACTIONS_README.md](./GITHUB_ACTIONS_README.md)
- Review [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

## ✅ That's it!

Your automated video generation pipeline is now running on GitHub Actions! 🎉
