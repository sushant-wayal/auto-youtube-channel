export interface LearningQueueItem {
    episodeId: string;
    topic: string;
    learningObjective: string;
    difficulty: "beginner" | "intermediate" | "advanced";
    estimatedDuration: string;
    prerequisites: string[];
    status?: "pending" | "in_progress";
}

export interface SeriesHistoryItem {
    episodeId: string;
    episodeNum: number;
    topic: string;
    videoId: string;
}

export interface SeriesState {
    id: string;
    title: string;
    learningGoal: string;
    status: "active" | "paused" | "completed";
    version: number;
    
    // Series Health Metrics
    priority: number;
    uploadCount: number;
    lastUploadTimestamp: string;
    
    // The Queue (Next 3-5 episodes)
    learningQueue: LearningQueueItem[];
    
    // Completed Episodes
    history: SeriesHistoryItem[];
}
