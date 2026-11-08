import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    if (process.env.DISABLE_AUTH === "true" || !process.env.GOOGLE_CLIENT_ID) {
        return NextResponse.next();
    }
    return (auth as any)(request);
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
