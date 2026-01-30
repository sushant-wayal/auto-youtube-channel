# Quick Reference: Schedule Times System

## API Endpoints

### Get All Schedule Times
```bash
GET /api/schedule-times
```
Returns: `{ ok, shortsTimes: string[], longFormTime: string }`

### Update Schedule Times
```bash
POST /api/schedule-times
Body: { 
  shortsTimes?: ["16:30", "18:00", "20:00", "12:00", "14:00"],
  longFormTime?: "18:30"
}
```

## Service Functions

```typescript
import { 
  getShortsPublishTimes,
  setShortsPublishTimes,
  getShortsPublishTimeByRank,
  getLongFormPublishTime,
  setLongFormPublishTime
} from '../shared/services/shorts-publish-time-service';

// Get all 5 shorts times (ranked)
const times = await getShortsPublishTimes(); // ['16:30', '18:00', ...]

// Get time by rank (0-4)
const bestTime = await getShortsPublishTimeByRank(0); // '16:30'

// Get long-form time
const longTime = await getLongFormPublishTime(); // '18:30'

// Update shorts times
await setShortsPublishTimes(['16:30', '18:00', '20:00', '12:00', '14:00']);

// Update long-form time
await setLongFormPublishTime('18:30');
```

## Default Times

**Shorts (Ranked Best → Worst):**
1. 🏆 Rank 1: `16:30` IST (4:30 PM)
2. 🥈 Rank 2: `18:00` IST (6:00 PM)
3. 🥉 Rank 3: `20:00` IST (8:00 PM)
4. 4️⃣ Rank 4: `12:00` IST (12:00 PM)
5. 5️⃣ Rank 5: `14:00` IST (2:00 PM)

**Long-form:**
- `18:30` IST (6:30 PM)

## Usage in Workers

```typescript
import { getShortsPublishTimeByRank, getLongFormPublishTime } from '../../../shared';

// For shorts (rank-based)
for (let i = 0; i < shorts.length; i++) {
  const rank = Math.min(i, 4); // Cap at rank 4
  const time = await getShortsPublishTimeByRank(rank);
  // Use time for scheduling...
}

// For long-form videos
const longFormTime = await getLongFormPublishTime();
// Use time for scheduling...
```

## Mobile App API

```typescript
import { scheduleTimesApi } from './services/api';

// Get times
const { ok, shortsTimes, longFormTime } = await scheduleTimesApi.getScheduleTimes();

// Update shorts only
await scheduleTimesApi.updateShortsTimes(['16:30', '18:00', '20:00', '12:00', '14:00']);

// Update long-form only
await scheduleTimesApi.updateLongFormTime('18:30');

// Update all
await scheduleTimesApi.updateAllScheduleTimes(shortsTimes, longFormTime);
```

## Redis Keys

- `shorts:publish-times` - JSON array of 5 times
- `longform:publish-time` - Single time string
- `shorts:publish-time` - Legacy (deprecated)

## Time Format

- Format: `HH:MM` (24-hour)
- Timezone: IST (Indian Standard Time)
- Examples: `16:30`, `18:00`, `20:00`
- Validation: `/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/`

## UI Access

**Website:** `/dashboard` → Scroll to schedule sections  
**Mobile App:** "Publish Schedule" tab

## Files Changed

1. `shared/services/shorts-publish-time-service.ts` - Core service
2. `website/app/api/schedule-times/route.ts` - API endpoint
3. `website/app/dashboard/DashboardClient.tsx` - Web UI
4. `mobile-app/dashboard-app/screens/ScheduleTimesScreen.tsx` - Mobile UI
5. `mobile-app/dashboard-app/services/api.ts` - Mobile API
6. `mobile-app/dashboard-app/App.tsx` - Navigation
7. `workers/auto-video-generation-and-upload/src/index.ts` - Worker logic
8. `shared/index.ts` - Exports
