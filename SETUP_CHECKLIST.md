# Setup Checklist for GitHub Actions Pipeline

## ✅ Pre-Deployment Checklist

### 1. Code Verification
- [x] All Redis services removed
- [x] All job processors removed
- [x] All duplicate config files removed
- [x] All duplicate Cloudinary services removed
- [x] All `ioredis` dependencies removed
- [x] Worker classes cleaned up
- [x] Shared services created
- [x] GitHub Actions workflow created
- [x] All workflow scripts created

### 2. Documentation
- [x] README.md updated
- [x] GITHUB_ACTIONS_README.md created
- [x] MIGRATION_GUIDE.md created
- [x] QUICK_START.md created
- [x] REFACTORING_SUMMARY.md created

### 3. File Structure
```
✅ .github/workflows/main.yml
✅ .github/scripts/ (7 script files)
✅ shared/config/index.ts
✅ shared/services/cloudinary-service.ts
✅ shared/index.ts
✅ shared/package.json
✅ workers/*/src/index.ts (pure functions)
✅ No redis-service.ts files
✅ No job-processor.ts files
✅ No duplicate config files
```

## 📋 Deployment Steps

### Step 1: Install Dependencies
```bash
cd /path/to/repo
npm install
```
**Status:** Ready to run

### Step 2: Set GitHub Secrets

Go to: **Repository Settings → Secrets and variables → Actions → New repository secret**

Required secrets:
- [ ] `CLOUDINARY_CLOUD_NAME`
- [ ] `CLOUDINARY_API_KEY`
- [ ] `CLOUDINARY_API_SECRET`
- [ ] `GEMINI_API_KEY`
- [ ] `YT_CLIENT_ID`
- [ ] `YT_CLIENT_SECRET`
- [ ] `YT_REFRESH_TOKEN`
- [ ] `WEBSITE_DOMAIN`

Optional variables (Settings → Variables → Actions):
- [ ] `ENABLE_THUMBNAIL_GENERATION` (set to `true`)

### Step 3: Test Locally (Optional)

Test individual components:
```bash
# Install and build
npm install
npm run build

# Test shared services
npx tsx shared/config/index.ts

# Test workflow scripts (after setting env vars locally)
npx tsx .github/scripts/generate-script.ts "Test Video Idea"
```

### Step 4: Test on GitHub Actions

1. Go to **Actions** tab
2. Click **Video Generation Pipeline**
3. Click **Run workflow** button
4. Optional: Enter custom video idea
5. Click **Run workflow**
6. Monitor execution in real-time

### Step 5: Verify Output

Check the workflow run for:
- [ ] Script generation completed
- [ ] Scenes rendered successfully
- [ ] Voice-overs generated
- [ ] Video assembled
- [ ] Uploaded to YouTube
- [ ] Shorts processed
- [ ] Thumbnail generated (if enabled)
- [ ] View summary at bottom of workflow run

### Step 6: Configure Schedule

The workflow runs daily at 2 AM UTC by default.

To change schedule:
1. Edit `.github/workflows/main.yml`
2. Update cron expression:
   ```yaml
   schedule:
     - cron: '0 2 * * *'  # Modify this line
   ```
3. Commit and push

Cron examples:
- `'0 0 * * *'` - Midnight UTC
- `'0 6 * * *'` - 6 AM UTC
- `'0 12 * * *'` - Noon UTC
- `'0 */6 * * *'` - Every 6 hours
- `'0 0 * * 0'` - Weekly (Sunday)

## 🔍 Verification Commands

Run these to verify everything is clean:

```bash
# No Redis files should exist
find . -name "redis-service.ts" -o -name "job-processor.ts" | grep -v node_modules
# Should return nothing

# No ioredis dependencies
grep -r "ioredis" package*.json workers/*/package.json
# Should return nothing

# Verify GitHub Actions files
ls -la .github/workflows/main.yml
ls -la .github/scripts/

# Verify shared folder
ls -la shared/config/
ls -la shared/services/

# Count workflow scripts (should be 7)
ls -1 .github/scripts/*.ts | wc -l
# Should return 7
```

## 📊 Expected Results

### First Run (Manual Test)
- Duration: ~90-120 minutes
- Jobs: 6-7 jobs running (some in parallel)
- Output: 1 main video + N shorts on YouTube

### Scheduled Runs
- Frequency: Daily at 2 AM UTC
- Automatic: No manual intervention
- Monitoring: Check Actions tab for status
- Notifications: Optional email on failure

## 🐛 Troubleshooting

### Workflow Fails to Start
**Check:**
- [ ] All required secrets are set
- [ ] Secrets are spelled correctly (case-sensitive)
- [ ] Workflow file syntax is valid YAML

### Script Generation Fails
**Check:**
- [ ] `GEMINI_API_KEY` is valid
- [ ] `WEBSITE_DOMAIN` is accessible
- [ ] API rate limits not exceeded

### Scene Rendering Fails
**Check:**
- [ ] `CLOUDINARY_*` credentials are correct
- [ ] Sufficient GitHub Actions minutes available
- [ ] Runner has enough disk space

### YouTube Upload Fails
**Check:**
- [ ] YouTube credentials are valid
- [ ] Refresh token is not expired
- [ ] Video meets YouTube requirements
- [ ] YouTube API quota not exceeded

## 📈 Monitoring

### View Logs
1. Go to **Actions** tab
2. Click on workflow run
3. Click on individual job
4. Expand steps to see detailed logs

### Check Status
- Green checkmark: Success
- Red X: Failed
- Yellow circle: In progress
- Gray circle: Queued/waiting

### Email Notifications
Enable in: **Settings → Notifications → Actions**

Options:
- Send notifications for all runs
- Send only on failure
- Send on workflow completion

## ✨ Success Criteria

Your setup is complete when:
- [x] All code refactoring done
- [x] All documentation created
- [ ] GitHub secrets configured
- [ ] Manual test run succeeds
- [ ] Video appears on YouTube
- [ ] Scheduled run works automatically
- [ ] Logs are clean and readable
- [ ] No errors in workflow runs

## 🎉 Next Steps

Once setup is complete:

1. **Monitor first few runs** - Check for any issues
2. **Adjust video topics** - Edit `VIDEO_IDEAS` array
3. **Customize schedule** - Modify cron expression
4. **Fine-tune settings** - Adjust video quality, duration, etc.
5. **Add features** - Extend workflow with new capabilities

## 📞 Support Resources

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Cron Expression Helper**: https://crontab.guru
- **Repository Documentation**:
  - [QUICK_START.md](./QUICK_START.md)
  - [GITHUB_ACTIONS_README.md](./GITHUB_ACTIONS_README.md)
  - [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

---

**Status**: ✅ Code refactoring complete. Ready for GitHub Secrets configuration and testing.
