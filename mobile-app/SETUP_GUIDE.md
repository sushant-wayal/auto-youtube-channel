# Mobile Dashboard App - Setup Guide

This guide will help you set up and run the mobile dashboard app for managing video ideas and shorts scheduling.

## Overview

The mobile app provides:
- ✅ **Ideas Queue Management** - Add, edit, delete, and reorder video ideas
- ✅ **Shorts Schedule Management** - View and update daily publish time for shorts
- 📱 Native iOS and Android support
- 🔄 Pull-to-refresh on all screens
- ⚡ Fast, lightweight, and optimized for quick edits

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** (v18 or higher)
   - Check: `node --version`
   - Download: https://nodejs.org/

2. **npm** (comes with Node.js)
   - Check: `npm --version`

3. **Expo Go app** on your phone (for testing)
   - iOS: https://apps.apple.com/app/expo-go/id982107779
   - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

4. **Backend API running** (your website/dashboard)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Navigate to the mobile app directory
cd mobile-app/dashboard-app

# Install all dependencies
npm install
```

This will install:
- Expo SDK
- React Native
- React Navigation
- All required dependencies

### 2. Configure Backend API URL

**IMPORTANT**: You need to update the API configuration.

#### Option A: Using config.ts (Recommended)

Open [config.ts](config.ts) and update the `API_BASE_URL`:

```typescript
export const API_BASE_URL = 'http://YOUR_LOCAL_IP:3000';
```

#### Option B: Using .env file

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set your API URL:
   ```
   API_BASE_URL=http://192.168.1.100:3000
   ```

#### Finding Your Local IP Address

**Why not use `localhost`?**
When running on a physical device or emulator, `localhost` refers to the device itself, not your computer.

**How to find your local IP:**

**macOS/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Example IPs:**
- `192.168.1.100` (typical home network)
- `10.0.0.5` (some routers)
- `172.16.0.10` (corporate networks)

### 3. Start the Backend API

Make sure your backend is running and accessible:

```bash
# In the website directory (separate terminal)
cd ../../website
npm run dev
```

Verify it's running:
- Open browser: `http://localhost:3000`
- Check: `http://YOUR_LOCAL_IP:3000/api/ideas-queue`

**Firewall Note**: Your firewall may block connections from other devices. You may need to:
- Allow Node.js through your firewall
- Temporarily disable firewall for testing

### 4. Start the Mobile App

```bash
# In mobile-app/dashboard-app directory
npm start
```

This will:
1. Start the Metro bundler
2. Show a QR code in your terminal
3. Open Expo DevTools in your browser

### 5. Run on Your Device

#### Option A: Physical Device (Recommended for Testing)

1. Install **Expo Go** app on your phone
2. **iOS**: Open Camera app and scan the QR code
3. **Android**: Open Expo Go app and scan the QR code
4. Wait for the app to load

#### Option B: iOS Simulator (Mac only)

```bash
# Press 'i' in the terminal where npm start is running
# Or run:
npm run ios
```

Requires Xcode installed.

#### Option C: Android Emulator

```bash
# Press 'a' in the terminal where npm start is running
# Or run:
npm run android
```

Requires Android Studio with an emulator configured.

## Testing the Connection

Once the app loads:

1. **Test Ideas Screen**:
   - You should see the "Video Ideas Queue" screen
   - If there are existing ideas, they'll load automatically
   - Try adding a new idea
   - If you get an error, check your API URL configuration

2. **Test Shorts Schedule Screen**:
   - Tap the "Schedule" tab at the bottom
   - You should see the current publish time
   - Try updating the time
   - Check if changes persist

## Common Issues & Solutions

### "Network request failed" or "Unable to connect"

**Causes:**
- Backend not running
- Wrong API URL in config.ts
- Firewall blocking connections
- Device not on same network as computer

**Solutions:**
1. Verify backend is running: `curl http://YOUR_LOCAL_IP:3000/api/ideas-queue`
2. Double-check IP address in config.ts
3. Ensure phone and computer are on same WiFi network
4. Try disabling firewall temporarily
5. On macOS, go to System Preferences → Sharing → Enable "Internet Sharing" if needed

### "Unable to resolve module"

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

### QR code not scanning

**Solution:**
- Ensure Expo Go app is installed
- Try using the Expo DevTools (opens in browser) to send link via email/SMS
- Or manually type the URL shown in terminal into Expo Go

### App loads but screens are blank

**Solution:**
- Check React Native logs in terminal
- Look for JavaScript errors
- Verify all files were created correctly

### Changes not reflecting

