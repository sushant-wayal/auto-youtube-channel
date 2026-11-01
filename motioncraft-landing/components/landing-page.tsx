"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";
import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import ProductDemoSection from "./ProductDemoSection";
import ProblemSection from "./ProblemSection";
import WorkflowSection from "./WorkflowSection";
import ProductShowcase from "./ProductShowcase";
import AudienceSection from "./AudienceSection";
import PricingSection from "./PricingSection";
import EarlyAccessForm from "./EarlyAccessForm";
import FaqSection from "./FaqSection";
import FinalCta from "./FinalCta";
import Footer from "./Footer";

export default function LandingPage() {
  useEffect(() => {
    trackEvent("page_view");
  }, []);

  return (
    <div className="min-h-screen bg-[#110e08] text-[#f7f3ee] flex flex-col font-sans selection:bg-[#c8b29b]/25 selection:text-[#f7f3ee]">
      {/* Sticky Navigation */}
      <Navbar />

      {/* Main Content Journey */}
      <main className="flex-1">
        {/* Hero Section */}
        <HeroSection />

        {/* 1:52 Product Demo Video */}
        <ProductDemoSection />

        {/* The Problem: Disconnected Tools */}
        <ProblemSection />

        {/* The Solution: One Connected Workflow */}
        <WorkflowSection />

        {/* Product Showcase: Actual Application Telemetry & Screens */}
        <ProductShowcase />

        {/* Built For Real YouTube Operators */}
        <AudienceSection />

        {/* Early Access 3-Step Process */}
        <PricingSection />

        {/* Early Access Registration Form */}
        <EarlyAccessForm />

        {/* Practical FAQs */}
        <FaqSection />

        {/* Final CTA */}
        <FinalCta />
      </main>

      {/* Clean Footer */}
      <Footer />
    </div>
  );
}
