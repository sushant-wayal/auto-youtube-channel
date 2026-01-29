# Mobile Dashboard App - Quick Reference

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd mobile-app/dashboard-app
npm install

# 2. Update API URL in config.ts
# Change: export const API_BASE_URL = 'http://YOUR_LOCAL_IP:3000';

# 3. Start backend (in another terminal)
cd ../../website
npm run dev

# 4. Start mobile app
cd ../../mobile-app/dashboard-app
npm start

# 5. Scan QR code with Expo Go app
```

## 📁 File Structure

```
mobile-app/dashboard-app/
├── 📄 App.tsx                     # Entry point + navigation
├── ⚙️ config.ts                   # API URL (MODIFY THIS)
├── 📦 package.json                # Dependencies
│
├── 🎨 screens/                    # Main app screens
│   ├── IdeasScreen.tsx            # Ideas CRUD
│   └── ShortsScheduleScreen.tsx   # Schedule management
│
├── 🧩 components/                 # Reusable components
│   ├── ErrorMessage.tsx           # Error display
│   ├── EmptyState.tsx             # Empty state UI
│   └── LoadingSpinner.tsx         # Loading indicator
│
└── 🔌 services/                   # API layer
    └── api.ts                     # Backend API calls
```

## 🎯 Features Implemented

### Ideas Screen
- ✅ List all ideas
- ✅ Add new idea
- ✅ Edit idea (inline)
- ✅ Delete idea (with confirmation)
- ✅ Reorder ideas (up/down buttons)
- ✅ Clear all ideas (with confirmation)
- ✅ Pull to refresh
- ✅ Empty state, loading state, error handling

### Shorts Schedule Screen
- ✅ View current publish time (IST)
- ✅ Update publish time
- ✅ Time validation (HH:MM, 24-hour format)
- ✅ Quick preset buttons (9 AM, 12 PM, 4:30 PM, 8 PM)
- ✅ Pull to refresh
- ✅ Success feedback
- ✅ Loading state, error handling

## 🛠️ Tech Stack

- **Framework**: Expo + React Native
- **Language**: TypeScript
- **Navigation**: React Navigation (bottom tabs)
- **State Management**: React hooks (useState, useEffect)
- **Styling**: StyleSheet (React Native)
- **API**: Fetch API

## 📱 Screens & Navigation

```
┌─────────────────────────────────┐
│     Video Ideas Queue           │  ← Ideas Tab (default)
│  - Add/Edit/Delete ideas        │
│  - Reorder with arrows          │
│  - Pull to refresh              │
└─────────────────────────────────┘
           │
    Tab Navigation
           │
┌─────────────────────────────────┐
│   Shorts Publish Time           │  ← Schedule Tab
│  - View current time            │
│  - Update time (HH:MM)          │
│  - Quick presets                │
└─────────────────────────────────┘
```

## 🔧 Key Components

### API Service (services/api.ts)
```typescript
// Ideas API
ideasApi.getIdeas()
ideasApi.addIdea(idea: string)
ideasApi.editIdea(index: number, idea: string)
ideasApi.removeIdea(index: number)
ideasApi.moveIdea(index: number, newIndex: number)
ideasApi.clearIdeas()

// Shorts API
shortsApi.getPublishTime()
shortsApi.updatePublishTime(time: string)
```

### Configuration (config.ts)
```typescript
export const API_BASE_URL = 'http://192.168.1.100:3000';
```

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Network request failed" | Check API_BASE_URL in config.ts |
| Backend not connecting | Ensure device & computer on same WiFi |
| Changes not reflecting | Press `r` in terminal to reload |
| Module resolution error | Run `npm install` again |
| QR code not working | Use Expo Go app, not camera |

## 📋 API Endpoints

### Ideas Queue
- **GET** `/api/ideas-queue` → `{ ok, ideas[], count }`
- **POST** `/api/ideas-queue` → `{ action, idea?, index?, newIndex? }`
  - Actions: `add`, `edit`, `remove`, `move`, `clear`

### Shorts Time
- **GET** `/api/shorts-publish-time` → `{ ok, time }`
- **POST** `/api/shorts-publish-time` → `{ time }`

## 🎨 Styling Guidelines

The app uses a clean, utilitarian design:

- **Primary Color**: `#007AFF` (iOS blue)
- **Success**: `#28a745` (green)
- **Error**: `#dc3545` (red)
- **Warning**: `#6c757d` (gray)
- **Background**: `#f5f5f5` (light gray)
- **Card**: `#fff` (white)

