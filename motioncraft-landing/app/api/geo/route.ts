import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = new Headers(request.headers);
  const country = (
    headers.get("x-vercel-ip-country") ||
    headers.get("cf-ipcountry") ||
    headers.get("x-country-code") ||
    ""
  ).toUpperCase();

  const isIndia = country === "IN";

  return NextResponse.json({
    country,
    currency: isIndia ? "INR" : country ? "USD" : null,
    isIndia,
  });
}

