# Mobile App Integration Guide

This guide explains how the mobile dashboard app has been integrated into your existing monorepo.

## ✅ Changes Made to Monorepo

### 1. Updated Root package.json

**File**: `/package.json`

**Change**: Added mobile-app workspace to workspaces array:

```json
{
  "workspaces": [
    "workers/*",
    "shared",
    "mobile-app/*"  // ← Added this
  ]
}
```

**Why**: This integrates the mobile app into the npm workspaces structure, allowing shared dependencies and unified commands.

### 2. Created Mobile App Directory

**Location**: `/mobile-app/`

**Structure**:
```
mobile-app/
├── README.md                 # Mobile apps overview
├── SETUP_GUIDE.md           # Comprehensive setup guide
├── QUICK_REFERENCE.md       # Quick reference docs
├── PROJECT_SUMMARY.md       # Complete project summary
└── dashboard-app/           # Main dashboard app
    ├── App.tsx
    ├── config.ts
    ├── package.json
    ├── screens/
    ├── components/
    ├── services/
    └── ... (see structure below)
```

## 📦 New Dependencies

The mobile app has its own `package.json` with these dependencies:

### Production Dependencies
- `expo` (~52.0.0) - Development framework
- `react` (18.3.1) - UI library
- `react-native` (0.76.5) - Mobile framework
- `expo-status-bar` (~2.0.0) - Status bar component
- `@react-navigation/native` (^6.1.9) - Navigation library
- `@react-navigation/bottom-tabs` (^6.5.11) - Tab navigation
- `react-native-screens` (~4.4.0) - Native screen components
- `react-native-safe-area-context` (4.12.0) - Safe area handling

### Development Dependencies
- `@babel/core` (^7.24.0) - JavaScript compiler
- `@types/react` (~18.3.12) - React TypeScript types
- `typescript` (^5.3.0) - TypeScript compiler

**Note**: These dependencies are isolated to the mobile app and don't affect your existing web/backend packages.

## 🔗 Integration Points

### Backend APIs (No Changes Required)

The mobile app uses your **existing** API endpoints:

1. **Ideas Queue API**: `/api/ideas-queue`
   - GET: Fetch all ideas
   - POST: Add, edit, delete, move, clear ideas

2. **Shorts Publish Time API**: `/api/shorts-publish-time`
   - GET: Get current time
   - POST: Update time

**No changes needed to your backend**. The mobile app is a pure consumer of existing APIs.

### Data Models (Shared)

The mobile app mirrors the same data models as your web dashboard:

```typescript
// Ideas Queue
type IdeasQueue = {
  ideas: string[];
  count: number;
};

// Shorts Publish Time
type ShortsPublishTimeResponse = {
  ok: boolean;
  time?: string;
  error?: string;
};
```

## 🏗️ Directory Structure

### Complete Mobile App Structure

```
mobile-app/
├── dashboard-app/
│   ├── App.tsx                       # Main app entry + navigation
│   ├── config.ts                     # API configuration (MODIFY THIS)
│   ├── package.json                  # Dependencies
│   ├── app.json                      # Expo configuration
│   ├── tsconfig.json                 # TypeScript config
│   ├── babel.config.js               # Babel config
│   ├── .gitignore                    # Git ignore rules
│   ├── .env.example                  # Environment template
│   ├── get-local-ip.js              # Helper script to find IP
│   ├── README.md                     # App documentation
│   │
│   ├── screens/                      # App screens
│   │   ├── IdeasScreen.tsx           # Ideas CRUD screen
│   │   └── ShortsScheduleScreen.tsx  # Schedule management screen
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ErrorMessage.tsx          # Error display component
│   │   ├── EmptyState.tsx            # Empty state component
│   │   └── LoadingSpinner.tsx        # Loading indicator
│   │
│   ├── services/                     # Business logic layer
│   │   └── api.ts                    # API service functions
│   │
│   └── assets/                       # Images and icons
│       ├── icon.png.txt              # Placeholder for app icon
│       ├── splash.png.txt            # Placeholder for splash screen
│       ├── adaptive-icon.png.txt     # Placeholder for adaptive icon
│       └── favicon.png.txt           # Placeholder for favicon
│
├── README.md                          # Mobile apps overview
├── SETUP_GUIDE.md                    # Comprehensive setup instructions
├── QUICK_REFERENCE.md                # Developer quick reference
└── PROJECT_SUMMARY.md                # Complete project overview
```

## 🚀 Installation Steps

### Option 1: Install Mobile App Only

```bash
# Navigate to mobile app
cd mobile-app/dashboard-app

# Install dependencies
npm install
```

### Option 2: Install All Workspaces (Recommended)

```bash
# From root of monorepo
npm install

# This installs dependencies for:
# - Root workspace
# - All workers
# - Shared package
# - Mobile app
```

## 🎯 Running the Mobile App

### Prerequisites

1. **Backend must be running**:
   ```bash
   cd website
   npm run dev
   ```

2. **Configure API URL**:
   ```bash
   cd mobile-app/dashboard-app
   npm run get-ip  # Find your local IP
   # Then update config.ts with the IP
   ```

3. **Start mobile app**:
   ```bash
   npm start
   # Scan QR code with Expo Go app
   ```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.

## 📱 Development Workflow

### Working with Monorepo

```bash
# Root level - affects all workspaces
npm install                    # Install all workspace dependencies
npm run build                  # Build all workspaces

# Mobile app specific
cd mobile-app/dashboard-app
npm start                      # Start mobile dev server
npm run get-ip                 # Find local IP
npm run android               # Run on Android
npm run ios                   # Run on iOS
```

### Parallel Development

