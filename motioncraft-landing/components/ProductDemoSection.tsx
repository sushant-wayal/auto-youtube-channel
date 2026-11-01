"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

export default function ProductDemoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Milestone deduplication state per playback session
  const [hasImpressed, setHasImpressed] = useState(false);
  const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
  const milestonesRef = useRef({
    p25: false,
    p50: false,
    p75: false,
    p100: false,
  });

  // Track visibility impression via IntersectionObserver (at least 50% visible)
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && !hasImpressed) {
          setHasImpressed(true);
          trackEvent("video_impression", {
            video: "serenity_studio_product_demo",
            duration: 112, // ~1:52
          });
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasImpressed]);

  // Video playback event handlers
  const handlePlay = () => {
    if (!hasStartedPlaying) {
      setHasStartedPlaying(true);
      trackEvent("video_play", {
        video: "serenity_studio_product_demo",
        section: "product_demo_section",
      });
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const percent = (video.currentTime / video.duration) * 100;

    if (percent >= 25 && !milestonesRef.current.p25) {
      milestonesRef.current.p25 = true;
      trackEvent("video_progress_25", { video: "serenity_studio_product_demo" });
    }
    if (percent >= 50 && !milestonesRef.current.p50) {
      milestonesRef.current.p50 = true;
      trackEvent("video_progress_50", { video: "serenity_studio_product_demo" });
    }
    if (percent >= 75 && !milestonesRef.current.p75) {
      milestonesRef.current.p75 = true;
      trackEvent("video_progress_75", { video: "serenity_studio_product_demo" });
    }
  };

  const handleEnded = () => {
    if (!milestonesRef.current.p100) {
      milestonesRef.current.p100 = true;
      trackEvent("video_progress_100", { video: "serenity_studio_product_demo" });
    }
  };

  const handleCtaClick = () => {
    trackEvent("cta_click", {
      section: "product_demo_section",
      cta: "register_interest_demo",
    });
  };

  return (
    <section
      id="product-demo"
      ref={containerRef}
      className="py-20 md:py-28 bg-[#110e08] border-t border-[#2e281f] relative overflow-hidden"
    >
      {/* Subtle ambient spotlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] h-[320px] bg-[#c8b29b]/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center space-y-6">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#191610] border border-[#2e281f] text-xs font-mono text-[#c8b29b]">
          <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
          <span className="uppercase tracking-wider font-semibold">
            1:52 Product Demonstration
          </span>
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f7f3ee]">
          See Serenity Studio in Action
        </h2>

        {/* Short supporting description */}
        <p className="text-base sm:text-lg text-[#9c958c] max-w-2xl mx-auto leading-relaxed">
          Watch how Serenity Studio connects ideas, structured scripting, 1080p motion graphic rendering, synchronized voiceovers, and daily Shorts publishing into one automated workflow.
        </p>

        {/* Video Player Card in Premium Obsidian & Sandstone Bezel */}
        <div className="mt-10 max-w-4xl mx-auto">
          <div className="studio-card p-2 sm:p-4 bg-[#16130d] border-[#2e281f] shadow-2xl rounded-2xl overflow-hidden">
            {/* Window bar */}
            <div className="flex items-center justify-between pb-3 px-2 border-b border-[#2e281f] text-xs font-mono text-[#9c958c]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e281f]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e281f]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#2e281f]" />
                <span className="ml-2 text-[#eae1d7] font-semibold text-xs tracking-wider uppercase">
                  Serenity Studio · Product Explainer
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-[#c8b29b]/10 border border-[#c8b29b]/25 text-[#c8b29b] text-[11px] font-semibold">
                  1080p Full HD
                </span>
                <span className="hidden sm:inline text-[#736d64]">01:52</span>
              </div>
            </div>

            {/* Responsive 16:9 Video Container */}
            <div className="relative mt-3 aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#2e281f]/80">
              <video
                ref={videoRef}
                controls
                playsInline
                preload="metadata"
                poster="/videos/serenity-studio-demo-poster.jpg"
                onPlay={handlePlay}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="w-full h-full object-cover"
              >
                <source src="/videos/serenity-studio-demo.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>

            {/* Video footer caption and CTA */}
            <div className="pt-4 px-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9c958c]">
              <div className="flex items-center gap-2 text-left">
                <span className="text-[#4ade80]">✦</span>
                <span>Unedited workflow capture from the Serenity Studio production pipeline.</span>
              </div>
              <a
                href="#register"
                onClick={handleCtaClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#c8b29b] text-[#110e08] font-bold text-xs uppercase tracking-wider hover:bg-[#d8c4ad] transition-all shrink-0 active:translate-y-0.5"
              >
                <span>Register Your Interest</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

