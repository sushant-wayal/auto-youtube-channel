// =========================================================================
// SERENITY STUDIO — COMMERCIAL & EARLY ACCESS CONFIGURATION
// Centralized configuration for beta pricing, tier limits, and qualification
// =========================================================================

export interface PricingTier {
  id: string;
  name: string;
  badge: string;
  headline: string;
  description: string;
  // Beta pricing configuration:
  priceMonthlyINR: number;
  priceMonthlyUSD: number;
  billingPeriod: string;
  priceNote: string;
  reviewPeriodNote: string;
  highlighted: boolean;
  ctaText: string;
  supportedScope: string;
  includedFeatures: string[];
  operationalInclusions: string[];
}

export const BETA_PRICING_CONFIG: {
  currentBatch: string;
  tier: PricingTier;
  qualificationPriceRanges: string[];
  productionSpendRanges: string[];
} = {
  currentBatch: "Batch 01 — Founding Creator Cohort",

  // Founding Creator Tier (Verified beta offering)
  tier: {
    id: "founding-creator",
    name: "Founding Creator Beta",
    badge: "Limited Founding Creator Cohort",
    headline: "Complete Production Automation Pipeline",
    description:
      "Operational access to Serenity Studio's connected pipeline for individual YouTube operators. From topic ingestion and structured scripting to 1080p scene rendering and scheduled publishing.",
    priceMonthlyINR: 2999, // ₹2,999/month
    priceMonthlyUSD: 39,   // ~$39/month
    billingPeriod: "per month",
    priceNote: "Your founding price is locked for the first 12 months. Renews monthly, cancel anytime.",
    reviewPeriodNote: "Applications are reviewed within 30 days. You will be contacted by email once your application has been reviewed. No payment is charged until your channel is accepted into the beta.",
    supportedScope: "1 Connected YouTube Channel during initial beta",
    highlighted: true,
    ctaText: "Apply for Paid Beta Access",
    includedFeatures: [
      "Canonical 8-stage automated production pipeline",
      "Topic ingestion & editorial ideas backlog management",
      "Beat-by-beat multi-scene script structuring",
      "Synchronized voiceover audio synthesis",
      "1080p programmatic scene rendering & multi-track assembly",
      "Programmatic high-contrast YouTube thumbnail generation",
      "Scheduled YouTube long-form publishing windows",
      "Automated vertical Shorts generation from long-form master videos",
    ],
    operationalInclusions: [
      "Speech synthesis and motion graphic rendering included within applicable beta usage limits",
      "Dedicated rendering queue and cloud project storage included",
      "Direct technical feedback channel with the core engineering team",
      "Specific monthly video and rendering allowances confirmed during onboarding based on your publishing schedule",
    ],
  },

  // Qualification selectable ranges requested in prompt:
  qualificationPriceRanges: [
    "Less than ₹500",
    "₹500–₹999",
    "₹1,000–₹1,999",
    "₹2,000–₹3,999",
    "₹4,000–₹5,999",
    "₹6,000 or more",
    "I would not currently pay for this",
  ],

  // Spend ranges as strictly specified in prompt:
  productionSpendRanges: [
    "₹0",
    "Less than ₹1,000",
    "₹1,000–₹3,000",
    "₹3,000–₹5,000",
    "₹5,000–₹10,000",
    "More than ₹10,000",
  ],
};
