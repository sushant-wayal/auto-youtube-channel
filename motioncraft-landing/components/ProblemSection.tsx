"use client";

import { trackEvent } from "@/lib/analytics";

const FRAGMENTED_TOOLS = [
  {
    step: "01",
    task: "Ideation & Topic Research",
    manualTools: "Notion, Google Docs, Reddit threads, Twitter saves",
    friction: "Ideas scatter everywhere; no curriculum structure or series progression.",
  },
  {
    step: "02",
    task: "Scriptwriting & Scene Outlining",
    manualTools: "ChatGPT, Claude, manual text rewriting",
    friction: "Unstructured walls of text with zero timing synchronization for visuals.",
  },
  {
    step: "03",
    task: "Voiceover Production",
    manualTools: "ElevenLabs, Audacity, manual audio cuts",
    friction: "Pacing drift, misaligned timestamps, and constant audio re-rendering.",
  },
  {
    step: "04",
    task: "Visual Asset Collection & Motion Rendering",
    manualTools: "Storyblocks, Canva, After Effects, Remotion",
    friction: "Hours lost searching for relevant visuals and rendering keyframes.",
  },
  {
    step: "05",
    task: "Timeline Editing & Assembly",
    manualTools: "Premiere Pro, DaVinci Resolve, CapCut",
    friction: "Manual cutting, transition alignment, and long export queues.",
  },
  {
    step: "06",
    task: "Thumbnail Design",
    manualTools: "Photoshop, Figma, Midjourney",
    friction: "Struggling with inconsistent branding and export resolutions.",
  },
  {
    step: "07",
    task: "YouTube Upload & SEO Optimization",
    manualTools: "YouTube Studio, vidIQ, TubeBuddy",
    friction: "Manual copying of titles, descriptions, tags, and broadcast scheduling.",
  },
  {
    step: "08",
    task: "Repurposing into YouTube Shorts",
    manualTools: "OpusClip, CapCut mobile, manual vertical reframes",
    friction: "Re-cutting clips, re-captioning, and guessing peak retention windows.",
  },
  {
    step: "09",
    task: "Audience Engagement & Retention",
    manualTools: "YouTube Studio notifications, manual replies",
    friction: "Critical viewer critiques and questions go unanswered for days.",
  },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="py-24 bg-[#110e08] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>THE PRODUCTION BOTTLENECK</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Running a YouTube Channel Shouldn't Require Juggling 9 Disconnected Tools
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            Creators rarely burn out from coming up with good ideas. They burn out from the
            exhausting operational friction of copying data between isolated apps.
          </p>
        </div>

        {/* Visual Comparison: The Disconnected Mess vs The Unified Pipeline */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: The Painful Reality (Fragmented Stack) */}
          <div className="lg:col-span-7 studio-card p-6 sm:p-8 bg-[#16130d] border-[#2e281f] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-[#2e281f]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]"></span>
                  <span className="text-xs font-mono uppercase tracking-wider text-[#f87171] font-semibold">
                    The Current Disconnected Reality
                  </span>
                </div>
                <span className="text-xs font-mono text-[#9c958c]">
                  9 Apps · 14+ Hours / Video
                </span>
              </div>

              <div className="mt-6 space-y-3.5">
                {FRAGMENTED_TOOLS.slice(0, 6).map((item) => (
                  <div
                    key={item.step}
                    className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]/80 text-left flex items-start gap-3"
                  >
                    <span className="font-mono text-xs text-[#736d64] pt-0.5 font-bold">
                      {item.step}
                    </span>
                    <div className="space-y-0.5 flex-1">
                      <div className="text-xs font-semibold text-[#f7f3ee]">
                        {item.task}
                      </div>
                      <div className="text-[11px] text-[#c8b29b]/80 font-mono">
                        Tools: {item.manualTools}
                      </div>
                      <div className="text-[11px] text-[#736d64]">
                        {item.friction}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[#2e281f] flex items-center justify-between text-xs text-[#9c958c]">
              <span>Result: Missed release dates & creator exhaustion</span>
              <span className="text-[#f87171] font-mono font-medium">85% Time Lost</span>
            </div>
          </div>

          {/* Right: The Serenity Studio Solution (One Unified Engine) */}
          <div className="lg:col-span-5 studio-card p-6 sm:p-8 bg-[#191610] border-[#c8b29b]/30 flex flex-col justify-between relative overflow-hidden">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#2e281f]">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4ade80]"></span>
                  <span className="text-xs font-mono uppercase tracking-wider text-[#4ade80] font-semibold">
                    The Serenity Studio Engine
                  </span>
                </div>
                <span className="text-xs font-mono text-[#c8b29b]">
                  1 Unified System
                </span>
              </div>

              <div className="space-y-4 text-left">
                <div className="p-4 rounded-xl bg-[#110e08] border border-[#2e281f]">
                  <div className="text-xs font-mono uppercase tracking-wider text-[#c8b29b] font-semibold">
                    Continuous Connected Pipeline
                  </div>
                  <p className="mt-1 text-xs text-[#eae1d7] leading-relaxed">
                    Every stage naturally triggers the next. Ingest a topic, and Serenity structures the scenes, renders graphics, synthesizes voiceovers, assembles the video, and schedules the broadcast.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Zero tool switching:</strong> No manual file exports or re-uploads</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Synchronized dual output:</strong> 1080p long-form + 5 automated Shorts</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Algorithmic release windows:</strong> Published at exact peak retention times</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Human-in-the-loop:</strong> Review Master before publishing</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[#2e281f]">
              <a
                href="#workflow"
                className="w-full py-3 px-4 rounded-lg bg-[#c8b29b] text-[#110e08] font-semibold text-xs uppercase tracking-wider block text-center hover:bg-[#d8c4ad] transition-all"
              >
                See the Complete Step-by-Step Workflow
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

