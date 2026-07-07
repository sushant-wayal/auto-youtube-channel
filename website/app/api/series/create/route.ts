import { NextResponse } from 'next/server';
import { SeriesManager } from '../../../../../shared/services/series-manager';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, title, learningGoal } = body;

        if (!id || !title || !learningGoal) {
            return NextResponse.json({ error: 'id, title, and learningGoal are required' }, { status: 400 });
        }

        console.log(`Starting series initialization for ${id}...`);
        
        const manager = new SeriesManager();
        await manager.initializeSeries(id, title, learningGoal);
        await manager.close();

        return NextResponse.json({ success: true, message: `Series ${id} initialized.` });

    } catch (error: any) {
        console.error('Failed to create series:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