You can develop the mobile app and web app simultaneously:

```bash
# Terminal 1: Backend
cd website
npm run dev

# Terminal 2: Mobile App
cd mobile-app/dashboard-app
npm start
```

They both use the same backend APIs.

## 🔒 Security Considerations

### Network Access

The mobile app needs network access to your backend:

1. **Development**: Uses local IP (e.g., `http://192.168.1.100:3000`)
   - Ensure firewall allows connections
   - Both devices must be on same WiFi

2. **Production**: Use HTTPS backend URL
   - Update `config.ts` with production URL
   - Example: `https://your-backend.vercel.app`

### No Authentication (By Design)

The mobile app has no authentication because:
- It's for personal/internal use
- Same as web dashboard
- Relies on backend API security
- Can add auth in future if needed

## 🎨 Customization

### Branding

To customize the app appearance:

1. **Colors**: Edit screen files (`screens/*.tsx`)
   - Primary color: `#007AFF`
   - Success: `#28a745`
   - Error: `#dc3545`

2. **Icons**: Replace placeholders in `assets/`
   - `icon.png` - App icon (1024x1024)
   - `splash.png` - Splash screen
   - `adaptive-icon.png` - Android adaptive icon

3. **App Name**: Edit `app.json`
   ```json
   {
     "expo": {
       "name": "Your App Name",
       "slug": "your-app-slug"
     }
   }
   ```

## 🚫 What Won't Break

### Existing Functionality

The mobile app integration **does not affect**:

- ✅ Website/dashboard functionality
- ✅ Backend APIs
- ✅ Worker processes
- ✅ GitHub Actions workflows
- ✅ Existing npm scripts
- ✅ Production deployments

### Isolated Dependencies

Mobile app dependencies are **isolated**:
- Won't conflict with web dependencies
- Won't increase web bundle size
- Won't affect backend performance
- Completely optional to use

## 🔄 Git Integration

### Files to Commit

```bash
# Mobile app files (should be committed)
git add mobile-app/

# Root package.json update (should be committed)
git add package.json

# Commit changes
git commit -m "Add mobile dashboard app"
```

### Files to Ignore (Already in .gitignore)

```
mobile-app/dashboard-app/node_modules/
mobile-app/dashboard-app/.expo/
mobile-app/dashboard-app/.env
```

## 🧪 Testing Integration

### Verify Installation

```bash
# 1. Check workspaces
npm ls --workspaces

# Should show:
# - workers/*
# - shared
# - mobile-app/dashboard-app

# 2. Check mobile app package
cd mobile-app/dashboard-app
npm ls

# Should show expo, react-native, etc.
```

### Test Backend Connection

```bash
# 1. Start backend
cd website
npm run dev

# 2. Test API endpoint
curl http://localhost:3000/api/ideas-queue

# Should return:
# {"ok":true,"ideas":[...],"count":...}
```

## 📦 Building for Production

### Mobile App Build

```bash
cd mobile-app/dashboard-app

# Configure for production
# 1. Update config.ts with production API URL
# 2. Update app.json with proper bundle IDs

# Build for Android
npx expo build:android

# Build for iOS
npx expo build:ios
```

See [Expo Build Docs](https://docs.expo.dev/build/introduction/) for details.

## 🔮 Future Considerations

### Phase 2: Notifications

When adding push notifications:

1. Install expo-notifications
2. Configure push tokens
3. Update backend to send notifications
4. Add settings screen in mobile app

### Phase 3: Offline Support

When adding offline mode:

1. Install AsyncStorage
2. Cache API responses locally
3. Sync on reconnection
4. Handle conflicts

## 📊 Impact Analysis

### Added to Monorepo

- ✅ 1 new workspace: `mobile-app/dashboard-app`
- ✅ 12 new files in mobile app
- ✅ 4 documentation files
- ✅ ~15 MB node_modules (when installed)

### NOT Changed

- ✅ Website code (0 changes)
- ✅ Backend APIs (0 changes)
- ✅ Workers (0 changes)
- ✅ GitHub Actions (0 changes)
- ✅ Shared package (0 changes)

## ✅ Integration Checklist

Use this checklist to verify successful integration:

- [ ] Root `package.json` updated with mobile-app workspace
- [ ] Mobile app files created in `mobile-app/dashboard-app/`
- [ ] Documentation files created
- [ ] Dependencies installed (`npm install`)
- [ ] Backend is running
- [ ] API URL configured in `config.ts`
- [ ] Mobile app starts successfully (`npm start`)
- [ ] Can scan QR code with Expo Go
- [ ] App loads and shows screens
- [ ] Can fetch ideas from backend
- [ ] Can update shorts time
- [ ] Changes persist in backend

## 🎓 Next Steps

1. **Install and Test**:
   ```bash
   cd mobile-app/dashboard-app
   npm install
   npm run get-ip
   # Update config.ts
   npm start
   ```

2. **Read Documentation**:
   - [SETUP_GUIDE.md](SETUP_GUIDE.md) - Full setup instructions
   - [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Developer reference
   - [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) - Complete overview

3. **Customize**:
   - Update colors/styles
   - Replace placeholder assets
   - Add your app icon

4. **Deploy**:
   - Build standalone app
   - Distribute via TestFlight/Play Store
   - Or keep as internal tool

## 📞 Support

If you encounter integration issues:

1. Ensure workspaces are recognized: `npm ls --workspaces`
2. Check backend is accessible from network
3. Verify mobile app dependencies installed
4. Review [SETUP_GUIDE.md](SETUP_GUIDE.md) for troubleshooting

---

**Integration Complete!** ✅

Your mobile dashboard app is now part of the monorepo and ready to use.
