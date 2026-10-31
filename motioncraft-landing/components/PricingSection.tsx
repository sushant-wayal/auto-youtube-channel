"use client";

import { BETA_PRICING_CONFIG } from "@/lib/pricing-config";
import { trackEvent } from "@/lib/analytics";

export default function PricingSection() {
  const { tier, currentBatch } = BETA_PRICING_CONFIG;

  const handleApplyClick = () => {
    trackEvent("pricing_section_viewed", {
      tier_id: tier.id,
      price_inr: tier.priceMonthlyINR,
    });
  };

  return (
    <section id="pricing" className="py-24 bg-[#110e08] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>COMMERCIAL VALIDATION & EARLY ACCESS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Founding Creator Access: Shape the Platform
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            This is not a generic free waitlist. We are inviting a small cohort of dedicated YouTube operators into the paid private beta to deploy the actual production software.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="mt-16 max-w-2xl mx-auto">
          <div className="studio-card p-8 sm:p-10 bg-[#16130d] border-[#c8b29b]/40 shadow-2xl relative">
            {/* Top Badge */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-6 border-b border-[#2e281f]">
              <span className="px-3 py-1 rounded-full bg-[#c8b29b]/10 border border-[#c8b29b]/30 text-xs font-mono font-semibold uppercase text-[#c8b29b]">
                {tier.badge}
              </span>
              <span className="text-xs font-mono text-[#4ade80] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4ade80]"></span>
                <span>{tier.supportedScope}</span>
              </span>
            </div>

            {/* Price Header */}
            <div className="mt-6 text-left space-y-3">
              <div className="text-xs font-mono uppercase text-[#9c958c] tracking-wider">
                {currentBatch}
              </div>
              <h3 className="text-2xl font-bold text-[#f7f3ee]">{tier.name}</h3>
              <p className="text-sm text-[#eae1d7]">{tier.description}</p>

              {/* Price display */}
              <div className="pt-4 flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[#f7f3ee]">
                  ₹{tier.priceMonthlyINR.toLocaleString()}
                </span>
                <span className="text-sm font-mono text-[#9c958c]">
                  / month (~${tier.priceMonthlyUSD} USD)
                </span>
              </div>

              <p className="text-xs font-mono text-[#c8b29b]">
                {tier.priceNote}
              </p>
            </div>

            {/* Included Capabilities */}
            <div className="mt-8 pt-6 border-t border-[#2e281f] text-left space-y-4">
              <div className="text-xs font-mono uppercase text-[#736d64] tracking-wider">
                Canonical 8-Stage Production Stack Included:
              </div>

              <ul className="space-y-2.5 text-xs sm:text-sm text-[#eae1d7]">
                {tier.includedFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <svg
                      className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5"
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
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Operational Inclusions / Boundaries */}
            <div className="mt-6 p-4 rounded-xl bg-[#110e08] border border-[#2e281f] text-left space-y-2">
              <div className="text-xs font-mono uppercase text-[#c8b29b] font-semibold">
                Beta Operational Limits & Scope:
              </div>
              <ul className="space-y-1.5 text-xs text-[#9c958c]">
                {tier.operationalInclusions.map((inc, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#c8b29b] mt-0.5">✦</span>
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA leading to qualification form */}
            <div className="mt-8">
              <a
                href="#apply"
                onClick={handleApplyClick}
                className="w-full py-4 px-6 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-sm uppercase tracking-wider block text-center hover:bg-[#d8c4ad] transition-all shadow-lg active:translate-y-0.5"
              >
                {tier.ctaText}
              </a>
              <p className="mt-3 text-center text-xs text-[#9c958c] leading-relaxed">
                {tier.reviewPeriodNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
