"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "What is Serenity Studio and what does it automate?",
    answer:
      "Serenity Studio automates the complete YouTube production lifecycle across three connected pillars: Core Production (script structuring, voiceover synthesis, 1080p motion scene rendering, multi-track video assembly, high-contrast thumbnail packaging), Content Management (editorial ideas queue, multi-episode series progression, scheduled daily publishing), and Audience & Channel Intelligence (autonomous comment engagement).",
  },
  {
    question: "When will the first public release be available?",
    answer:
      "We are currently preparing the first public release of Serenity Studio. By registering your interest today, you join our priority notification queue. We will contact registered creators via email within the next 30 days with release updates and onboarding details.",
  },
  {
    question: "How much will Serenity Studio cost?",
    answer:
      "Subscription pricing and tier options will be announced closer to the public launch. Registering your interest is 100% free with no payment, credit card, or financial commitment required.",
  },
  {
    question: "What does registering your interest do?",
    answer:
      "Registering puts your channel on our priority notification list. Selected creators will get an opportunity to try the first public release, deploy the connected 8-stage production pipeline, and shape final platform features before general availability.",
  },
  {
    question: "Do I need to authorize or connect my YouTube account right now?",
    answer:
      "No. Registering your interest only collects your basic contact details and content preferences. You do not need to link, authorize, or grant permissions to your YouTube account during early access registration.",
  },
  {
    question: "Can I review and edit content before anything gets published?",
    answer:
      "Yes. Serenity Studio includes a mandatory human Master Review checkpoint. You retain total creative authority: every script beat, rendered scene, voiceover track, thumbnail, and title can be inspected, adjusted, or re-rendered before public release.",
  },
  {
    question: "Does it produce both long-form videos and YouTube Shorts?",
    answer:
      "Yes. The platform outputs full-length 1080p landscape master videos along with vertical 9:16 Shorts with dynamic captions, distributed across up to five configurable daily Shorts publishing slots.",
  },
  {
    question: "Are multiple channels or agencies supported in the first release?",
    answer:
      "The initial public release is focused on single-channel operations with multi-episode series tracks. Multi-channel agency management, team workspaces, and client review dashboards are currently under active development on our future roadmap.",
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
            Answers to Common Questions
          </h2>
          <p className="text-base text-[#9c958c] max-w-xl mx-auto leading-relaxed">
            Everything you need to know about Serenity Studio, the first public release, and our early-access interest list.
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
