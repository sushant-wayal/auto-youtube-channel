import { NextRequest, NextResponse } from 'next/server';
import { CommentStateService } from '@/lib/comment-reply/comment-state-service';

export async function GET() {
    try {
        const stateService = new CommentStateService();
        const settings = await stateService.getSettings();
        await stateService.close();

        return NextResponse.json({
            ok: true,
            settings,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                ok: false,
                error: error?.message || 'Failed to fetch comment reply settings',
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const stateService = new CommentStateService();
        const updated = await stateService.updateSettings(body);
        await stateService.close();

        return NextResponse.json({
            ok: true,
            settings: updated,
        });
    } catch (error: any) {
        return NextResponse.json(
            {
                ok: false,
                error: error?.message || 'Failed to update comment reply settings',
            },
            { status: 500 }
        );
    }
}
