import { API_BASE_URL } from '../config';

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
