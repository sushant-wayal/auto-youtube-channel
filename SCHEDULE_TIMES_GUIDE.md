# Schedule Times System

## Overview

The video generation system now supports comprehensive schedule time management for both shorts and long-form videos:

- **Shorts**: 5 ranked schedule times (best to worst performance)
- **Long-form videos**: Single dedicated schedule time

## Features

### Shorts Ranked Schedule Times

Shorts are automatically assigned publish times based on their quality ranking:

- **Rank 1 (Best)**: Highest performing time slot (default: 16:30 IST)
- **Rank 2**: Second best time slot (default: 18:00 IST)
- **Rank 3**: Third best time slot (default: 20:00 IST)
- **Rank 4**: Fourth best time slot (default: 12:00 IST)
- **Rank 5 (Worst)**: Lowest performing time slot (default: 14:00 IST)

When videos are generated, shorts are automatically assigned to these time slots based on their position/rank in the shorts array.

### Long-form Video Schedule Time

Long-form videos are scheduled to a single configurable time:
- **Default**: 18:30 IST

## Configuration

### Website Dashboard

Access schedule settings at `/dashboard`:

1. **Shorts Schedule Times**: Configure all 5 ranked times with a visual interface showing rank badges
2. **Long-Form Video Time**: Set a single time for long-form videos
3. **Save**: Apply all changes with a single "Save Schedule Times" button

### Mobile App

Access via the "Publish Schedule" tab:

1. **Shorts Section**: Shows 5 ranked times with emoji indicators (🏆 🥈 🥉 4️⃣ 5️⃣)
2. **Long-Form Section**: Large time display with edit capability
3. **Native Time Picker**: Platform-appropriate time selection (iOS spinner / Android picker)
4. **Save/Reset**: Apply changes or reset to last saved values

## API Endpoints

### GET `/api/schedule-times`

Returns current schedule times for both shorts and long-form videos.

**Response:**
```json
{
  "ok": true,
  "shortsTimes": ["16:30", "18:00", "20:00", "12:00", "14:00"],
  "longFormTime": "18:30"
}
```

### POST `/api/schedule-times`

Update schedule times (supports partial updates).

**Request Body:**
```json
{
  "shortsTimes": ["16:30", "18:00", "20:00", "12:00", "14:00"],
  "longFormTime": "18:30"
}
```

**Response:**
```json
{
  "ok": true,
  "shortsTimes": ["16:30", "18:00", "20:00", "12:00", "14:00"],
  "longFormTime": "18:30"
}
```

## Shared Service Functions

Located in `shared/services/shorts-publish-time-service.ts`:

### Shorts Functions

```typescript
// Get all 5 ranked times
await getShortsPublishTimes(): Promise<string[]>

// Set all 5 ranked times
await setShortsPublishTimes(times: string[]): Promise<void>

// Get time by rank (0-4)
await getShortsPublishTimeByRank(rank: number): Promise<string>
```

### Long-form Functions

```typescript
// Get long-form video time
await getLongFormPublishTime(): Promise<string>

// Set long-form video time
await setLongFormPublishTime(time: string): Promise<void>
```

### Legacy Functions (Deprecated)

```typescript
// Still supported for backwards compatibility
await getShortsPublishTime(): Promise<string>  // Returns best time
await setShortsPublishTime(time: string): Promise<void>  // Sets best time only
```

## Worker Integration

### auto-video-generation-and-upload

The worker automatically:

1. **Long-form videos**: Fetches configured long-form time and schedules accordingly
2. **Shorts**: Assigns each short to a ranked time based on its position
   - First short → Rank 1 (best time)
   - Second short → Rank 2
   - ...up to Rank 5

Example output:
```
📅 Scheduling long-form video for 18:30 IST
📤 Scheduling short 1 (Rank 1) for 16:30 IST
📤 Scheduling short 2 (Rank 2) for 18:00 IST
📤 Scheduling short 3 (Rank 3) for 20:00 IST
```

## Redis Storage

Schedule times are stored in Redis:

- **Shorts times**: `shorts:publish-times` (JSON array of 5 strings)
- **Long-form time**: `longform:publish-time` (string)
- **Legacy key**: `shorts:publish-time` (deprecated, maintained for backwards compatibility)

## Time Format

All times use **HH:MM format in 24-hour notation** (e.g., "16:30", "18:00").

Times are stored as **Indian Standard Time (IST)** and converted to UTC when scheduling YouTube uploads.

## Migration Notes

### From Old System

The old system only supported a single shorts publish time. The new system:

1. Maintains backwards compatibility via deprecated functions
2. Uses the old time as Rank 1 (best) if migrating
3. Falls back to default ranked times if no configuration exists

### API Changes

- Old API `/api/shorts-publish-time` still works
- New API `/api/schedule-times` provides unified access
- Mobile app updated to use new unified API
- Website updated to manage all schedule times

## Benefits

1. **Performance Optimization**: Assign best content to best-performing time slots
2. **Flexibility**: Different schedules for shorts vs long-form content
3. **Automatic Assignment**: No manual time setting per video
4. **Easy Management**: Single interface to control all schedule times
5. **Analytics-Driven**: Adjust time rankings based on performance data

## Future Enhancements

Potential improvements:

- Day-of-week specific schedules
- Automatic time optimization based on analytics
- Timezone support for international audiences
- A/B testing different time slots
- Holiday/special event scheduling
