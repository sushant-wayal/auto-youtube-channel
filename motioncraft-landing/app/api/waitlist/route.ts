import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const validProfessions = ["YouTuber", "Developer", "Educator", "Student", "Startup", "Other"];
const validWorkflows = ["Manual editing", "Canva", "After Effects", "CapCut", "AI tools", "Other"];
const validPlans = ["Explorer", "Creator", "Pro", "Free plan", "None"];
const validObjections = [
  "I want to see the output quality first.",
  "It's too expensive.",
  "I don't make enough videos.",
  "I already use another tool.",
  "I don't trust a new product yet.",
  "Other",
];
const validUseCases = [
  "Programming & Computer Science", "AI & Machine Learning", "Education & Online Courses",
  "Science", "Finance & Investing", "Startup/Product Explainers", "Marketing Videos",
  "Company Training", "Design", "Social Media Content", "YouTube Automation",
  "Documentation", "Gaming", "History & Geography", "Mathematics", "Other",
];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const profession = String(body.profession || "");
    const currentWorkflow = String(body.currentWorkflow || "");
    const painPoint = String(body.painPoint || "").trim();
    const selectedPlan = String(body.selectedPlan || "");
    const paymentObjection = String(body.paymentObjection || "");
    const paymentObjectionOther = String(body.paymentObjectionOther || "").trim() || null;
    const primaryUseCaseOther = String(body.primaryUseCaseOther || "").trim() || null;
    const primaryUseCases = Array.isArray(body.primaryUseCases)
      ? body.primaryUseCases.map((value: unknown) => String(value).trim())
      : [];
    const uniqueUseCases = Array.from(new Set<string>(primaryUseCases));

    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || painPoint.length < 10) {
      return NextResponse.json({ error: "Please complete every field with valid information." }, { status: 400 });
    }
    if (
      !validProfessions.includes(profession) ||
      !validWorkflows.includes(currentWorkflow) ||
      !validPlans.includes(selectedPlan) ||
      !validObjections.includes(paymentObjection)
    ) {
      return NextResponse.json({ error: "Please select a valid option." }, { status: 400 });
    }
    if (
      primaryUseCases.length !== uniqueUseCases.length ||
      uniqueUseCases.length < 1 ||
      uniqueUseCases.length > 3 ||
      uniqueUseCases.some((value) => !validUseCases.includes(value))
    ) {
      return NextResponse.json({ error: "Choose between one and three valid use cases." }, { status: 400 });
    }
    if (paymentObjection === "Other" && !paymentObjectionOther) {
      return NextResponse.json({ error: "Please tell us what is preventing you from paying." }, { status: 400 });
    }
    if (uniqueUseCases.includes("Other") && !primaryUseCaseOther) {
      return NextResponse.json({ error: "Please describe your other primary use case." }, { status: 400 });
    }

    await prisma.waitlistEntry.create({
      data: {
        name, email, profession, currentWorkflow, painPoint, selectedPlan, paymentObjection,
        paymentObjectionOther: paymentObjection === "Other" ? paymentObjectionOther : null,
        primaryUseCases: uniqueUseCases,
        primaryUseCaseOther: uniqueUseCases.includes("Other") ? primaryUseCaseOther : null,
      },
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error: unknown) {
    const duplicate = typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
    return NextResponse.json(
      { error: duplicate ? "You’re already on the waitlist — we’ll be in touch." : "Something went wrong. Please try again." },
      { status: duplicate ? 409 : 500 },
    );
  }
}
