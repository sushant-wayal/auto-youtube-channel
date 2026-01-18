import { NextRequest, NextResponse } from 'next/server';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL!);

const SHORTS_TIME_KEY = 'shorts:publish-time';

export async function GET() {
    try {
        const time = await redis.get(SHORTS_TIME_KEY);
        return NextResponse.json({
            ok: true,
            time: time || '16:30', // Default to 4:30 PM IST
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const { time } = await req.json();

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(time)) {
            return NextResponse.json({
                ok: false,
                error: 'Invalid time format. Use HH:MM (24-hour format)',
            }, { status: 400 });
        }

        await redis.set(SHORTS_TIME_KEY, time);

        return NextResponse.json({
            ok: true,
            time,
        });
    } catch (error: any) {
        return NextResponse.json({
            ok: false,
            error: error.message,
        }, { status: 500 });
    }
}
