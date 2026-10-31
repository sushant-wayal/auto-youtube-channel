"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

interface WorkflowStep {
  number: string;
  stage: string;
  headline: string;
  description: string;
  telemetryMetric: string;
  statusTag: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    number: "01",
    stage: "Topic Ingestion & Queue Dispatch",
    headline: "Editorial Queue & Series Architecture",
    description:
      "Concepts are organized into multi-episode curriculum tracks or standalone releases. When a slot opens, the concept automatically enters active production.",
    telemetryMetric: "5 Concepts Ready · 4 Queued",
    statusTag: "Queue Active",
  },
  {
    number: "02",
    stage: "Structured Script Generation",
    headline: "Beat-by-Beat Scene Structuring",
    description:
      "Generates research-backed narrative scripts divided into explicit visual beats, ensuring voiceover timing perfectly matches on-screen graphics.",
    telemetryMetric: "8 Scenes Structured",
    statusTag: "Scripting Complete",
  },
  {
    number: "03",
    stage: "Voiceover Synthesis & Timing",
    headline: "Natural Voice Synthesis",
    description:
      "Produces clean, studio-grade narration with precise word-level timestamps so animations trigger exactly on key verbal emphasis points.",
    telemetryMetric: "8 Audio Tracks Synchronized",
    statusTag: "Audio Mastered",
  },
  {
    number: "04",
    stage: "Motion Graphics & Scene Rendering",
    headline: "Programmatic 1080p Visual Rendering",
    description:
      "Renders dynamic technical diagrams, motion typography, and infographic sequences using real web code rather than blurry stock clips.",
    telemetryMetric: "8 Scenes Rendered (1080p)",
    statusTag: "Render Completed",
  },
  {
    number: "05",
    stage: "Video Assembly & Sound Design",
    headline: "Multi-Track Master Assembly",
    description:
      "Binds video scenes, narration audio, background ambient tracks, and sound effects into a single seamless broadcast-ready master video.",
    telemetryMetric: "0 NAL / DTS Corruptions",
    statusTag: "Master Ready",
  },
  {
    number: "06",
    stage: "Programmatic Thumbnail Generation",
    headline: "High-CTR Visuals",
    description:
      "Generates crisp, branded YouTube thumbnails with high-contrast text hierarchies tailored for high click-through rates across devices.",
    telemetryMetric: "1920x1080 High-Res",
    statusTag: "Thumbnail Packaged",
  },
  {
    number: "07",
    stage: "Daily Prime Broadcast Publishing",
    headline: "Automated YouTube Upload & Scheduling",
    description:
      "Directly uploads to YouTube Studio, sets optimized titles, descriptions, and schedules release for the prime desktop window (e.g. 18:30 IST).",
    telemetryMetric: "Daily Episode Window Set",
    statusTag: "Broadcast Scheduled",
  },
  {
    number: "08",
    stage: "5-Slot Shorts Syndication",
    headline: "Peak Retention Vertical Distribution",
    description:
      "Automatically extracts high-hook segments, reformats into vertical 9:16 Shorts with dynamic captions, and schedules across 5 peak-retention daily slots.",
    telemetryMetric: "5 Slots · ~87-92% Retention",
    statusTag: "Shorts Synced",
  },
  {
    number: "09",
    stage: "Autonomous Audience Engagement",
    headline: "Gemini-Powered Comment Tuning",
    description:
      "Engages with viewers autonomously using tuned brand personas (e.g. FRIENDLY), answering technical questions and de-escalating critiques.",
    telemetryMetric: "Live Posted Replies · Sentiment Tracked",
    statusTag: "Audience Active",
  },
];

export default function WorkflowSection() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const currentStep = WORKFLOW_STEPS[activeStepIndex];

  const handleStepSelect = (index: number) => {
    setActiveStepIndex(index);
    trackEvent("workflow_step_inspected", {
      step_number: WORKFLOW_STEPS[index].number,
      step_name: WORKFLOW_STEPS[index].stage,
    });
  };

  return (
    <section id="workflow" className="py-24 bg-[#16130d] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>THE CONNECTED SYSTEM</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            From Video Idea to Published Content. One Connected Automated Workflow.
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            Serenity Studio is not a disjointed set of prompts. It is an end-to-end production operating system where every phase flows into the next without human friction.
          </p>
        </div>

        {/* Step Selector Horizontal Pills / Steps */}
        <div className="mt-14 overflow-x-auto pb-4">
          <div className="flex items-center gap-2 min-w-max mx-auto justify-center">
            {WORKFLOW_STEPS.map((step, idx) => (
              <button
                key={step.number}
                onClick={() => handleStepSelect(idx)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono transition-all border ${
                  activeStepIndex === idx
                    ? "bg-[#221e17] border-[#c8b29b] text-[#f7f3ee] shadow-sm"
                    : "bg-[#110e08] border-[#2e281f] text-[#9c958c] hover:border-[#3f3931] hover:text-[#eae1d7]"
                }`}
              >
                <span className={`font-bold ${activeStepIndex === idx ? "text-[#c8b29b]" : "text-[#736d64]"}`}>
                  {step.number}
                </span>
                <span className="truncate max-w-[140px] sm:max-w-none">
                  {step.stage}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Stage Detailed Card */}
        <div className="mt-8 max-w-4xl mx-auto studio-card p-6 sm:p-10 bg-[#191610] border-[#2e281f]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Left: Step Information */}
            <div className="md:col-span-7 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold text-[#c8b29b]">
                  Stage {currentStep.number}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-[#4ade80]/10 border border-[#4ade80]/20 text-[#4ade80]">
                  {currentStep.statusTag}
                </span>
              </div>

              <h3 className="text-xl sm:text-2xl font-semibold text-[#f7f3ee]">
                {currentStep.headline}
              </h3>

              <p className="text-sm sm:text-base text-[#eae1d7] leading-relaxed">
                {currentStep.description}
              </p>

              <div className="pt-2 flex items-center gap-2 text-xs font-mono text-[#9c958c]">
                <span className="text-[#c8b29b]">Verified Telemetry:</span>
                <span className="text-[#f7f3ee] font-semibold">{currentStep.telemetryMetric}</span>
              </div>
            </div>

            {/* Right: Architectural Visualizer */}
            <div className="md:col-span-5 p-5 rounded-xl bg-[#110e08] border border-[#2e281f] space-y-3">
              <div className="text-[11px] font-mono uppercase text-[#736d64] tracking-wider border-b border-[#2e281f] pb-2">
                Pipeline Stage Progression
              </div>

              <div className="space-y-2">
                {WORKFLOW_STEPS.map((s, i) => (
                  <div
                    key={s.number}
                    className={`flex items-center justify-between text-xs py-1.5 px-2.5 rounded transition-colors ${
                      i === activeStepIndex
                        ? "bg-[#221e17] text-[#c8b29b] font-semibold border border-[#c8b29b]/30"
                        : i < activeStepIndex
                        ? "text-[#4ade80]"
                        : "text-[#736d64]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px]">{s.number}</span>
                      <span>{s.stage}</span>
                    </div>
                    <span>
                      {i < activeStepIndex ? "✓" : i === activeStepIndex ? "●" : "○"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

