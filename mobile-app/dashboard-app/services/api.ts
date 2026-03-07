import { API_BASE_URL } from '../config';

// Pipeline Status API Types
export type JobResult = 'success' | 'failure' | 'skipped' | 'cancelled' | null;

export type PipelineStatus = {
    overallStatus: 'success' | 'failure';
    ranAt: string; // ISO timestamp
    videoId: string;
    videoTitle: string;
    youtubeId?: string;
    jobs: {
        populateIdeas: JobResult;
        generateScript: JobResult;
        renderScenes: JobResult;
        generateVoiceover: JobResult;
        assembleLongForm: JobResult;
        generateThumbnail: JobResult;
        uploadYoutube: JobResult;
        shortsProcessing: JobResult;
    };
};

export type PipelineStatusResponse = {
    ok: boolean;
    status?: PipelineStatus;
    error?: string;
};

export type SavePushTokenResponse = {
    ok: boolean;
    error?: string;
};

// Helper function for fetch with timeout and better error handling
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(id);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
};

// Ideas Queue API Types
export type IdeasQueue = {
    ideas: string[];
    count: number;
};

export type IdeasQueueResponse = {
    ok: boolean;
    ideas: string[];
    count: number;
    error?: string;
};

// Shorts Publish Time API Types
export type ShortsPublishTimeResponse = {
    ok: boolean;
    time?: string;
    error?: string;
};

// Schedule Times API Types
export type ScheduleTimesResponse = {
    ok: boolean;
    shortsTimes?: string[];
    longFormTime?: string;
    error?: string;
};

