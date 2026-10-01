# Serenity Mobile App

A React Native mobile app for managing video ideas and shorts scheduling.

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

## Over-The-Air (OTA) Updates & CI/CD

An automated CI/CD pipeline is configured in `.github/workflows/serenity-ota-update.yml` to publish Over-The-Air updates using Expo EAS Update whenever changes are made to the Serenity app.

### Branch Mapping

- **Main Branch Updates**: Pushes to the `main` branch affecting `mobile-app/serenity/**` automatically publish updates to **both** the `preview` and `production` EAS update branches.
- **Preview Updates**: Pushes to the `preview` branch affecting `mobile-app/serenity/**` publish an update to the `preview` EAS update branch.
- **Production Updates**: Pushes to the `production` branch affecting `mobile-app/serenity/**` publish an update to the `production` EAS update branch.
- **Manual Trigger**: The pipeline can also be triggered on demand via GitHub Actions (`workflow_dispatch`), allowing you to deploy to `both (preview & production)`, `preview`, or `production` with a custom message.

### Required Secrets

To enable the pipeline, configure the following secret in your GitHub repository:
- **`EXPO_TOKEN`**: An Expo Access Token generated from your [Expo Access Tokens Dashboard](https://expo.dev/settings/access-tokens).

### Local EAS Update Commands

```bash
# Update preview branch
npm run update:preview "Update description"

# Update production branch
npm run update:production "Update description"
```

## Future Enhancements (Not Implemented Yet)

- Push notifications for job status
- Settings screen for notification preferences
- Offline support with local caching

