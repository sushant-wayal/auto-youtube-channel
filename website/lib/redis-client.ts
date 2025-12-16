// lib/redis-client.ts
// Client-side service to interact with Redis-backed job queue via API endpoints

export type JobType = 'voiceover' | 'assets' | 'assembly' | 'youtube-upload' | 'auto-video-generation-and-upload';

export interface CreateJobPayload {
    jobType: JobType;
    videoId: string;
    payload: any;
}

export interface JobStatus {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number; // 0-100
    message?: string;
    result?: any;
    error?: string;
}

export async function createJob(payload: CreateJobPayload): Promise<{ jobId: string }> {
    const response = await fetch('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Failed to create job');
    return response.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
    if (!response.ok) throw new Error('Failed to fetch job status');
    return response.json();
}
