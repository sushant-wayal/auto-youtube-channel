"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "What exactly does Serenity Studio automate?",
    answer:
      "Serenity Studio automates the full operational production chain: topic queue management, beat-by-beat scene scripting, voiceover audio synthesis, 1080p motion graphic rendering, multi-track master assembly, high-CTR thumbnail generation, scheduled YouTube long-form publishing, 5-slot Shorts syndication, and autonomous audience comment responses.",
  },
  {
    question: "Can I review and edit content before it gets published?",
    answer:
      "Yes. The platform includes a mandatory 'Review Master' checkpoint in the telemetry pipeline. Every script, rendered scene, thumbnail, and title can be inspected, adjusted, or re-run before the automated scheduler publishes to YouTube.",
  },
  {
    question: "Does it generate both long-form videos and YouTube Shorts?",
    answer:
      "Yes. The pipeline outputs both a full-length 1080p landscape master video (scheduled for prime daily windows such as 18:30 IST) and reformats key high-hook segments into vertical 9:16 YouTube Shorts with dynamic captions across 5 retention-optimized time slots.",
  },
  {
    question: "Do I need separate subscriptions for voiceovers and video editing?",
    answer:
      "No. Serenity Studio integrates speech synthesis, code-driven motion graphic rendering, and video assembly directly into its connected execution pipeline. You do not need external subscriptions to Premiere Pro, After Effects, or standalone voice apps to produce finished content.",
  },
  {
    question: "Do I need technical or video editing knowledge to use it?",
    answer:
      "No editing knowledge is required. You can manage ideas and approve pipeline runs entirely from the mobile application (iOS and Android companion). If you are a technical creator, you also have fine-grained control over scene HTML, series curriculum tracks, and voice pacing.",
  },
  {
    question: "Can I manage multiple YouTube channels and series?",
    answer:
      "Yes. Serenity Studio is architected around Series Curricula and multi-channel telemetry. You can run standalone releases or curate multi-episode tracks (e.g. tracking episode counts, published vs. planned metrics, and progress percentages).",
  },
  {
    question: "Is this suitable for an existing YouTube channel?",
    answer:
      "Yes. Serenity Studio connects directly to your existing YouTube channel via the standard YouTube Data API. It preserves your existing publishing cadence, metadata styles, and channel branding.",
  },
  {
    question: "How do I get early access to the Founding Creator Beta?",
    answer:
      "Submit the application form above with your YouTube channel details and operational bottleneck. We review each application within 24 hours to confirm content alignment and invite qualified operators in small cohorts.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    const next = openIndex === index ? null : index;
    setOpenIndex(next);
    if (next !== null) {
      trackEvent("faq_toggled", { question: FAQS[index].question });
    }
  };

  return (
    <section id="faq" className="py-24 bg-[#110e08] border-t border-[#2e281f] relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>FREQUENTLY ASKED QUESTIONS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Practical Answers on Automation & Control
          </h2>
          <p className="text-base text-[#9c958c] max-w-xl mx-auto leading-relaxed">
            Clear, verified facts regarding platform capabilities, scheduling control, and beta onboarding.
          </p>
        </div>

        {/* Accordion */}
        <div className="mt-14 space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="studio-card bg-[#16130d] border-[#2e281f] overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 hover:bg-[#191610] transition-colors"
                >
                  <span className="text-sm sm:text-base font-semibold text-[#f7f3ee]">
                    {faq.question}
                  </span>
                  <span className="font-mono text-lg text-[#c8b29b] transition-transform duration-200 shrink-0">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#eae1d7] leading-relaxed border-t border-[#2e281f]/60 bg-[#110e08]/50">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

