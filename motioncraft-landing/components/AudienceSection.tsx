"use client";

import { trackEvent } from "@/lib/analytics";

const AUDIENCE_SEGMENTS = [
  {
    title: "Faceless Channel Operators",
    tagline: "Automated end-to-end production without showing your face on camera",
    pain: "Spent hours piecing together stock videos, robotic TTS voices, and manual subtitle animations.",
    gain: "Structured technical scenes, natural synced voiceovers, and automated rendering directly into 1080p master files.",
  },
  {
    title: "Multi-Channel Networks & Studios",
    tagline: "Scale multiple channels without hiring massive editing teams",
    pain: "Context-switching between 5 different YouTube Studio logins and dozens of freelancers.",
    gain: "Centralized pipeline telemetry, shared curriculum assets, and automated 5-slot Shorts syndication across channels.",
  },
  {
    title: "Technical & Explainer Creators",
    tagline: "Explain architecture, code, and systems with clean infographic visuals",
    pain: "After Effects keyframing takes 25 hours per explainer video.",
    gain: "Code-driven motion graphics and animated diagrams rendered in minutes, synchronized with technical narration.",
  },
  {
    title: "YouTube Automation Agencies",
    tagline: "Deliver consistent publishing schedules for high-ticket clients",
    pain: "Missed deadlines, inconsistent thumbnail branding, and dropped upload cadence.",
    gain: "Predictable daily release windows (e.g. 18:30 IST) and autonomous comment engagement for client retention.",
  },
];

export default function AudienceSection() {
  return (
    <section id="audience" className="py-24 bg-[#16130d] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>OPERATOR PROFILES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Built for People Who Actually Run YouTube Channels
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            Serenity Studio is engineered specifically for operators who view their YouTube channel as a production system, not a hobby.
          </p>
        </div>

        {/* Audience Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          {AUDIENCE_SEGMENTS.map((seg, idx) => (
            <div
              key={idx}
              className="studio-card p-6 sm:p-8 bg-[#191610] border-[#2e281f] space-y-4 text-left hover:border-[#c8b29b]/40 transition-colors"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
                <h3 className="text-lg font-bold text-[#f7f3ee]">{seg.title}</h3>
                <span className="font-mono text-xs text-[#c8b29b]">0{idx + 1}</span>
              </div>

              <p className="text-xs font-mono text-[#c8b29b]">{seg.tagline}</p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]">
                  <div className="text-[#f87171] font-semibold mb-1">The Friction Today:</div>
                  <div className="text-[#9c958c] leading-relaxed">{seg.pain}</div>
                </div>

                <div className="p-3 rounded-lg bg-[#110e08] border border-[#2e281f]">
                  <div className="text-[#4ade80] font-semibold mb-1">With Serenity Studio:</div>
                  <div className="text-[#eae1d7] leading-relaxed">{seg.gain}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Clear boundaries: What we do vs what we don't do */}
        <div className="mt-14 max-w-3xl mx-auto p-6 rounded-xl bg-[#110e08] border border-[#2e281f] text-center space-y-2">
          <div className="text-xs font-mono uppercase tracking-wider text-[#c8b29b] font-semibold">
            Our Honest Commitment
          </div>
          <p className="text-xs sm:text-sm text-[#9c958c] leading-relaxed">
            We automate the repetitive production and distribution workflow—not YouTube's algorithm. We do not make misleading promises about viral overnight views, instant monetization, or guaranteed subscribers. We give you back 20+ hours a week so you can focus on channel strategy and high-impact ideas.
          </p>
        </div>
      </div>
    </section>
  );
}

