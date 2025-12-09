import { NextRequest, NextResponse } from "next/server";
import VideoGenerationPipeline from "@/lib/pipeline";

// Mock script for testing when Gemini API is overloaded
const MOCK_SCRIPT = {
    title: "The Ultimate Guide to Modern Web Development",
    description: "Explore the latest trends and best practices in modern web development, from React to Next.js, TypeScript, and beyond.",
    tags: [
        "web development",
        "react",
        "nextjs",
        "typescript",
        "javascript",
        "frontend",
        "programming",
        "coding"
    ],
    narration: `Welcome to the ultimate guide to modern web development. In this video, we'll explore the cutting-edge technologies that are shaping the future of the web.

React has revolutionized how we build user interfaces. With its component-based architecture and virtual DOM, developers can create fast, scalable applications with ease. The React ecosystem continues to grow, offering powerful tools and libraries for every need.

TypeScript has become the go-to choice for large-scale applications. By adding static typing to JavaScript, TypeScript helps catch errors early and makes code more maintainable. Modern development teams are increasingly adopting TypeScript for its robust type system and excellent developer experience.

Next.js takes React development to the next level with server-side rendering, static site generation, and built-in optimization. The framework simplifies complex tasks like routing, code splitting, and image optimization, allowing developers to focus on building great user experiences.

Modern web development also emphasizes performance and user experience. Techniques like lazy loading, code splitting, and progressive web apps ensure that applications load quickly and work seamlessly across all devices.

The developer tooling ecosystem has never been better. From powerful IDEs to automated testing frameworks, developers have access to tools that dramatically improve productivity and code quality.

Cloud platforms and serverless architectures are changing how we deploy and scale applications. With services like Vercel, AWS, and Google Cloud, deploying production-ready applications has never been easier.

As we look to the future, technologies like WebAssembly, edge computing, and AI-powered development tools promise to push the boundaries of what's possible on the web. The modern web development landscape is exciting, dynamic, and full of opportunities for innovation.`,
    shorts: [
        {
            hook: "React changed everything about web development!",
            script: "React introduced component-based architecture that revolutionized UI development. Learn why millions of developers choose React for building modern web applications."
        },
        {
            hook: "TypeScript: JavaScript's superpower!",
            script: "TypeScript adds static typing to JavaScript, catching errors before they reach production. Discover why TypeScript is the secret weapon of professional developers."
        },
        {
            hook: "Next.js makes React development incredible!",
            script: "Next.js combines server-side rendering with React to create blazing-fast applications. See how Next.js simplifies complex web development challenges."
        }
    ]
};

export async function POST(request: NextRequest) {
    try {
        const { videoIdea } = await request.json();

        if (!videoIdea || typeof videoIdea !== "string") {
            return NextResponse.json(
                { error: "Video idea is required" },
                { status: 400 }
            );
        }

        console.log("📝 Script generation requested for:", videoIdea);

        // Check if we should use mock data (set USE_MOCK_SCRIPT=true in .env.local to enable)
        const useMock = process.env.USE_MOCK_SCRIPT === "true";

        if (useMock) {
            console.log("🎭 Using MOCK script (Gemini API bypassed)");
            console.log("   To use real AI: remove USE_MOCK_SCRIPT from .env.local");

            // Add a small delay to simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

            return NextResponse.json({ script: MOCK_SCRIPT });
        }

        // Real AI generation
        console.log("🤖 Using Gemini AI for script generation");
        const pipeline = new VideoGenerationPipeline();
        const script = await pipeline.generateScriptOnly(videoIdea);

        return NextResponse.json({ script });
    } catch (error) {
        console.error("Script generation error:", error);

        // Fallback to mock if AI fails
        console.log("⚠️ AI generation failed, falling back to MOCK script");
        return NextResponse.json({ script: MOCK_SCRIPT });
    }
}