// Ideas Queue API
export const ideasApi = {
    // Get all ideas
    getIdeas: async (): Promise<IdeasQueueResponse> => {
        try {
            console.log('[API] Fetching ideas from:', `${API_BASE_URL}/api/ideas-queue`);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/ideas-queue`);
            const data = await response.json();
            console.log('[API] Ideas fetched successfully:', data);
            return data;
        } catch (error: any) {
            console.error('[API] Error fetching ideas:', error.message || error);
            return {
                ok: false,
                ideas: [],
                count: 0,
                error: error.message || String(error)
            };
        }
    },

    // Add a new idea
    addIdea: async (idea: string): Promise<IdeasQueueResponse> => {
        try {
            console.log('[API] Adding idea:', idea);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/ideas-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', idea }),
            });
            const data = await response.json();
            console.log('[API] Idea added successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error adding idea:', error.message || error);
            return {
                ok: false,
                ideas: [],
                count: 0,
                error: error.message || String(error)
            };
        }
    },

    // Edit an existing idea
    editIdea: async (index: number, idea: string): Promise<IdeasQueueResponse> => {
        try {
            console.log('[API] Editing idea at index:', index);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/ideas-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'edit', index, idea }),
            });
            const data = await response.json();
            console.log('[API] Idea edited successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error editing idea:', error.message || error);
            return {
                ok: false,
                ideas: [],
                count: 0,
                error: error.message || String(error)
            };
        }
    },

    // Remove an idea
    removeIdea: async (index: number): Promise<IdeasQueueResponse> => {
        try {
            console.log('[API] Removing idea at index:', index);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/ideas-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', index }),
            });
            const data = await response.json();
            console.log('[API] Idea removed successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error removing idea:', error.message || error);
            return {
                ok: false,
                ideas: [],
                count: 0,
                error: error.message || String(error)
            };
        }
    },

    // Move an idea
    moveIdea: async (index: number, newIndex: number): Promise<IdeasQueueResponse> => {
        try {
            console.log('[API] Moving idea from', index, 'to', newIndex);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/ideas-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'move', index, newIndex }),
            });
            const data = await response.json();
            console.log('[API] Idea moved successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error moving idea:', error.message || error);
            return {
                ok: false,
                ideas: [],
                count: 0,
                error: error.message || String(error)
            };
        }
    },

    // Clear all ideas
    clearIdeas: async (): Promise<IdeasQueueResponse> => {
        try {
            console.log('[API] Clearing all ideas');
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/ideas-queue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear' }),
            });
            const data = await response.json();
            console.log('[API] Ideas cleared successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error clearing ideas:', error.message || error);
            return {
                ok: false,
                ideas: [],
                count: 0,
                error: error.message || String(error)
            };
        }
    },
};

// Shorts Publish Time API
export const shortsApi = {
    // Get current publish time
    getPublishTime: async (): Promise<ShortsPublishTimeResponse> => {
        try {
            console.log('[API] Fetching publish time from:', `${API_BASE_URL}/api/shorts-publish-time`);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/shorts-publish-time`);
            const data = await response.json();
            console.log('[API] Publish time fetched successfully:', data);
            return data;
        } catch (error: any) {
            console.error('[API] Error fetching publish time:', error.message || error);
            return {
                ok: false,
                error: error.message || String(error)
            };
        }
    },

    // Update publish time
    updatePublishTime: async (time: string): Promise<ShortsPublishTimeResponse> => {
        try {
            console.log('[API] Updating publish time to:', time);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/shorts-publish-time`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time }),
            });
            const data = await response.json();
            console.log('[API] Publish time updated successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error updating publish time:', error.message || error);
            return {
                ok: false,
                error: error.message || String(error)
            };
        }
    },
};

// Schedule Times API (New unified API for both shorts and long-form)
export const scheduleTimesApi = {
    // Get all schedule times (shorts ranked times + long-form time)
    getScheduleTimes: async (): Promise<ScheduleTimesResponse> => {
        try {
            console.log('[API] Fetching schedule times from:', `${API_BASE_URL}/api/schedule-times`);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/schedule-times`);
            const data = await response.json();
            console.log('[API] Schedule times fetched successfully:', data);
            return data;
        } catch (error: any) {
            console.error('[API] Error fetching schedule times:', error.message || error);
            return {
                ok: false,
                error: error.message || String(error)
            };
        }
    },

    // Update shorts times (array of 5 ranked times)
    updateShortsTimes: async (shortsTimes: string[]): Promise<ScheduleTimesResponse> => {
        try {
            console.log('[API] Updating shorts times:', shortsTimes);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/schedule-times`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shortsTimes }),
            });
            const data = await response.json();
            console.log('[API] Shorts times updated successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error updating shorts times:', error.message || error);
            return {
                ok: false,
                error: error.message || String(error)
            };
        }
    },

    // Update long-form time
    updateLongFormTime: async (longFormTime: string): Promise<ScheduleTimesResponse> => {
        try {
            console.log('[API] Updating long-form time:', longFormTime);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/schedule-times`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ longFormTime }),
            });
            const data = await response.json();
            console.log('[API] Long-form time updated successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error updating long-form time:', error.message || error);
            return {
                ok: false,
                error: error.message || String(error)
            };
        }
    },

    // Update both shorts and long-form times
    updateAllScheduleTimes: async (shortsTimes: string[], longFormTime: string): Promise<ScheduleTimesResponse> => {
        try {
            console.log('[API] Updating all schedule times');
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/schedule-times`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shortsTimes, longFormTime }),
            });
            const data = await response.json();
            console.log('[API] All schedule times updated successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error updating all schedule times:', error.message || error);
            return {
                ok: false,
                error: error.message || String(error)
            };
        }
    },
};

// Pipeline Status API
export const pipelineApi = {
    // Save Expo push token so server can send notifications
    savePushToken: async (token: string): Promise<SavePushTokenResponse> => {
        try {
            console.log('[API] Saving push token');
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/push-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await response.json();
            console.log('[API] Push token saved successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error saving push token:', error.message || error);
            return { ok: false, error: error.message || String(error) };
        }
    },

    // Get latest pipeline run status
    getPipelineStatus: async (): Promise<PipelineStatusResponse> => {
        try {
            console.log('[API] Fetching pipeline status from:', `${API_BASE_URL}/api/pipeline-status`);
            const response = await fetchWithTimeout(`${API_BASE_URL}/api/pipeline-status`, {}, 15000);
            const data = await response.json();
            console.log('[API] Pipeline status fetched successfully');
            return data;
        } catch (error: any) {
            console.error('[API] Error fetching pipeline status:', error.message || error);
            return { ok: false, error: error.message || String(error) };
        }
    },
};
