"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { trackEvent, getAttributionContext } from "@/lib/analytics";
import CustomSelect from "./CustomSelect";

interface FormData {
  name: string;
  email: string;
  channelUrl: string;
  willingnessToPay: string;
  channelsCount: string;
  monthlyVideos: string;
  monthlyShorts: string;
  currentWorkflow: string;
  monthlySpend: string;
  primaryProblem: string;
}

export const WILLINGNESS_TO_PAY_OPTIONS = [
  "₹0 - Only interested if free",
  "Under ₹3,000",
  "₹3,000–₹8,999",
  "₹9,000–₹22,999",
  "₹23,000–₹37,999",
  "₹38,000–₹89,999",
  "₹90,000+",
  "Not sure yet",
];

const CHANNELS_COUNT_OPTIONS = [
  "1 Channel",
  "2–3 Channels",
  "4–10 Channels",
  "10+ Channels",
];

const MONTHLY_VIDEOS_OPTIONS = [
  "0 videos / mo",
  "1–4 videos / mo",
  "5–10 videos / mo",
  "11–20 videos / mo",
  "20+ videos / mo",
];

const MONTHLY_SHORTS_OPTIONS = [
  "0 Shorts / mo",
  "1–10 Shorts / mo",
  "11–30 Shorts / mo",
  "30+ Shorts / mo",
];

const WORKFLOW_OPTIONS = [
  "Using multiple AI tools",
  "Entirely manually",
  "Existing automation platform",
  "Outsourced to editors / agency",
  "Other",
];

const SPEND_OPTIONS = [
  "₹0",
  "Under ₹3,000",
  "₹3,000–₹8,999",
  "₹9,000–₹22,999",
  "₹23,000+",
];

