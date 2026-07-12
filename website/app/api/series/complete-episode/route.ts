import { NextResponse } from 'next/server';
import { SeriesManager } from '@/lib/series-manager';

export const maxDuration = 60; // Allow enough time for AI queue expansion

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { seriesId, episodeId, topic, videoId } = body;

        if (!seriesId || !episodeId || !topic || !videoId) {
            return NextResponse.json({ error: 'seriesId, episodeId, topic, and videoId are required' }, { status: 400 });
        }

        console.log(`Triggering completion logic for series ${seriesId}, episode: ${episodeId}`);
        
        const manager = new SeriesManager();
        
        await manager.completeEpisode(seriesId, episodeId, topic, videoId);
        console.log('Worker completion finished successfully.');
        await manager.close();

        return NextResponse.json({ success: true, message: `Completion trigger accepted for ${seriesId}.` });

    } catch (error: any) {
        console.error('Failed to trigger completion:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
