"use client";

import { trackEvent } from "@/lib/analytics";

const AUDIENCE_SEGMENTS = [
  {
    title: "Faceless Channel Operators",
    tagline: "Automated end-to-end production without showing your face on camera",
    pain: "Fragmented workflow piecing together stock videos, voice files, and manual subtitle animations.",
    gain: "Structured technical scenes, natural synced voiceovers, and automated rendering directly into 1080p master files.",
  },
  {
    title: "Solo Creators & Niche Educators",
    tagline: "Run a dedicated single-channel production pipeline with full editorial control",
    pain: "Repetitive manual work editing, assembling visual b-roll, and formatting video assets.",
    gain: "Turn core outlines and curriculum into finished videos, leaving only master review before automated dispatch.",
  },
  {
    title: "Technical & Explainer Channels",
    tagline: "Explain architecture, code, and systems with clean infographic visuals",
    pain: "Manual motion design keyframing and complex timeline editing for technical deep-dive videos.",
    gain: "Code-driven motion graphics and animated diagrams synchronized with technical narration.",
  },
  {
    title: "Studios & Multi-Channel Operators (Roadmap)",
    tagline: "Future multi-channel management currently under active development",
    pain: "Need separate team permissions and multi-account workspace isolation.",
    gain: "Current beta focuses strictly on single-channel stability; multi-channel isolation is on the near-term roadmap.",
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
            We automate the repetitive production and distribution workflow—not YouTube's algorithm. We do not make misleading promises about viral overnight views, instant monetization, or guaranteed subscribers. We reduce repetitive manual production work so you can focus on channel strategy and high-impact ideas.
          </p>
        </div>
      </div>
    </section>
  );
}

