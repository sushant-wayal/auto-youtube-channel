"use client";

import { useState, FormEvent, useEffect } from "react";
import { BETA_PRICING_CONFIG } from "@/lib/pricing-config";
import { trackEvent, getTrackingContext } from "@/lib/analytics";

interface FormData {
  name: string;
  email: string;
  channelUrl: string;
  channelsCount: string;
  monthlyVideos: string;
  currentWorkflow: string;
  monthlySpend: string;
  willingnessToPay: string;
  selectedTier: string;
  notes: string;
}

const WORKFLOW_OPTIONS = [
  "Entirely manually",
  "Using multiple AI tools",
  "Using an existing automation platform",
  "Outsourced to editors or an agency",
  "Other",
];

const CHANNELS_COUNT_OPTIONS = ["1 Channel", "2–3 Channels", "4–10 Channels", "10+ Channels"];
const MONTHLY_VIDEOS_OPTIONS = ["1–4 videos / mo", "5–10 videos / mo", "11–20 videos / mo", "20+ videos / mo"];

export default function EarlyAccessForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedCandidate, setSubmittedCandidate] = useState<{
    name: string;
    channelUrl: string;
    willingnessToPay: string;
  } | null>(null);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    channelUrl: "",
    channelsCount: "1 Channel",
    monthlyVideos: "5–10 videos / mo",
    currentWorkflow: "Using multiple AI tools",
    monthlySpend: BETA_PRICING_CONFIG.productionSpendRanges[1],
    willingnessToPay: "₹2,000–₹3,999",
    selectedTier: "Founding Creator Beta",
    notes: "",
  });

  const handleInputChange = (
    field: keyof FormData,
    value: string
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage(null);

    if (field === "willingnessToPay") {
      trackEvent("willingness_to_pay_selected", { range: value });
    }
  };

  const handleStep1Submit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setErrorMessage("Please enter your name.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!formData.channelUrl.trim() || formData.channelUrl.trim().length < 3) {
      setErrorMessage("Please provide your YouTube channel URL or @handle.");
      return;
    }

    trackEvent("early_access_step1_completed", {
      channels_count: formData.channelsCount,
      monthly_videos: formData.monthlyVideos,
    });

    setStep(2);
  };

  const handleFinalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const trackingContext = getTrackingContext();

    try {
      const res = await fetch("/api/early-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          utmSource: trackingContext.utm.source,
          utmMedium: trackingContext.utm.medium,
          utmCampaign: trackingContext.utm.campaign,
          referrer: trackingContext.referrer,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit application.");
      }

      trackEvent("form_submitted", {
        willingness_to_pay: formData.willingnessToPay,
        workflow: formData.currentWorkflow,
      });

      setSubmittedCandidate({
        name: formData.name,
        channelUrl: formData.channelUrl,
        willingnessToPay: formData.willingnessToPay,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed. Please check your network.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="apply" className="py-24 bg-[#16130d] border-t border-[#2e281f] relative">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>APPLICATION & QUALIFICATION</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Apply for Paid Beta Access
          </h2>
          <p className="text-base text-[#9c958c] max-w-xl mx-auto leading-relaxed">
            We review every channel application manually to ensure Serenity Studio is the right operational fit before onboarding.
          </p>
        </div>

        {/* Multi-Step Form Container */}
        <div className="mt-12 studio-card p-6 sm:p-10 bg-[#191610] border-[#2e281f]">
          {/* Progress Header */}
          {!success && (
            <div className="flex items-center justify-between pb-6 mb-8 border-b border-[#2e281f]">
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    step === 1
                      ? "bg-[#c8b29b] text-[#110e08]"
                      : "bg-[#4ade80] text-[#110e08]"
                  }`}
                >
                  {step === 1 ? "1" : "✓"}
                </span>
                <span className="text-xs sm:text-sm font-semibold text-[#f7f3ee]">
                  {step === 1 ? "Step 1: Channel Profile" : "Step 2: Operational Qualification"}
                </span>
              </div>
              <div className="text-xs font-mono text-[#9c958c]">
                {step === 1 ? "Step 1 of 2" : "Step 2 of 2"}
              </div>
            </div>
          )}

          {/* Success Confirmation View */}
          {success && submittedCandidate ? (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#4ade80]/10 border border-[#4ade80]/30 mx-auto flex items-center justify-center text-[#4ade80]">
                <svg
                  className="w-8 h-8"
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
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-[#f7f3ee]">
                  Application Received, {submittedCandidate.name}!
                </h3>
                <p className="text-sm text-[#eae1d7] max-w-lg mx-auto leading-relaxed">
                  We've logged your channel ({submittedCandidate.channelUrl}) for <strong>Batch 01 Founding Creator Access</strong>.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-xl bg-[#110e08] border border-[#2e281f] text-left text-xs space-y-2">
                <div className="text-[#c8b29b] font-mono uppercase font-semibold">
                  What happens next:
                </div>
                <ul className="space-y-2 text-[#9c958c]">
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ade80]">1.</span>
                    <span>Applications are reviewed within 30 days. You will be contacted by email once your application has been reviewed.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ade80]">2.</span>
                    <span>No payment is charged until your channel is accepted into the beta.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#4ade80]">3.</span>
                    <span>Accepted creators receive an onboarding invitation to configure their automated pipeline in Serenity Studio.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-2 text-xs font-mono text-[#736d64]">
                A confirmation copy has been queued for {formData.email}.
              </div>
            </div>
          ) : step === 1 ? (
            /* STEP 1: CHANNEL PROFILE */
            <form onSubmit={handleStep1Submit} className="space-y-6 text-left">
              {errorMessage && (
                <div className="p-3.5 rounded-lg bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]">
                  {errorMessage}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    placeholder="alex@channel.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                  YouTube Channel URL or @handle *
                </label>
                <input
                  type="text"
                  required
                  value={formData.channelUrl}
                  onChange={(e) => handleInputChange("channelUrl", e.target.value)}
                  placeholder="https://youtube.com/@yourchannel or @yourchannel"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Number of Channels Managed
                  </label>
                  <select
                    value={formData.channelsCount}
                    onChange={(e) => handleInputChange("channelsCount", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] focus:border-[#c8b29b]"
                  >
                    {CHANNELS_COUNT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#110e08]">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                    Monthly Publishing Volume
                  </label>
                  <select
                    value={formData.monthlyVideos}
                    onChange={(e) => handleInputChange("monthlyVideos", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] focus:border-[#c8b29b]"
                  >
                    {MONTHLY_VIDEOS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt} className="bg-[#110e08]">
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider hover:bg-[#d8c4ad] transition-all flex items-center justify-center gap-2"
                >
                  <span>Continue to Qualification Questions</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: OPERATIONAL QUALIFICATION & WILLINGNESS TO PAY */
            <form onSubmit={handleFinalSubmit} className="space-y-6 text-left">
              {errorMessage && (
                <div className="p-3.5 rounded-lg bg-[#f87171]/10 border border-[#f87171]/30 text-xs text-[#f87171]">
                  {errorMessage}
                </div>
              )}

              {/* Qualification Q1: Current Workflow */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                  How do you currently produce your videos? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {WORKFLOW_OPTIONS.map((wf) => (
                    <button
                      type="button"
                      key={wf}
                      onClick={() => handleInputChange("currentWorkflow", wf)}
                      className={`p-3 rounded-lg text-left text-xs transition-all border ${
                        formData.currentWorkflow === wf
                          ? "bg-[#221e17] border-[#c8b29b] text-[#f7f3ee] font-semibold"
                          : "bg-[#110e08] border-[#2e281f] text-[#9c958c] hover:border-[#3f3931]"
                      }`}
                    >
                      {wf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qualification Q2: Current Monthly Production Spend */}
              <div className="space-y-2">
                <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                  How much do you currently spend monthly on content production? *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BETA_PRICING_CONFIG.productionSpendRanges.map((spend) => (
                    <button
                      type="button"
                      key={spend}
                      onClick={() => handleInputChange("monthlySpend", spend)}
                      className={`p-2.5 rounded-lg text-left text-xs transition-all border ${
                        formData.monthlySpend === spend
                          ? "bg-[#221e17] border-[#c8b29b] text-[#f7f3ee] font-semibold"
                          : "bg-[#110e08] border-[#2e281f] text-[#9c958c] hover:border-[#3f3931]"
                      }`}
                    >
                      {spend}
                    </button>
                  ))}
                </div>
              </div>

              {/* Qualification Q3: Willingness to Pay */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-mono uppercase text-[#c8b29b] font-semibold">
                    What would you be willing to pay monthly for a platform that automates most of this workflow? *
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BETA_PRICING_CONFIG.qualificationPriceRanges.map((priceRange) => (
                    <button
                      type="button"
                      key={priceRange}
                      onClick={() => handleInputChange("willingnessToPay", priceRange)}
                      className={`p-3 rounded-lg text-left text-xs transition-all border ${
                        formData.willingnessToPay === priceRange
                          ? "bg-[#221e17] border-[#c8b29b] text-[#c8b29b] font-bold shadow-sm"
                          : "bg-[#110e08] border-[#2e281f] text-[#9c958c] hover:border-[#3f3931]"
                      }`}
                    >
                      {priceRange}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-mono uppercase text-[#eae1d7]">
                  What is your biggest YouTube operational bottleneck right now? (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="e.g. Scripting takes too long, or clipping into Shorts is exhausting..."
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#110e08] border border-[#2e281f] text-sm text-[#f7f3ee] placeholder-[#736d64] focus:border-[#c8b29b]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-3 rounded-lg bg-[#110e08] border border-[#2e281f] text-xs font-mono uppercase text-[#9c958c] hover:text-[#f7f3ee]"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 px-6 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider hover:bg-[#d8c4ad] transition-all disabled:opacity-50"
                >
                  {submitting ? "Submitting Application..." : "Submit Beta Application"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