**Solution:**
- Press `r` in terminal to reload
- Or shake device and select "Reload"
- Clear cache: `npx expo start --clear`

## Development Workflow

### Making Changes

1. Edit any file (screens, components, services)
2. Save the file
3. App will hot-reload automatically
4. If it doesn't, press `r` in terminal

### Debugging

1. **View logs**: Check the terminal where `npm start` is running
2. **Inspect element**: Shake device → "Show Element Inspector"
3. **Debug JS remotely**: Shake device → "Debug Remote JS" (opens Chrome DevTools)
4. **View errors**: Errors will show as red screens in the app

### Building for Production

When ready to build a standalone app:

```bash
# Configure app signing first (see Expo docs)
# Then build:
npx expo build:android
npx expo build:ios
```

See [Expo Build Documentation](https://docs.expo.dev/build/introduction/) for details.

## Project Structure

```
mobile-app/dashboard-app/
├── App.tsx                    # Main app entry with navigation
├── config.ts                  # API configuration (UPDATE THIS!)
├── package.json              # Dependencies
├── app.json                  # Expo configuration
├── tsconfig.json             # TypeScript config
├── babel.config.js           # Babel config
│
├── components/               # Reusable UI components
│   ├── ErrorMessage.tsx      # Error display
│   ├── EmptyState.tsx        # Empty state UI
│   └── LoadingSpinner.tsx    # Loading indicator
│
├── screens/                  # App screens
│   ├── IdeasScreen.tsx       # Ideas queue management
│   └── ShortsScheduleScreen.tsx  # Shorts time management
│
├── services/                 # Business logic
│   └── api.ts               # API calls to backend
│
└── assets/                   # Images, icons
    ├── icon.png             # App icon (1024x1024)
    ├── splash.png           # Splash screen
    └── adaptive-icon.png    # Android adaptive icon
```

## API Endpoints

The app uses these backend endpoints:

### Ideas Queue
- `GET /api/ideas-queue` - Get all ideas
- `POST /api/ideas-queue` with body:
  - `{ action: 'add', idea: string }` - Add idea
  - `{ action: 'edit', index: number, idea: string }` - Edit idea
  - `{ action: 'remove', index: number }` - Delete idea
  - `{ action: 'move', index: number, newIndex: number }` - Reorder
  - `{ action: 'clear' }` - Clear all

### Shorts Schedule
- `GET /api/shorts-publish-time` - Get current time
- `POST /api/shorts-publish-time` with body:
  - `{ time: string }` - Update time (format: "HH:MM")

## Features Implemented

### Ideas Screen ✅
- [x] View all ideas in queue
- [x] Add new ideas
- [x] Edit existing ideas
- [x] Delete ideas
- [x] Reorder ideas (move up/down)
- [x] Clear all ideas
- [x] Pull to refresh
- [x] Loading states
- [x] Error handling
- [x] Empty state

### Shorts Schedule Screen ✅
- [x] View current publish time
- [x] Update publish time
- [x] Time validation (HH:MM format)
- [x] Quick time presets
- [x] Pull to refresh
- [x] Loading states
- [x] Error handling
- [x] Success feedback

## Future Enhancements (Not Yet Implemented)

These are planned but not included in V1:

- [ ] Push notifications (job completion status)
- [ ] Settings screen (notification preferences)
- [ ] Offline mode with local caching
- [ ] Dark mode
- [ ] Biometric authentication
- [ ] Batch operations on ideas
- [ ] Search/filter ideas

## Getting Help

### Expo Documentation
- Getting Started: https://docs.expo.dev/get-started/introduction/
- React Navigation: https://reactnavigation.org/docs/getting-started

### Debugging Resources
- React Native Docs: https://reactnative.dev/docs/debugging
- Expo Troubleshooting: https://docs.expo.dev/troubleshooting/overview/

### Common Commands

```bash
# Start development server
npm start

# Start with cache cleared
npx expo start --clear

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# View all options
npx expo start --help
```

## Support

If you encounter issues:

1. Check the Common Issues section above
2. Review Expo logs in terminal
3. Check network connectivity between devices
4. Verify backend API is accessible
5. Clear cache and reinstall dependencies

## Next Steps

After successful setup:

1. **Customize the app**: Update colors, styles in screen files
2. **Add icons**: Replace placeholder assets in `/assets` folder
3. **Deploy backend**: Use Vercel, Heroku, or your preferred host
4. **Update API URL**: Point to production backend URL
5. **Build standalone app**: Follow Expo build guides for iOS/Android

Enjoy your mobile dashboard! 🚀
