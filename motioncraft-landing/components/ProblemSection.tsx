"use client";

import { trackEvent } from "@/lib/analytics";

const FRAGMENTED_TOOLS = [
  {
    step: "01",
    task: "Ideation & Topic Backlog",
    manualTools: "Notion, Google Docs, bookmarks",
    friction: "Ideas scatter across notes with no structured curriculum progression.",
  },
  {
    step: "02",
    task: "Scriptwriting & Scene Outlining",
    manualTools: "Separate text documents & manual rewriting",
    friction: "Unstructured scripts with zero timing synchronization for on-screen visuals.",
  },
  {
    step: "03",
    task: "Voiceover Synthesis",
    manualTools: "External TTS services, manual audio trimming",
    friction: "Audio pacing drift, mismatched timestamps, and repetitive re-renders.",
  },
  {
    step: "04",
    task: "Visual Asset Creation & Scene Rendering",
    manualTools: "Stock libraries, keyframing in separate editors",
    friction: "Hours lost assembling visual clips and waiting on timeline exports.",
  },
  {
    step: "05",
    task: "Timeline Editing & Audio Assembly",
    manualTools: "Desktop video editing suites",
    friction: "Manual cutting, transition alignment, and long export queues.",
  },
  {
    step: "06",
    task: "Thumbnail Design",
    manualTools: "Graphics software & image generators",
    friction: "Struggling with inconsistent branding and export resolutions.",
  },
  {
    step: "07",
    task: "YouTube Upload & Scheduling",
    manualTools: "YouTube Studio manual upload forms",
    friction: "Manual entry of titles, descriptions, tags, and broadcast scheduling.",
  },
  {
    step: "08",
    task: "Repurposing into YouTube Shorts",
    manualTools: "Re-cutting in vertical mobile editors",
    friction: "Re-cutting clips, re-captioning, and managing separate vertical timelines.",
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
            Running a YouTube Channel Shouldn't Require Juggling Multiple Disconnected Tools
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            Creators rarely burn out from coming up with good ideas. They burn out from the
            operational friction of moving assets between isolated apps and manual editors.
          </p>
        </div>

        {/* Visual Comparison: The Disconnected Reality vs The Unified Pipeline */}
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
                  Multiple Disconnected Tools
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
                        Workflow: {item.manualTools}
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
              <span>Result: Operational friction & production delays</span>
              <span className="text-[#f87171] font-mono font-medium">Repetitive Manual Work</span>
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
                    Connected 8-Stage Pipeline
                  </div>
                  <p className="mt-1 text-xs text-[#eae1d7] leading-relaxed">
                    Every production stage connects into the next. Ingest a topic, and Serenity structures the scenes, renders graphics, synthesizes voiceovers, assembles the video, and prepares the broadcast.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Centralized workflow:</strong> No manual file exports or app switching</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Connected output:</strong> Full 1080p long-form videos plus vertical Shorts</span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#f7f3ee]">
                    <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span><strong>Configurable Publishing Schedules:</strong> Scheduled release windows for consistent uploads</span>
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
                See the 8-Stage Production Workflow
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
