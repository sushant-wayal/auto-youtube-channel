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

const PRODUCTION_PIPELINE_STEPS: WorkflowStep[] = [
  {
    number: "01",
    stage: "Populate Ideas",
    headline: "Editorial Queue & Topic Backlog",
    description:
      "Concepts are organized into curriculum tracks or standalone releases. When a production slot opens, the concept automatically initiates active pipeline execution.",
    telemetryMetric: "Queue Backlog Ingested",
    statusTag: "Queue Active",
  },
  {
    number: "02",
    stage: "Generate Script",
    headline: "Beat-by-Beat Scene Structuring",
    description:
      "Generates structured narrative scripts broken into visual beats, ensuring voiceover timing directly aligns with corresponding on-screen graphics.",
    telemetryMetric: "8 Scenes Structured",
    statusTag: "Scripting Complete",
  },
  {
    number: "03",
    stage: "Render Scenes",
    headline: "1080p Motion Graphic Rendering",
    description:
      "Renders dynamic technical diagrams, motion typography, and infographic sequences using code-driven visual templates rather than generic stock footage.",
    telemetryMetric: "1080p Scenes Rendered",
    statusTag: "Render Completed",
  },
  {
    number: "04",
    stage: "Voiceover Synthesis",
    headline: "Speech Synthesis & Audio Timing",
    description:
      "Synthesizes natural narration with word-level timestamps so animations and key on-screen highlights trigger in sync with spoken points.",
    telemetryMetric: "Audio Tracks Synchronized",
    statusTag: "Audio Mastered",
  },
  {
    number: "05",
    stage: "Assembled Video",
    headline: "Multi-Track Master Assembly",
    description:
      "Binds rendered visual scenes, narration audio, background ambient tracks, and sound cues into a single broadcast-ready master video.",
    telemetryMetric: "Master Video Assembled",
    statusTag: "Master Ready",
  },
  {
    number: "06",
    stage: "Generated Thumbnail",
    headline: "High-Contrast Thumbnail Packaging",
    description:
      "Generates custom YouTube thumbnails with high-contrast text hierarchies and branded visual styling for clean display across mobile and desktop feeds.",
    telemetryMetric: "1920x1080 High-Res",
    statusTag: "Thumbnail Packaged",
  },
  {
    number: "07",
    stage: "Upload to YouTube",
    headline: "Scheduled Publishing Windows",
    description:
      "Directly stages uploads to YouTube Studio, sets formatted metadata, and schedules release for configured daily broadcast windows (e.g. 18:30 IST).",
    telemetryMetric: "Broadcast Scheduled",
    statusTag: "Upload Complete",
  },
  {
    number: "08",
    stage: "Shorts Packaging",
    headline: "Automated Shorts Scheduling",
    description:
      "Extracts key segments, reformats into vertical 9:16 Shorts with dynamic captions, and schedules release across configured daily short-form slots.",
    telemetryMetric: "5 Shorts Slots Configured",
    statusTag: "Shorts Synced",
  },
];

export default function WorkflowSection() {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const currentStep = PRODUCTION_PIPELINE_STEPS[activeStepIndex];

  const handleStepSelect = (index: number) => {
    setActiveStepIndex(index);
    trackEvent("workflow_step_inspected", {
      step_number: PRODUCTION_PIPELINE_STEPS[index].number,
      step_name: PRODUCTION_PIPELINE_STEPS[index].stage,
    });
  };

  return (
    <section id="workflow" className="py-24 bg-[#16130d] border-t border-[#2e281f] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
            <span>CANONICAL 8-STAGE PIPELINE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#f7f3ee]">
            From Video Idea to Published Content. One Connected Automated Workflow.
          </h2>
          <p className="text-base sm:text-lg text-[#9c958c] leading-relaxed">
            Serenity Studio connects the complete production lifecycle into 8 sequential stages, from raw topic ingestion to scheduled publishing.
          </p>
        </div>

        {/* Step Selector Horizontal Pills / Steps */}
        <div className="mt-14 overflow-x-auto pb-4">
          <div className="flex items-center gap-2 min-w-max mx-auto justify-center">
            {PRODUCTION_PIPELINE_STEPS.map((step, idx) => (
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
                <span className="text-[#c8b29b]">Stage Output:</span>
                <span className="text-[#f7f3ee] font-semibold">{currentStep.telemetryMetric}</span>
              </div>
            </div>

            {/* Right: Architectural Visualizer */}
            <div className="md:col-span-5 p-5 rounded-xl bg-[#110e08] border border-[#2e281f] space-y-3">
              <div className="text-[11px] font-mono uppercase text-[#736d64] tracking-wider border-b border-[#2e281f] pb-2">
                Canonical 8 Stages
              </div>

              <div className="space-y-1.5">
                {PRODUCTION_PIPELINE_STEPS.map((s, i) => (
                  <div
                    key={s.number}
                    className={`flex items-center justify-between text-xs py-1 px-2.5 rounded transition-colors ${
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

        {/* Distinct Ongoing Channel Management Capability */}
        <div className="mt-8 max-w-4xl mx-auto p-5 rounded-xl bg-[#110e08] border border-[#2e281f] text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#c8b29b]/10 border border-[#c8b29b]/20 text-[10px] font-mono uppercase text-[#c8b29b]">
                Ongoing Operations
              </span>
              <span className="text-xs font-semibold text-[#f7f3ee]">
                Autonomous Audience Response
              </span>
            </div>
            <p className="text-xs text-[#9c958c]">
              Once videos are published, Serenity Studio's audience operations module handles comment responses with configurable brand personas.
            </p>
          </div>
          <span className="text-xs font-mono text-[#c8b29b] shrink-0">
            Post-Publish Layer
          </span>
        </div>
      </div>
    </section>
  );
}
