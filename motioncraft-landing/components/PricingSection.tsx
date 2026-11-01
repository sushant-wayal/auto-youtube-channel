"use client";

import { trackEvent } from "@/lib/analytics";

const THREE_STEPS = [
  {
    step: "01",
    title: "Register Your Interest",
    description:
      "Share your channel details, publishing volume, and what you'd most like to automate. Registration takes less than a minute and requires no payment.",
    status: "Step 1",
  },
  {
    step: "02",
    title: "Get Contacted",
    description:
      "We will contact registered users via email within the next 30 days with release timelines, technical updates, and onboarding invitations.",
    status: "Step 2",
  },
  {
    step: "03",
    title: "Try the First Release",
    description:
      "Selected users will get an opportunity to try the first public release, test the connected 8-stage pipeline, and automate their YouTube publishing.",
    status: "Step 3",
  },
];

export default function PricingSection() {
  const handleCtaClick = () => {
    trackEvent("cta_click", { section: "early_access_3step", cta: "register_interest_steps" });
  };

  return (
    <section id="early-access" className="py-24 bg-[#110e08] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>FIRST PUBLIC RELEASE · EARLY ACCESS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Register Your Interest for the First Public Release
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            We are preparing our first public release. Registering your interest is free, requires no payment, and places you on the priority notification list.
          </p>
        </div>

        {/* 3-Step Process Grid */}
        <div className="mt-16 max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {THREE_STEPS.map((item) => (
            <div
              key={item.step}
              className="studio-card p-6 sm:p-8 bg-[#16130d] border-[#2e281f] text-left flex flex-col justify-between hover:border-[#c8b29b]/40 transition-colors"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
                  <span className="font-mono text-2xl font-bold text-[#c8b29b]">
                    {item.step}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#191610] border border-[#2e281f] text-[10px] font-mono text-[#9c958c] uppercase">
                    {item.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#f7f3ee]">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#9c958c] leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#2e281f]/60 flex items-center gap-2 text-xs font-mono text-[#4ade80]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
                <span>Simple & Free Process</span>
              </div>
            </div>
          ))}
        </div>

        {/* Clear Commitments Card */}
        <div className="mt-12 max-w-3xl mx-auto studio-card p-6 sm:p-8 bg-[#191610] border-[#c8b29b]/30 text-left space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#2e281f]">
            <div>
              <div className="text-xs font-mono uppercase text-[#c8b29b] tracking-wider font-semibold">
                Transparent Onboarding Notice
              </div>
              <h4 className="text-base font-semibold text-[#f7f3ee] mt-1">
                Zero Financial Commitment Required
              </h4>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#4ade80]/10 border border-[#4ade80]/30 text-xs font-mono text-[#4ade80] w-fit">
              100% Free Registration
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#eae1d7]">
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Free interest registration:</strong> No payment details or upfront fees collected.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>30-day contact timeline:</strong> We will reach out via email within the next 30 days.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>Subscription pricing:</strong> Transparent pricing will be announced closer to the public launch.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <svg className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span><strong>No channel access required:</strong> You do not need to authorize your YouTube account now.</span>
            </div>
          </div>

          <div className="pt-2">
            <a
              href="#register"
              onClick={handleCtaClick}
              className="w-full py-3.5 px-6 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider block text-center hover:bg-[#d8c4ad] transition-all shadow-md active:translate-y-0.5"
            >
              Register Your Interest
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
