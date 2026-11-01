"use client";

import Image from "next/image";
import { trackEvent } from "@/lib/analytics";

export default function HeroSection() {
  const handlePrimaryCta = () => {
    trackEvent("hero_cta_clicked", { action: "register_interest" });
  };

  const handleSecondaryCta = () => {
    trackEvent("hero_cta_clicked", { action: "explore_pipeline" });
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden architectural-grid">
      {/* Subtle background ambient lighting (no garish colors) */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-[#c8b29b]/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span className="w-2 h-2 rounded-full bg-[#4ade80]"></span>
            <span className="uppercase tracking-wider font-semibold">
              First Public Release in Preparation · Early Access Interest List
            </span>
          </div>

          {/* Core Outcome Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#f7f3ee] leading-[1.12]">
            Your YouTube Channel.{" "}
            <span className="text-[#c8b29b] block sm:inline">
              One Automated Production Studio.
            </span>
          </h1>

          {/* Subheading / Value Proposition */}
          <p className="text-lg sm:text-xl text-[#eae1d7] font-medium leading-relaxed">
            Run your YouTube channel&apos;s entire content production workflow without managing a dozen disconnected tools.
          </p>

          {/* Concise explanation */}
          <p className="text-sm sm:text-base text-[#9c958c] max-w-2xl mx-auto leading-relaxed">
            Serenity Studio automates the complete workflow from ideas and scripts to voiceovers, video production, Shorts, and publishing. The first public release is currently in preparation — register your interest below to join the early access queue.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <a
              href="#register"
              onClick={handlePrimaryCta}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-[#c8b29b] text-[#110e08] font-semibold text-sm hover:bg-[#d8c4ad] transition-all shadow-md active:translate-y-0.5"
            >
              <span>Register Your Interest</span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </a>

            <a
              href="#pipeline"
              onClick={handleSecondaryCta}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#191610] border border-[#2e281f] text-[#f7f3ee] font-medium text-sm hover:border-[#c8b29b]/50 hover:bg-[#221e17] transition-all"
            >
              <span>Explore the Pipeline</span>
              <svg
                className="w-4 h-4 text-[#9c958c]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </a>
          </div>

          {/* Real Operator Trust Points */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-[#9c958c]">
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-[#4ade80]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Real production software (iOS & Android companion)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-[#4ade80]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Retain full creative control with Master Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-[#4ade80]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span>Free early-access interest list (no payment required)</span>
            </div>
          </div>
        </div>

        {/* Hero Visual: Actual Pipeline Telemetry Screenshot in High-End Bezel */}
        <div id="pipeline" className="mt-16 sm:mt-20 max-w-5xl mx-auto">
          <div className="studio-card p-3 sm:p-5 shadow-2xl bg-[#16130d] border-[#2e281f]">
            {/* Window bar */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#2e281f] text-xs font-mono text-[#9c958c]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e281f]"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e281f]"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e281f]"></span>
                <span className="ml-2 text-[#eae1d7] font-semibold text-xs tracking-wider uppercase">
                  Telemetry · Serenity Production Engine
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/30 text-[#4ade80] text-[11px] font-semibold">
                  8 of 8 Stages Complete
                </span>
                <span className="hidden sm:inline text-[#736d64]">
                  Channel: JarvisAI
                </span>
              </div>
            </div>

            {/* Display grid showcasing the actual app screenshot and live telemetry overlay */}
            <div className="pt-4 sm:pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Product Screenshot */}
              <div className="lg:col-span-7 relative flex justify-center">
                <div className="relative w-full max-w-[340px] sm:max-w-[380px] rounded-2xl overflow-hidden border border-[#2e281f] shadow-2xl bg-[#110e08]">
                  <Image
                    src="/screenshots/pipeline-telemetry.jpg"
                    alt="Serenity Studio Connected Execution Pipeline Telemetry Screenshot"
                    width={738}
                    height={1599}
                    priority
                    className="w-full h-auto object-cover"
                  />
                </div>
              </div>

              {/* Verified Product Telemetry Highlights */}
              <div className="lg:col-span-5 space-y-4 text-left">
                <div className="p-4 rounded-xl bg-[#191610] border border-[#2e281f] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-[#c8b29b] tracking-wider">
                      Flagship Production Job
                    </span>
                    <span className="text-[11px] font-mono text-[#9c958c]">
                      31 Oct · 17:18 IST
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-[#f7f3ee]">
                    The Connection Pool Paradox: Why Smaller Pools Double Database Speed
                  </h3>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="w-2 h-2 rounded-full bg-[#4ade80]"></span>
                    <span className="text-xs font-medium text-[#4ade80]">
                      Pipeline Succeeded · Ready for Master Review
                    </span>
                  </div>
                </div>

                {/* 4 Verified Production Stages */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#c8b29b] font-bold">01</span>
                      <div>
                        <div className="text-xs font-semibold text-[#f7f3ee]">Topic Ingestion & Queue Dispatch</div>
                        <div className="text-[11px] text-[#9c958c]">Editorial concepts ingested into pipeline</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#4ade80] px-2 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/20">Done</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#c8b29b] font-bold">02</span>
                      <div>
                        <div className="text-xs font-semibold text-[#f7f3ee]">Generate Structured Script</div>
                        <div className="text-[11px] text-[#9c958c]">8 research-backed scenes structured</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#4ade80] px-2 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/20">Done</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#c8b29b] font-bold">03</span>
                      <div>
                        <div className="text-xs font-semibold text-[#f7f3ee]">Render Motion Scenes</div>
                        <div className="text-[11px] text-[#9c958c]">8 animated infographic scenes rendered</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#4ade80] px-2 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/20">Done</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]/80 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[#c8b29b] font-bold">04</span>
                      <div>
                        <div className="text-xs font-semibold text-[#f7f3ee]">Voiceover Synthesis & Timing</div>
                        <div className="text-[11px] text-[#9c958c]">8 scene audio tracks synchronized</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-[#4ade80] px-2 py-0.5 rounded bg-[#4ade80]/10 border border-[#4ade80]/20">Done</span>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href="#register"
                    className="block w-full py-3 px-4 rounded-lg bg-[#221e17] border border-[#c8b29b]/30 text-center text-xs font-semibold uppercase tracking-wider text-[#d8c4ad] hover:border-[#c8b29b] hover:bg-[#262119] transition-all"
                  >
                    Register Your Interest
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