export default function EarlyAccessForm() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasImpressed, setHasImpressed] = useState(false);

  const [submittedCandidate, setSubmittedCandidate] = useState<{
    name: string;
    email: string;
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    channelUrl: "",
    willingnessToPay: "",
    channelsCount: "1 Channel",
    monthlyVideos: "1–4 videos / mo",
    monthlyShorts: "1–10 Shorts / mo",
    currentWorkflow: "Using multiple AI tools",
    monthlySpend: "Under ₹3,000",
    primaryProblem: "",
  });

  // Track form impression when visible
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasImpressed) {
          setHasImpressed(true);
          trackEvent("form_viewed", { section: "early_access_form" });
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasImpressed]);

  const handleStartInteraction = () => {
    if (!hasStarted) {
      setHasStarted(true);
      trackEvent("form_started", { section: "early_access_form" });
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    handleStartInteraction();
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = formData.name.trim();
    if (trimmedName.length < 2) {
      const msg = "Please enter your full name.";
      setErrorMessage(msg);
      trackEvent("form_submit_error", { reason: "name_too_short" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      const msg = "Please enter a valid email address.";
      setErrorMessage(msg);
      trackEvent("form_submit_error", { reason: "email_invalid" });
      return;
    }

    if (!formData.willingnessToPay) {
      const msg = "Please select how much you would realistically be willing to pay per month.";
      setErrorMessage(msg);
      trackEvent("form_submit_error", { reason: "wtp_missing" });
      return;
    }

    setSubmitting(true);
    trackEvent("form_submit_attempt", {
      willingnessToPay: formData.willingnessToPay,
      channelsCount: formData.channelsCount,
    });

    const context = getAttributionContext();

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: formData.email.trim(),
          channelUrl: formData.channelUrl.trim(),
          willingnessToPay: formData.willingnessToPay,
          channelsCount: formData.channelsCount,
          monthlyVideos: formData.monthlyVideos,
          monthlyShorts: formData.monthlyShorts,
          currentWorkflow: formData.currentWorkflow,
          monthlySpend: formData.monthlySpend,
          primaryProblem: formData.primaryProblem.trim(),
          visitorId: context.visitorId,
          sessionId: context.sessionId,
          utmSource: context.utm.source,
          utmMedium: context.utm.medium,
          utmCampaign: context.utm.campaign,
          utmContent: context.utm.content,
          utmTerm: context.utm.term,
          referrer: context.referrer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit registration.");
      }

      trackEvent("form_submit_success", {
        willingnessToPay: formData.willingnessToPay,
        channelsCount: formData.channelsCount,
        monthlyVideos: formData.monthlyVideos,
      });

      setSubmittedCandidate({
        name: trimmedName,
        email: formData.email.trim(),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Registration failed. Please check your network connection.";
      setErrorMessage(msg);
      trackEvent("form_submit_error", { reason: "network_or_api_error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="register"
      ref={containerRef}
      className="py-24 bg-[#16130d] border-t border-[#2e281f] relative"
    >
      {/* Anchor for backward compatibility with #apply */}
      <div id="apply" className="absolute -top-20" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>EARLY ACCESS INTEREST LIST</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Register Your Interest
          </h2>
          <p className="text-base text-[#9c958c] max-w-xl mx-auto leading-relaxed">
            Register your interest for the first public release of Serenity Studio. Free to register, no payment required, and no YouTube authorization needed.
          </p>
        </div>

        {/* Form Container */}
        <div className="mt-12 studio-card p-6 sm:p-10 bg-[#191610] border-[#2e281f]">
          {/* Success Confirmation View */}
          {success && submittedCandidate ? (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#4ade80]/10 border border-[#4ade80]/30 mx-auto flex items-center justify-center text-[#4ade80]">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <div className="space-y-3">
                <h3 className="text-2xl font-bold text-[#f7f3ee]">
                  Thank You, {submittedCandidate.name}!
                </h3>
                <p className="text-sm sm:text-base text-[#eae1d7] max-w-lg mx-auto leading-relaxed font-medium">
                  You&apos;re on the Serenity Studio early-access interest list! We&apos;ll contact you via email within the next 30 days with updates about our first public release.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-xl bg-[#110e08] border border-[#2e281f] text-left text-xs space-y-2.5">
                <div className="text-[#c8b29b] font-mono uppercase font-semibold">
                  What happens next:
                </div>
                <ul className="space-y-2 text-[#9c958c]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ade80]">1.</span>
                    <span>We will review interest registrations and reach out via email within 30 days.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ade80]">2.</span>
                    <span>Selected creators will get an opportunity to try the first public release.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ade80]">3.</span>
                    <span>Subscription pricing and plan details will be communicated prior to public launch.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 text-xs font-mono text-[#736d64]">
                Updates will be sent to {submittedCandidate.email}.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 text-left">
              {errorMessage && (
                <div className="p-3.5 rounded-lg bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]">
                  {errorMessage}
                </div>
              )}

              {/* Row 1: Name and Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Full Name <span className="text-[#c8b29b]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onFocus={handleStartInteraction}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b] focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Email Address <span className="text-[#c8b29b]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onFocus={handleStartInteraction}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="alex@channel.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 2: YouTube Channel URL (Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    YouTube Channel URL or @handle
                  </label>
                  <span className="text-[11px] font-mono text-[#736d64]">(Optional)</span>
                </div>
                <input
                  type="text"
                  value={formData.channelUrl}
                  onFocus={handleStartInteraction}
                  onChange={(e) => handleInputChange("channelUrl", e.target.value)}
                  placeholder="https://youtube.com/@yourchannel or @yourchannel"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b] focus:outline-none"
                />
              </div>

              {/* REQUIRED COMMERCIAL INTENT: Willingness to Pay */}
              <div className="space-y-2.5 pt-2 pb-1 p-4 rounded-xl bg-[#110e08] border border-[#c8b29b]/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block text-xs font-mono uppercase text-[#c8b29b] font-bold">
                    How much would you realistically be willing to pay per month for Serenity Studio? <span className="text-[#f87171]">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#4ade80]">Required</span>
                </div>
                <p className="text-[11px] text-[#9c958c] leading-relaxed">
                  Helps us shape commercial pricing tiers before the public release. Registration remains 100% free.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {WILLINGNESS_TO_PAY_OPTIONS.map((opt) => {
                    const isSelected = formData.willingnessToPay === opt;
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => handleInputChange("willingnessToPay", opt)}
                        className={`p-3 rounded-lg text-left text-xs transition-all border flex items-center justify-between ${
                          isSelected
                            ? "bg-[#221e17] border-[#c8b29b] text-[#f7f3ee] font-semibold shadow-sm"
                            : "bg-[#16130d] border-[#2e281f] text-[#9c958c] hover:border-[#3f3931] hover:text-[#eae1d7]"
                        }`}
                      >
                        <span>{opt}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 3: Channels Count and Monthly Long-form Volume */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Number of Channels Managed
                  </label>
                  <CustomSelect
                    value={formData.channelsCount}
                    onChange={(val) => handleInputChange("channelsCount", val)}
                    options={CHANNELS_COUNT_OPTIONS}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Monthly Long-Form Video Volume
                  </label>
                  <CustomSelect
                    value={formData.monthlyVideos}
                    onChange={(val) => handleInputChange("monthlyVideos", val)}
                    options={MONTHLY_VIDEOS_OPTIONS}
                  />
                </div>
              </div>

              {/* Row 4: Monthly Shorts Volume & Current Monthly Spend */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Monthly Shorts Volume
                  </label>
                  <CustomSelect
                    value={formData.monthlyShorts}
                    onChange={(val) => handleInputChange("monthlyShorts", val)}
                    options={MONTHLY_SHORTS_OPTIONS}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Current Monthly Production Spend
                  </label>
                  <CustomSelect
                    value={formData.monthlySpend}
                    onChange={(val) => handleInputChange("monthlySpend", val)}
                    options={SPEND_OPTIONS}
                  />
                </div>
              </div>

              {/* Row 5: Current Production Workflow */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                  How do you currently produce your videos?
                </label>
                <CustomSelect
                  value={formData.currentWorkflow}
                  onChange={(val) => handleInputChange("currentWorkflow", val)}
                  options={WORKFLOW_OPTIONS}
                />
              </div>

              {/* Row 6: Primary Problem / What to automate */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Primary bottleneck you want Serenity Studio to solve
                  </label>
                  <span className="text-[11px] font-mono text-[#736d64]">(Optional)</span>
                </div>
                <textarea
                  rows={2}
                  value={formData.primaryProblem}
                  onFocus={handleStartInteraction}
                  onChange={(e) => handleInputChange("primaryProblem", e.target.value)}
                  placeholder="e.g. Scripting takes too long, rendering motion infographics, or turning long-form videos into daily Shorts..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b] focus:outline-none"
                />
              </div>

              {/* Privacy and trust reassurance */}
              <div className="p-3.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-xs text-[#9c958c] flex items-center gap-2.5">
                <svg className="w-4 h-4 text-[#4ade80] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Free registration · No payment required · No YouTube channel authorization requested</span>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 px-6 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider hover:bg-[#d8c4ad] transition-all flex items-center justify-center gap-2 shadow-lg active:translate-y-0.5 disabled:opacity-50"
                >
                  <span>{submitting ? "Registering Your Interest..." : "Register Your Interest"}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
