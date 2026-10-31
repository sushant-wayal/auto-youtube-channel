"use client";

import Image from "next/image";
import { trackEvent } from "@/lib/analytics";

interface ShowcaseFeature {
  id: string;
  badge: string;
  headline: string;
  subhead: string;
  description: string;
  screenshotUrl: string;
  screenshotAlt: string;
  metrics: { label: string; value: string }[];
  bulletPoints: string[];
  imageFirst: boolean;
}

const SHOWCASE_FEATURES: ShowcaseFeature[] = [
  {
    id: "editorial-queue",
    badge: "IDEATION & QUEUE DISPATCH",
    headline: "Editorial Ideas Queue: Never Stare at a Blank Screen",
    subhead: "5 Concepts Ready for Production · 4 Queued for Scripting",
    description:
      "Manage your content backlog with clear visibility into standalone releases and multi-episode series tracks. Concepts move through dedicated validation stages before entering the automated script generator.",
    screenshotUrl: "/screenshots/editorial-queue.jpg",
    screenshotAlt: "Serenity Studio Editorial Queue mobile application screen",
    metrics: [
      { label: "Ready Concepts", value: "5 Ready" },
      { label: "Queued Jobs", value: "4 Queued" },
      { label: "Format Filter", value: "Series & Standalone" },
    ],
    bulletPoints: [
      "Prioritize high-conviction concepts with 'Next in Pipeline' designation",
      "Seamless separation between standalone deep-dives and recurring series",
      "Automatic ingestion from research feeds directly into structured scene prompts",
    ],
    imageFirst: false,
  },
  {
    id: "series-curriculum",
    badge: "SERIES ARCHITECTURE & LIBRARY",
    headline: "Curate Deep Multi-Episode Tracks That Build Loyal Audiences",
    subhead: "9 Tracks · 81 Published Episodes · 21 Planned",
    description:
      "YouTube channels grow fastest when viewers binge multi-part curriculum tracks. Serenity Studio tracks episode progression, queue backlog, and completion percentages for every series on your channel.",
    screenshotUrl: "/screenshots/series-curriculum.jpg",
    screenshotAlt: "Serenity Studio Series Architecture mobile screen",
    metrics: [
      { label: "Curated Tracks", value: "9 Series" },
      { label: "Published Episodes", value: "81 Videos" },
      { label: "Planned Backlog", value: "21 Planned" },
    ],
    bulletPoints: [
      "Track episode progression and backlog completion across entire series tracks directly from your dashboard",
      "Maintains narrative continuity and recurring visual motifs across all episodes",
      "One-click 'Push to Queue' to initiate the next scheduled episode",
    ],
    imageFirst: true,
  },
  {
    id: "publishing-schedules",
    badge: "PRECISION PUBLISHING & SHORTS",
    headline: "Scheduled Daily Long-Form Releases & Multi-Slot Shorts Distribution",
    subhead: "Configurable Daily Broadcast Windows & Automated Shorts Scheduling",
    description:
      "Maintain a predictable publishing cadence without manual intervention. Serenity Studio automates your daily long-form releases and distributes vertical Shorts across up to 5 scheduled daily windows configured for your channel's schedule.",
    screenshotUrl: "/screenshots/publishing-schedules.jpg",
    screenshotAlt: "Serenity Studio Publishing Schedules screen",
    metrics: [
      { label: "Long-Form Broadcast", value: "18:30 Daily" },
      { label: "Shorts Slots", value: "5 Scheduled Slots" },
      { label: "Cadence Mode", value: "Configurable Windows" },
    ],
    bulletPoints: [
      "Scheduled long-form releases timed to peak desktop consumption windows",
      "5 automated vertical Shorts slots: Dinner Window (19:45), Evening Prime (20:45), Early Evening (18:45)",
      "Automatic thumbnail linking and 'Reset Optimal' schedule synchronization",
    ],
    imageFirst: false,
  },
  {
    id: "audience-engagement",
    badge: "AUTONOMOUS ENGAGEMENT & RETENTION",
    headline: "Autonomous Comment Reply: Always Engaged",
    subhead: "Autonomous Community Engagement with Tuned Brand Personas",
    description:
      "Viewer retention isn't just about uploading videos—it's about responding to early feedback. Serenity Studio uses autonomous response intelligence to review audience comments, prioritize technical questions, and reply empathetically to critiques.",
    screenshotUrl: "/screenshots/audience-engagement.jpg",
    screenshotAlt: "Serenity Studio Audience Response & Tuning screen",
    metrics: [
      { label: "Sent Live", value: "16 Replies" },
      { label: "Active Persona", value: "Friendly" },
      { label: "Priority Mode", value: "Questions Priority" },
    ],
    bulletPoints: [
      "Tunable personas (e.g. FRIENDLY) with configurable limits (10 replies/run)",
      "Sentiment categorization (Negative, Question, Praise) with context-aware responses",
      "Simulated dry-run mode to verify reply quality before enabling live posting",
    ],
    imageFirst: true,
  },
];

export default function ProductShowcase() {
  const handleInspect = (featureId: string) => {
    trackEvent("screenshot_tab_switched", { feature_id: featureId });
  };

  return (
    <section id="showcase" className="py-24 bg-[#110e08] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>VERIFIED CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            Built From the Ground Up For Serious YouTube Channels
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            These are actual application screens from Serenity Studio in production.
            No mockup graphics or theoretical features. Counters and metrics reflect live UI telemetry. Counters and metrics reflect live UI telemetry.
          </p>
        </div>

        {/* Alternating Feature Showcase */}
        <div className="mt-20 space-y-28">
          {SHOWCASE_FEATURES.map((feature) => (
            <div
              key={feature.id}
              className={`grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center`}
            >
              {/* Image Column */}
              <div
                className={`lg:col-span-5 flex justify-center ${
                  feature.imageFirst ? "lg:order-1" : "lg:order-2"
                }`}
              >
                <div className="relative w-full max-w-[340px] rounded-2xl overflow-hidden border border-[#2e281f] shadow-2xl bg-[#16130d] group">
                  <Image
                    src={feature.screenshotUrl}
                    alt={feature.screenshotAlt}
                    width={738}
                    height={1599}
                    className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                  />
                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-[#110e08]/90 border border-[#2e281f] text-[10px] font-mono text-[#c8b29b]">
                    Live Screen
                  </div>
                </div>
              </div>

              {/* Text Column */}
              <div
                className={`lg:col-span-7 space-y-6 text-left ${
                  feature.imageFirst ? "lg:order-2" : "lg:order-1"
                }`}
              >
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
                  {feature.badge}
                </div>

                <h3 className="text-2xl sm:text-3xl font-bold text-[#f7f3ee] leading-tight">
                  {feature.headline}
                </h3>

                <p className="text-sm font-mono text-[#c8b29b]">
                  {feature.subhead}
                </p>

                <p className="text-sm sm:text-base text-[#eae1d7] leading-relaxed">
                  {feature.description}
                </p>

                {/* Metrics row */}
                <div className="grid grid-cols-3 gap-3 py-2">
                  {feature.metrics.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-[#16130d] border border-[#2e281f]"
                    >
                      <div className="text-[11px] text-[#9c958c] font-mono">{m.label}</div>
                      <div className="text-xs sm:text-sm font-semibold text-[#f7f3ee] mt-0.5">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bullet Points */}
                <ul className="space-y-2.5 pt-2">
                  {feature.bulletPoints.map((bp, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-[#eae1d7]">
                      <svg
                        className="w-4 h-4 text-[#4ade80] shrink-0 mt-0.5"
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
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