## 🚫 What's NOT Included (By Design)

- No Redux/MobX (keeping it simple)
- No push notifications (planned for future)
- No authentication (personal/internal use)
- No offline caching (planned for future)
- No complex animations (fast & clean)
- No job status/logs (not in scope)
- No pipeline views (not in scope)

## 📝 Development Tips

### Hot Reload
- Save file → Auto reload ✅
- Press `r` → Manual reload
- Press `Shift+R` → Reload + clear cache

### Debugging
- Shake device → Debug menu
- `console.log()` → Shows in terminal
- Red screen → JavaScript error
- Yellow box → Warning

### Code Organization
- **Screens**: Full-page views with business logic
- **Components**: Reusable UI pieces (stateless preferred)
- **Services**: API calls and external integrations
- **Config**: Environment-specific settings

### Best Practices
- ✅ Functional components only
- ✅ Use hooks (useState, useEffect)
- ✅ Keep components small and focused
- ✅ Handle loading, error, and empty states
- ✅ Provide user feedback (alerts, messages)
- ✅ Use TypeScript types
- ❌ No class components
- ❌ No inline styles (use StyleSheet)
- ❌ No over-engineering

## 🔄 Workflow

### Adding a New Screen
1. Create `screens/NewScreen.tsx`
2. Add to navigation in `App.tsx`
3. Create API functions in `services/api.ts` if needed
4. Test on device

### Adding a New Feature
1. Update API service if needed
2. Add UI in appropriate screen
3. Add state management (useState)
4. Handle loading/error states
5. Test thoroughly

## 📦 Dependencies

### Core
- `expo` - Development framework
- `react-native` - Mobile framework
- `react` - UI library

### Navigation
- `@react-navigation/native` - Navigation library
- `@react-navigation/bottom-tabs` - Tab navigation
- `react-native-screens` - Native screens
- `react-native-safe-area-context` - Safe area handling

### Development
- `typescript` - Type safety
- `@types/react` - React type definitions
- `@babel/core` - JavaScript compiler

## 🏗️ Build Commands

```bash
# Development
npm start                    # Start dev server
npm run android             # Run on Android
npm run ios                 # Run on iOS

# Production
npx expo build:android      # Build APK
npx expo build:ios          # Build IPA
```

## 🔮 Future Enhancements (Roadmap)

### Phase 2 (Planned)
- [ ] Push notifications for job status
- [ ] Settings screen
- [ ] Dark mode toggle
- [ ] Offline support

### Phase 3 (Ideas)
- [ ] Biometric authentication
- [ ] Ideas search/filter
- [ ] Batch operations
- [ ] Export/import ideas
- [ ] Analytics dashboard

## 📞 Finding Your Local IP

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig

# Node.js method
node -e "console.log(require('os').networkInterfaces()['en0'][1].address)"
```

## ✅ Pre-deployment Checklist

Before releasing:
- [ ] Update API_BASE_URL to production backend
- [ ] Replace placeholder assets (icon.png, splash.png)
- [ ] Test on real devices (iOS + Android)
- [ ] Update app.json (name, version, bundle IDs)
- [ ] Configure signing certificates
- [ ] Test offline behavior
- [ ] Review error messages
- [ ] Check for console warnings
- [ ] Update README.md

---

**Need help?** Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions.
