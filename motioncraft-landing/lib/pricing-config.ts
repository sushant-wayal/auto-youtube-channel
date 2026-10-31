// =========================================================================
// SERENITY STUDIO — COMMERCIAL & EARLY ACCESS CONFIGURATION
// Edit this file to adjust the proposed beta price, quotas, and tier details
// =========================================================================

export interface PricingTier {
  id: string;
  name: string;
  badge: string;
  headline: string;
  description: string;
  // Easily change beta pricing here:
  priceMonthlyINR: number;
  priceMonthlyUSD: number;
  billingPeriod: string;
  priceNote: string;
  slotsAvailable: number;
  highlighted: boolean;
  ctaText: string;
  includedFeatures: string[];
  operationalBenefits: string[];
}

export const BETA_PRICING_CONFIG: {
  currentBatch: string;
  cohortCapacity: number;
  cohortRemaining: number;
  tier: PricingTier;
  qualificationPriceRanges: string[];
  productionSpendRanges: string[];
} = {
  currentBatch: "Batch 01 — Founding Creator Cohort",
  cohortCapacity: 25,
  cohortRemaining: 7,

  // Editable Founding Creator Tier
  tier: {
    id: "founding-creator",
    name: "Founding Creator Access",
    badge: "Strictly Limited to 25 Channels",
    headline: "Full End-to-End Operational Engine",
    description:
      "Direct access to Serenity Studio's complete automation pipeline, from structured scripting and 1080p scene rendering to synchronized release windows.",
    // Edit this single price value whenever you want to test different willingness-to-pay levels:
    priceMonthlyINR: 2999, // ₹2,999/month
    priceMonthlyUSD: 39,   // ~$39/month
    billingPeriod: "per month",
    priceNote: "Founding rate locked for life. Renews monthly, cancel anytime.",
    slotsAvailable: 7,
    highlighted: true,
    ctaText: "Apply for Paid Beta Access",
    includedFeatures: [
      "End-to-end 8-stage automated production pipeline",
      "Editorial ideas queue with series & standalone tracks",
      "Structured multi-scene script generator",
      "Synchronized voiceover audio synthesis",
      "1080p automated scene rendering & video assembly",
      "Programmatic high-CTR YouTube thumbnails",
      "Automated YouTube long-form scheduling (Prime windows)",
      "5-slot automated Shorts clipping & retention scheduling",
      "Autonomous Gemini-powered comment response & persona tuning",
    ],
    operationalBenefits: [
      "Priority GPU rendering queue & dedicated storage",
      "Direct Slack/Discord channel with core engineering team",
      "Shape upcoming features, scene templates, and voice styles",
      "No per-video rendering surcharges during the beta period",
    ],
  },

  // Qualification selectable ranges requested in prompt:
  qualificationPriceRanges: [
    "Less than ₹500",
    "₹500–₹999",
    "₹1,000–₹1,999",
    "₹2,000–₹3,999",
    "₹4,000–₹5,999",
    "More than ₹6,000",
    "I would not currently pay for this",
  ],

  productionSpendRanges: [
    "₹0 (All manual / free tools)",
    "₹1,000–₹5,000 ($12–$60)",
    "₹5,000–₹15,000 ($60–$180)",
    "₹15,000–₹40,000 ($180–$500)",
    "More than ₹40,000 ($500+)",
  ],
};

