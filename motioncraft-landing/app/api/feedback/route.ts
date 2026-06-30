import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase() || null;
    const category = String(body.category || "General feedback").trim();
    const feedback = String(body.feedback || "").trim();
    if (feedback.length < 10 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: "Please share a little more detail and use a valid email." }, { status: 400 });
    }
    await prisma.feedback.create({ data: { email, category, feedback } });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
