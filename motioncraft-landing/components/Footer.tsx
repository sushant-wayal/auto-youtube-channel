"use client";

import { useState } from "react";

export default function Footer() {
  const [showLegalModal, setShowLegalModal] = useState<"privacy" | "terms" | null>(null);

  return (
    <footer className="bg-[#110e08] border-t border-[#2e281f] py-16 text-xs text-[#9c958c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Brand & Mission */}
          <div className="md:col-span-5 space-y-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#191610] border border-[#c8b29b]/40 flex items-center justify-center font-mono text-xs font-bold text-[#c8b29b]">
                SS
              </div>
              <span className="font-semibold text-sm tracking-wider uppercase text-[#f7f3ee]">
                Serenity Studio
              </span>
            </div>
            <p className="text-xs text-[#736d64] max-w-sm leading-relaxed">
              The end-to-end production engine for managing your YouTube content workflow, from ideas to publishing.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-[#4ade80]"></span>
              <span className="font-mono text-[11px] text-[#eae1d7]">
                Production Engine v1.0.1 · All systems nominal
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="md:col-span-3 space-y-2 text-left">
            <div className="text-[11px] font-mono uppercase text-[#eae1d7] font-semibold tracking-wider">
              Navigation
            </div>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a href="#problem" className="hover:text-[#f7f3ee] transition-colors">
                  The Problem
                </a>
              </li>
              <li>
                <a href="#workflow" className="hover:text-[#f7f3ee] transition-colors">
                  Connected Workflow
                </a>
              </li>
              <li>
                <a href="#showcase" className="hover:text-[#f7f3ee] transition-colors">
                  Capabilities & Telemetry
                </a>
              </li>
              <li>
                <a href="#audience" className="hover:text-[#f7f3ee] transition-colors">
                  Who It's For
                </a>
              </li>
              <li>
                <a href="#early-access" className="hover:text-[#f7f3ee] transition-colors">
                  Early Access
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-[#f7f3ee] transition-colors">
                  Frequently Asked Questions
                </a>
              </li>
            </ul>
          </div>

          {/* Legal & Operations */}
          <div className="md:col-span-4 space-y-2 text-left">
            <div className="text-[11px] font-mono uppercase text-[#eae1d7] font-semibold tracking-wider">
              Security & Compliance
            </div>
            <p className="text-xs text-[#736d64] leading-relaxed">
              Serenity Studio integrates with YouTube to support authorized channel operations and publishing workflows. Channel access requires user authorization. Content review checkpoints allow approval before public dispatch.
            </p>
            <div className="flex items-center gap-4 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setShowLegalModal("privacy")}
                className="hover:text-[#f7f3ee] underline underline-offset-2"
              >
                Privacy Notice
              </button>
              <button
                type="button"
                onClick={() => setShowLegalModal("terms")}
                className="hover:text-[#f7f3ee] underline underline-offset-2"
              >
                Terms of Early Access
              </button>
            </div>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-[#2e281f] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#736d64]">
          <div>
            © {new Date().getFullYear()} Serenity Studio. Built for creators and automation operators.
          </div>
          <div className="font-mono">
            Obsidian & Sandstone Edition
          </div>
        </div>
      </div>

      {/* Modal for Privacy & Terms */}
      {showLegalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="studio-card max-w-lg w-full p-6 bg-[#16130d] border-[#2e281f] space-y-4 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-[#2e281f]">
              <h3 className="text-base font-bold text-[#f7f3ee]">
                {showLegalModal === "privacy" ? "Privacy Notice" : "Terms of Early Access"}
              </h3>
              <button
                onClick={() => setShowLegalModal(null)}
                className="text-[#9c958c] hover:text-[#f7f3ee] text-sm font-mono"
              >
                [Close]
              </button>
            </div>

            <div className="text-xs text-[#eae1d7] space-y-3 leading-relaxed max-h-80 overflow-y-auto pr-2">
              {showLegalModal === "privacy" ? (
                <>
                  <p>
                    <strong>Data Collection:</strong> We collect only information submitted via the early access interest registration form (name, email, optional channel URL, and publishing volume preferences).
                  </p>
                  <p>
                    <strong>Channel Authorization:</strong> YouTube account access is not requested during interest registration. In the application itself, OAuth authorization is used strictly for authorized publishing and community response tasks that you configure.
                  </p>
                  <p>
                    <strong>Data Protection & Deletion:</strong> We do not sell or monetize creator data. You can request immediate deletion of your registration and contact records at any time.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    <strong>Early Access Scope:</strong> Registering your interest places you on our priority notification list for the first public release of Serenity Studio. Registration is free and does not require payment or financial commitment.
                  </p>
                  <p>
                    <strong>Operational Notice:</strong> We automate production and publishing workflows; we do not control YouTube&apos;s recommendation algorithms and make no guarantees regarding viral views, channel growth rates, or monetary earnings.
                  </p>
                  <p>
                    <strong>Commercial Terms:</strong> Subscription pricing and plan details will be communicated transparently prior to general release.
                  </p>
                </>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setShowLegalModal(null)}
                className="w-full py-2.5 rounded-lg bg-[#221e17] border border-[#2e281f] text-xs font-semibold text-[#f7f3ee] hover:bg-[#2e281f]"
              >
                I Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
