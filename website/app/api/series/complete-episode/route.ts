import { NextResponse } from 'next/server';
import { SeriesManager } from '../../../../../shared/services/series-manager';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { seriesId, episodeId, topic, videoId } = body;

        if (!seriesId || !episodeId || !topic || !videoId) {
            return NextResponse.json({ error: 'seriesId, episodeId, topic, and videoId are required' }, { status: 400 });
        }

        console.log(`Triggering completion logic for series ${seriesId}, episode: ${episodeId}`);
        
        const manager = new SeriesManager();
        
        // Fire and forget since AI expansion could take 10-20 seconds
        manager.completeEpisode(seriesId, episodeId, topic, videoId)
            .then(async () => {
                console.log('Worker completion finished successfully.');
                await manager.close();
            })
            .catch(async (err) => {
                console.error('Worker completion error:', err);
                await manager.close();
            });

        return NextResponse.json({ success: true, message: `Completion trigger accepted for ${seriesId}.` });

    } catch (error: any) {
        console.error('Failed to trigger completion:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
