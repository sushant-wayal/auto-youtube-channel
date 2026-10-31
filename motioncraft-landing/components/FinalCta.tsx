"use client";

import { trackEvent } from "@/lib/analytics";

export default function FinalCta() {
  const handleClick = () => {
    trackEvent("hero_cta_clicked", { location: "final_cta_section" });
  };

  return (
    <section className="py-24 bg-[#16130d] border-t border-[#2e281f] relative overflow-hidden">
      {/* Subtle architectural accents */}
      <div className="absolute inset-0 architectural-grid opacity-50 pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
          <span>OPERATIONAL LEVERAGE FOR CREATORS</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#f7f3ee] leading-tight">
          Spend Less Time Producing. <br className="hidden sm:inline" />
          <span className="text-[#c8b29b]">Spend More Time Growing Your Channel.</span>
        </h2>

        <p className="text-sm sm:text-base text-[#eae1d7] max-w-xl mx-auto leading-relaxed">
          Reclaim 20+ hours a week lost to fragmented tools, timeline rendering, and manual video clipping. Let Serenity Studio handle the repetitive production pipeline while you retain total strategic direction.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#apply"
            onClick={handleClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider hover:bg-[#d8c4ad] transition-all shadow-xl active:translate-y-0.5"
          >
            <span>Apply for Paid Beta Access</span>
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
        </div>

        <div className="text-xs font-mono text-[#736d64] pt-2">
          Strictly limited to 25 channels for Founding Cohort Batch 01.
        </div>
      </div>
    </section>
  );
}

