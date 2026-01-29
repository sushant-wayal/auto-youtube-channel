# Dashboard Mobile App

A React Native mobile dashboard for managing video ideas and shorts scheduling.

## Features

- **Ideas Management**: Add, edit, delete, and reorder video ideas
- **Shorts Scheduling**: View and update the daily publish time for shorts

## Prerequisites

- Node.js (v18 or higher)
- Expo CLI
- A mobile device or emulator
- Backend API running (from the website folder)

## Setup

1. **Install dependencies**:
   ```bash
   cd mobile-app/dashboard-app
   npm install
   ```

2. **Configure API URL**:
   - Open `config.ts`
   - Update `API_BASE_URL` with your backend URL
   - For local development, use your machine's local IP (not `localhost`)
   - Example: `http://192.168.1.100:3000`

   To find your local IP:
   - macOS/Linux: `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: `ipconfig`

3. **Start the backend**:
   ```bash
   # In the website folder
   cd ../../website
   npm run dev
   ```

4. **Start the mobile app**:
   ```bash
   # In mobile-app/dashboard-app folder
   npm start
   ```

5. **Run on device**:
   - Scan the QR code with Expo Go app (iOS/Android)
   - Or press `i` for iOS simulator
   - Or press `a` for Android emulator

## Project Structure

```
mobile-app/dashboard-app/
├── App.tsx                 # Main app with navigation
├── config.ts              # API configuration
├── components/            # Reusable UI components
│   ├── ErrorMessage.tsx
│   ├── EmptyState.tsx
│   └── LoadingSpinner.tsx
├── screens/              # App screens
│   ├── IdeasScreen.tsx
│   └── ShortsScheduleScreen.tsx
└── services/             # API service functions
    └── api.ts
```

## API Endpoints Used

- `GET /api/ideas-queue` - Fetch all ideas
- `POST /api/ideas-queue` - Add, edit, delete, move, or clear ideas
- `GET /api/shorts-publish-time` - Get current publish time
- `POST /api/shorts-publish-time` - Update publish time

## Development Notes

- Uses functional components and React hooks
- No state management library (Redux/MobX) - keeping it simple
- Clean, utilitarian UI focused on speed and clarity
- Pull-to-refresh on both screens
- Proper loading, error, and empty states

## Future Enhancements (Not Implemented Yet)

- Push notifications for job status
- Settings screen for notification preferences
- Offline support with local caching
