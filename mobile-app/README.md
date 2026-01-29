# Mobile Apps

This directory contains mobile applications for the video generation platform.

## 📱 Dashboard App

A native React Native mobile dashboard for managing video ideas and shorts scheduling.

**Location**: `dashboard-app/`

**Features**:
- ✅ Ideas Queue Management (add, edit, delete, reorder)
- ✅ Shorts Publish Time Management
- ✅ Native iOS and Android support
- ✅ Pull-to-refresh
- ✅ Clean, fast, utilitarian UI

## 🚀 Quick Start

```bash
# 1. Navigate to the dashboard app
cd dashboard-app

# 2. Install dependencies
npm install

# 3. Find your local IP
npm run get-ip

# 4. Update config.ts with the IP shown
# Change: export const API_BASE_URL = 'http://YOUR_IP:3000';

# 5. Start the backend (in another terminal)
cd ../../website
npm run dev

# 6. Start the mobile app
cd ../mobile-app/dashboard-app
npm start

# 7. Scan QR code with Expo Go app on your phone
```

## 📚 Documentation

- **[Setup Guide](SETUP_GUIDE.md)** - Comprehensive setup instructions
- **[Quick Reference](QUICK_REFERENCE.md)** - Quick reference for developers
- **[Project Summary](PROJECT_SUMMARY.md)** - Complete project overview
- **[App README](dashboard-app/README.md)** - App-specific documentation

## 🎯 Use Cases

The mobile dashboard is perfect for:
- Quick idea management on-the-go
- Updating shorts schedule from anywhere
- Managing queue while away from computer
- Personal/internal use by content creators

## 🛠️ Tech Stack

- **Framework**: Expo + React Native
- **Language**: TypeScript
- **Navigation**: React Navigation
- **State**: React Hooks
- **Backend**: Existing Next.js APIs

## 📱 Supported Platforms

- ✅ iOS (iPhone/iPad)
- ✅ Android (Phone/Tablet)
- ✅ iOS Simulator (Mac only)
- ✅ Android Emulator

## 🔮 Future Apps

This directory can contain additional mobile apps in the future:
- Analytics app (view stats and metrics)
- Monitoring app (job status, logs)
- Viewer app (for end users)

## 📞 Need Help?

1. Check the [Setup Guide](SETUP_GUIDE.md) for detailed instructions
2. Review the [Quick Reference](QUICK_REFERENCE.md) for common tasks
3. Ensure backend is running and accessible
4. Verify network connectivity

## 🎓 Learning Resources

- Expo Documentation: https://docs.expo.dev/
- React Native: https://reactnative.dev/
- React Navigation: https://reactnavigation.org/
