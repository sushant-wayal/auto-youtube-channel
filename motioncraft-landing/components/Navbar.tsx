"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (section: string) => {
    setMobileMenuOpen(false);
    trackEvent("workflow_step_inspected", { section });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#110e08]/90 backdrop-blur-md border-b border-[#2e281f]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-3 group"
          onClick={() => trackEvent("workflow_step_inspected", { section: "brand_logo" })}
        >
          <div className="w-9 h-9 rounded-lg bg-[#191610] border border-[#c8b29b]/30 flex items-center justify-center shadow-inner group-hover:border-[#c8b29b] transition-colors">
            <span className="font-mono text-xs font-bold text-[#c8b29b] tracking-tighter">
              SS
            </span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wider uppercase text-[#f7f3ee]">
                Serenity
              </span>
              <span className="font-mono text-xs text-[#c8b29b] tracking-widest uppercase">
                Studio
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></span>
              <span className="text-[10px] text-[#9c958c] font-mono tracking-tight">
                Automation Engine
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm text-[#9c958c]">
          <a
            href="#problem"
            onClick={() => handleNavClick("problem")}
            className="hover:text-[#f7f3ee] transition-colors"
          >
            The Problem
          </a>
          <a
            href="#workflow"
            onClick={() => handleNavClick("workflow")}
            className="hover:text-[#f7f3ee] transition-colors"
          >
            How It Works
          </a>
          <a
            href="#showcase"
            onClick={() => handleNavClick("showcase")}
            className="hover:text-[#f7f3ee] transition-colors"
          >
            Capabilities
          </a>
          <a
            href="#audience"
            onClick={() => handleNavClick("audience")}
            className="hover:text-[#f7f3ee] transition-colors"
          >
            Who It's For
          </a>
          <a
            href="#pricing"
            onClick={() => handleNavClick("pricing")}
            className="hover:text-[#f7f3ee] transition-colors"
          >
            Founding Access
          </a>
          <a
            href="#faq"
            onClick={() => handleNavClick("faq")}
            className="hover:text-[#f7f3ee] transition-colors"
          >
            FAQ
          </a>
        </nav>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="#apply"
            onClick={() => trackEvent("hero_cta_clicked", { location: "navbar" })}
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold tracking-wide uppercase rounded-md bg-[#c8b29b] text-[#110e08] hover:bg-[#d8c4ad] transition-all shadow-sm active:translate-y-0.5"
          >
            Apply for Beta
          </a>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md border border-[#2e281f] text-[#9c958c] hover:text-[#f7f3ee] bg-[#16130d]"
            aria-label="Toggle navigation"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#16130d] border-b border-[#2e281f] px-6 py-6 space-y-4">
          <div className="flex flex-col space-y-3 text-sm text-[#9c958c]">
            <a
              href="#problem"
              onClick={() => handleNavClick("problem")}
              className="py-1 hover:text-[#f7f3ee]"
            >
              The Problem
            </a>
            <a
              href="#workflow"
              onClick={() => handleNavClick("workflow")}
              className="py-1 hover:text-[#f7f3ee]"
            >
              How It Works
            </a>
            <a
              href="#showcase"
              onClick={() => handleNavClick("showcase")}
              className="py-1 hover:text-[#f7f3ee]"
            >
              Capabilities
            </a>
            <a
              href="#audience"
              onClick={() => handleNavClick("audience")}
              className="py-1 hover:text-[#f7f3ee]"
            >
              Who It's For
            </a>
            <a
              href="#pricing"
              onClick={() => handleNavClick("pricing")}
              className="py-1 hover:text-[#f7f3ee]"
            >
              Founding Access
            </a>
            <a
              href="#faq"
              onClick={() => handleNavClick("faq")}
              className="py-1 hover:text-[#f7f3ee]"
            >
              FAQ
            </a>
          </div>
          <div className="pt-3 border-t border-[#2e281f]">
            <a
              href="#apply"
              onClick={() => {
                setMobileMenuOpen(false);
                trackEvent("hero_cta_clicked", { location: "mobile_menu" });
              }}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 text-xs font-semibold tracking-wide uppercase rounded-md bg-[#c8b29b] text-[#110e08] hover:bg-[#d8c4ad]"
            >
              Apply for Early Access
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

