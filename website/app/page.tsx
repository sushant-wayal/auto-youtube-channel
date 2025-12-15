"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Video, FileText, Mic, Film, Image, Clapperboard, Sparkles, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoScript, VideoAssets, VideoAssemblyResult, ThumbnailResult } from "@/lib/pipeline/types";
import { createJob, getJobStatus, JobType } from "@/lib/redis-client";
import { PipelineState, initialPipelineState, StepStatus, createShortGenerationState, ShortGenerationState } from "@/components/pipeline/types";
import PipelineProgress, { RetryableStep } from "@/components/pipeline/PipelineProgress";
import VideoIdeaInput from "@/components/pipeline/VideoIdeaInput";
import ScriptDisplay from "@/components/pipeline/ScriptDisplay";
import VideoAssetsDisplay from "@/components/pipeline/VideoAssetsDisplay";
import VoiceOverDisplay from "@/components/pipeline/VoiceOverDisplay";
import VideoResultDisplay from "@/components/pipeline/VideoResultDisplay";
import ThumbnailDisplay from "@/components/pipeline/ThumbnailDisplay";
import YouTubeUploadButton from "@/components/pipeline/YouTubeUploadButton";
import ShortsProgressDisplay from "@/components/pipeline/ShortsProgressDisplay";
import ShortsResultDisplay from "@/components/pipeline/ShortsResultDisplay";

// Placeholder component for pending steps
function PlaceholderCard({
  icon: Icon,
  title,
  description,
  color = "gray",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color?: "gray" | "blue" | "purple" | "pink" | "green";
}) {
  const colorClasses = {
    gray: "from-gray-100 to-gray-50 dark:from-gray-800/50 dark:to-gray-900/50 border-gray-200 dark:border-gray-700",
    blue: "from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800",
    purple: "from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800",
    pink: "from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30 border-pink-200 dark:border-pink-800",
    green: "from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800",
  };

  const iconColors = {
    gray: "text-gray-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    pink: "text-pink-400",
    green: "text-green-400",
  };

  return (
    <Card className={`border-2 border-dashed bg-gradient-to-br ${colorClasses[color]} opacity-60 h-full`}>
      <CardContent className="flex flex-col items-center justify-center text-center py-6 h-full">
        <div className={`p-3 rounded-full bg-white/50 dark:bg-gray-800/50 mb-2 ${iconColors[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-muted-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground/70 mt-1">{description}</p>
        <Badge variant="outline" className="mt-2">Pending</Badge>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const [pipelineState, setPipelineState] = useState<PipelineState>(initialPipelineState);
  const [error, setError] = useState<string | null>(null);
  const [rightColumnHeight, setRightColumnHeight] = useState<number | null>(null);

  const progressIntervals = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const rightColumnRef = useRef<HTMLDivElement>(null);

  // Measure right column height
  useEffect(() => {
    const measureHeight = () => {
      if (rightColumnRef.current) {
        setRightColumnHeight(rightColumnRef.current.offsetHeight);
      }
    };

    measureHeight();
    const resizeObserver = new ResizeObserver(measureHeight);
    if (rightColumnRef.current) {
      resizeObserver.observe(rightColumnRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [pipelineState.currentPhase]);

  useEffect(() => {
    return () => {
      Object.values(progressIntervals.current).forEach(clearInterval);
    };
  }, []);

  const startProgressAnimation = useCallback((stepPath: string, targetProgress: number = 90) => {
    if (progressIntervals.current[stepPath]) {
      clearInterval(progressIntervals.current[stepPath]);
    }

    let currentProgress = 5;
    progressIntervals.current[stepPath] = setInterval(() => {
      currentProgress += Math.random() * 3 + 1;
      if (currentProgress >= targetProgress) {
        currentProgress = targetProgress;
        clearInterval(progressIntervals.current[stepPath]);
      }

      setPipelineState(prev => {
        const newState = { ...prev };
        const pathParts = stepPath.split(".");

        if (pathParts[0] === "scriptStep") {
          newState.scriptStep = { ...newState.scriptStep, progress: Math.round(currentProgress) };
        } else if (pathParts[0] === "videoGeneration") {
          newState.videoGeneration = { ...newState.videoGeneration };
          if (pathParts[1] === "voiceOverStep") {
            newState.videoGeneration.voiceOverStep = { ...newState.videoGeneration.voiceOverStep, progress: Math.round(currentProgress) };
          } else if (pathParts[1] === "assetsStep") {
            newState.videoGeneration.assetsStep = { ...newState.videoGeneration.assetsStep, progress: Math.round(currentProgress) };
          } else if (pathParts[1] === "assemblyStep") {
            newState.videoGeneration.assemblyStep = { ...newState.videoGeneration.assemblyStep, progress: Math.round(currentProgress) };
          }
        } else if (pathParts[0] === "thumbnailStep") {
          newState.thumbnailStep = { ...newState.thumbnailStep, progress: Math.round(currentProgress) };
        }

        return newState;
      });
    }, 500);
  }, []);

  const stopProgressAnimation = useCallback((stepPath: string) => {
    if (progressIntervals.current[stepPath]) {
      clearInterval(progressIntervals.current[stepPath]);
      delete progressIntervals.current[stepPath];
    }
  }, []);

  const calculateOverallProgress = useCallback((state: PipelineState): number => {
    let progress = 0;

    if (state.scriptStep.status === "completed") progress += 20;
    else if (state.scriptStep.status === "running") progress += state.scriptStep.progress * 0.2;

    if (state.videoGeneration.voiceOverStep.status === "completed") progress += 15;
    else if (state.videoGeneration.voiceOverStep.status === "running")
      progress += state.videoGeneration.voiceOverStep.progress * 0.15;

    if (state.videoGeneration.assetsStep.status === "completed") progress += 15;
    else if (state.videoGeneration.assetsStep.status === "running")
      progress += state.videoGeneration.assetsStep.progress * 0.15;

    if (state.videoGeneration.assemblyStep.status === "completed") progress += 20;
    else if (state.videoGeneration.assemblyStep.status === "running")
      progress += state.videoGeneration.assemblyStep.progress * 0.2;

    if (state.thumbnailStep.status === "completed") progress += 30;
    else if (state.thumbnailStep.status === "running")
      progress += state.thumbnailStep.progress * 0.3;

    return Math.round(progress);
  }, []);

  const updateStep = useCallback((
    stepPath: string,
    updates: Partial<{ status: StepStatus; progress: number; message: string }>
  ) => {
    setPipelineState(prev => {
      const newState = { ...prev };
      const pathParts = stepPath.split(".");

      if (pathParts[0] === "scriptStep") {
        newState.scriptStep = { ...newState.scriptStep, ...updates };
      } else if (pathParts[0] === "videoGeneration") {
        newState.videoGeneration = { ...newState.videoGeneration };
        if (pathParts[1] === "voiceOverStep") {
          newState.videoGeneration.voiceOverStep = { ...newState.videoGeneration.voiceOverStep, ...updates };
        } else if (pathParts[1] === "assetsStep") {
          newState.videoGeneration.assetsStep = { ...newState.videoGeneration.assetsStep, ...updates };
        } else if (pathParts[1] === "assemblyStep") {
          newState.videoGeneration.assemblyStep = { ...newState.videoGeneration.assemblyStep, ...updates };
        }
        const voStatus = newState.videoGeneration.voiceOverStep.status;
        const asStatus = newState.videoGeneration.assetsStep.status;
        const asmStatus = newState.videoGeneration.assemblyStep.status;
        if (asmStatus === "completed") {
          newState.videoGeneration.status = "completed";
        } else if (voStatus === "running" || asStatus === "running" || asmStatus === "running") {
          newState.videoGeneration.status = "running";
        } else if (voStatus === "error" || asStatus === "error" || asmStatus === "error") {
          newState.videoGeneration.status = "error";
        }
      } else if (pathParts[0] === "thumbnailStep") {
        newState.thumbnailStep = { ...newState.thumbnailStep, ...updates };
      }

      return newState;
    });
  }, []);

  // API Calls
  const generateScript = async (videoIdea: string): Promise<VideoScript> => {
    const response = await fetch("/api/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoIdea }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to generate script");
    return data.script;
  };

  const generateThumbnail = async (
    videoId: string,
    title: string,
    description: string,
    narration: string,
    tags: string[]
  ): Promise<ThumbnailResult> => {
    const response = await fetch("/api/generate-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, title, description, narration, tags, style: "vibrant" }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to generate thumbnail");
    return data.thumbnail;
  };

  // Main pipeline execution
  const runPipeline = async (videoIdea: string) => {
    setError(null);
    setPipelineState({ ...initialPipelineState, isRunning: true, currentPhase: "script" });

    try {
      updateStep("scriptStep", { status: "running", progress: 5, message: "Generating script with AI..." });
      startProgressAnimation("scriptStep", 85);

      const script = await generateScript(videoIdea);

      stopProgressAnimation("scriptStep");
      setPipelineState(prev => ({
        ...prev,
        script,
        scriptStep: { ...prev.scriptStep, status: "completed", progress: 100, message: "Script generated!" },
        currentPhase: "video-thumbnail",
      }));

      const videoId = `video-${Date.now()}`;

      const videoGenerationPromise = runVideoGeneration(videoId, script);
      const thumbnailPromise = runThumbnailGeneration(videoId, script);

      await Promise.allSettled([videoGenerationPromise, thumbnailPromise]);

      // After long-form video completes, start shorts generation if there are shorts in the script
      if (script.shorts && script.shorts.length > 0) {
        setPipelineState(prev => ({
          ...prev,
          currentPhase: "shorts",
        }));

        await runShortsGeneration(videoId, script);
      }

      setPipelineState(prev => ({
        ...prev,
        isRunning: false,
        currentPhase: "complete",
      }));

    } catch (err) {
      console.error("Pipeline error:", err);
      setError(err instanceof Error ? err.message : "Pipeline failed");
      stopProgressAnimation("scriptStep");
      setPipelineState(prev => ({ ...prev, isRunning: false }));
    }
  };

  // Helper to poll job progress
  const pollJobProgress = async (jobId: string, stepPath: string, onComplete: (result: any) => void) => {
    let polling = true;
    while (polling) {
      try {
        const status = await getJobStatus(jobId);
        updateStep(stepPath, {
          progress: status.progress,
          status: status.status === 'pending' || status.status === 'running' ? 'running' : status.status,
          message: status.message || undefined,
        });
        if (status.status === 'completed') {
          onComplete({
            ...status
          });
          polling = false;
        } else if (status.status === 'error') {
          updateStep(stepPath, { status: 'error', progress: 0, message: status.error || 'Failed' });
          polling = false;
        } else {
          await new Promise(res => setTimeout(res, 1200));
        }
      } catch (err) {
        updateStep(stepPath, { status: 'error', progress: 0, message: err instanceof Error ? err.message : 'Failed' });
        polling = false;
      }
    }
  };

  const runVideoGeneration = async (videoId: string, script: VideoScript) => {
    try {
      // VOICE-OVER JOB
      updateStep("videoGeneration.voiceOverStep", {
        status: "running", progress: 5, message: "Generating AI voice-over..."
      });
      const voiceJob = await createJob({
        jobType: 'voiceover',
        videoId,
        payload: { narration: script.narration },
      });
      let voiceOverPath: string | null = null;
      const voicePromise = pollJobProgress(voiceJob.jobId, "videoGeneration.voiceOverStep", (result) => {
        const { voiceOverUrl } = result;
        voiceOverPath = voiceOverUrl;
        setPipelineState(prev => ({
          ...prev,
          videoGeneration: { ...prev.videoGeneration, voiceOverPath },
        }));
      });

      // ASSETS JOB
      updateStep("videoGeneration.assetsStep", {
        status: "running", progress: 5, message: "Downloading stock footage..."
      });
      const assetsJob = await createJob({
        jobType: 'assets',
        videoId,
        payload: { title: script.title, narration: script.narration },
      });

      let assets: VideoAssets | null = null;
      const assetsPromise = pollJobProgress(assetsJob.jobId, "videoGeneration.assetsStep", (result: any) => {
        assets = {
          videoId: videoId,
          clips: result.clipsUrls,
          music: result.music,
          branding: result.branding || {},
          clipTimings: result.clipTimings
        };
        setPipelineState(prev => ({
          ...prev,
          videoGeneration: { ...prev.videoGeneration, assets },
        }));
      });

      await Promise.all([voicePromise, assetsPromise]);

      if (
        voiceOverPath &&
        assets !== null
      ) {
        // ASSEMBLY JOB
        updateStep("videoGeneration.assemblyStep", {
          status: "running", progress: 5, message: "Assembling final video..."
        });
        const assemblyJob = await createJob({
          jobType: 'assembly',
          videoId,
          payload: {
            clips: (assets as VideoAssets).clips,
            clipTimings: (assets as VideoAssets).clipTimings,
            narration: script.narration,
            voiceOverUrl: voiceOverPath,
            music: (assets as VideoAssets).music,
            branding: (assets as VideoAssets).branding,
            isShort: false
          },
        });
        let assembledVideo: VideoAssemblyResult | null = null;
        await pollJobProgress(assemblyJob.jobId, "videoGeneration.assemblyStep", (result: any) => {
          assembledVideo = result as VideoAssemblyResult;
          updateStep("videoGeneration.assemblyStep", {
            status: "completed",
            progress: 100,
            message: `Video ready! ${assembledVideo && typeof assembledVideo.duration === 'number' ? assembledVideo.duration.toFixed(0) : ''}s`
          });
          setPipelineState(prev => ({
            ...prev,
            videoGeneration: {
              ...prev.videoGeneration,
              assembledVideo,
              status: "completed"
            },
          }));
        });
      } else {
        updateStep("videoGeneration.assemblyStep", {
          status: "error", progress: 0, message: "Cannot assemble: missing dependencies"
        });
      }
    } catch (err) {
      console.error("Video generation error:", err);
      updateStep("videoGeneration.voiceOverStep", { status: 'error', progress: 0, message: err instanceof Error ? err.message : 'Failed' });
      updateStep("videoGeneration.assetsStep", { status: 'error', progress: 0, message: err instanceof Error ? err.message : 'Failed' });
      updateStep("videoGeneration.assemblyStep", { status: 'error', progress: 0, message: err instanceof Error ? err.message : 'Failed' });
      setPipelineState(prev => ({
        ...prev,
        videoGeneration: { ...prev.videoGeneration, status: "error" },
      }));
    }
  };

  const runThumbnailGeneration = async (videoId: string, script: VideoScript) => {
    try {
      updateStep("thumbnailStep", {
        status: "running", progress: 5, message: "Generating thumbnail with AI..."
      });
      startProgressAnimation("thumbnailStep", 85);

      const thumbnail = await generateThumbnail(
        videoId,
        script.title,
        script.description,
        script.narration,
        script.tags
      );

      stopProgressAnimation("thumbnailStep");
      updateStep("thumbnailStep", {
        status: "completed", progress: 100, message: "Thumbnail ready!"
      });
      setPipelineState(prev => ({ ...prev, thumbnail }));

    } catch (err) {
      console.error("Thumbnail generation error:", err);
      stopProgressAnimation("thumbnailStep");
      updateStep("thumbnailStep", {
        status: "error", progress: 0, message: err instanceof Error ? err.message : "Failed"
      });
    }
  };

  const stopShortProgressAnimation = useCallback((
    shortIndex: number,
    stepKey: 'voiceOverStep' | 'assetsStep' | 'assemblyStep' | 'thumbnailStep'
  ) => {
    const animationKey = `short-${shortIndex}-${stepKey}`;
    if (progressIntervals.current[animationKey]) {
      clearInterval(progressIntervals.current[animationKey]);
      delete progressIntervals.current[animationKey];
    }
  }, []);

  const stopAllShortProgressAnimations = useCallback((shortIndex: number) => {
    ['voiceOverStep', 'assetsStep', 'assemblyStep', 'thumbnailStep'].forEach(stepKey => {
      stopShortProgressAnimation(shortIndex, stepKey as any);
    });
  }, [stopShortProgressAnimation]);

  // Shorts generation - runs all shorts in parallel
  const runShortsGeneration = async (videoId: string, script: VideoScript) => {
    const shorts = script.shorts;
    if (!shorts || shorts.length === 0) return;

    console.log(`\n🎬 Starting parallel shorts generation for ${shorts.length} shorts...`);

    // Initialize shorts state
    const initialShorts = shorts.map((short, index) => createShortGenerationState(index, short));

    setPipelineState(prev => ({
      ...prev,
      shortsGeneration: {
        status: "running",
        shorts: initialShorts,
        completedCount: 0,
        totalCount: shorts.length,
      },
    }));

    // Generate all shorts in parallel
    const shortPromises = shorts.map((short, index) =>
      generateSingleShort(videoId, index, short, script.title)
    );

    await Promise.allSettled(shortPromises);

    // Update final status
    setPipelineState(prev => {
      const completedCount = prev.shortsGeneration.shorts.filter(s => s.status === "completed").length;
      const hasErrors = prev.shortsGeneration.shorts.some(s => s.status === "error");

      return {
        ...prev,
        shortsGeneration: {
          ...prev.shortsGeneration,
          status: completedCount === shorts.length ? "completed" : hasErrors ? "error" : "completed",
          completedCount,
        },
      };
    });

    console.log(`\n✅ Shorts generation complete!`);
  };

  const generateSingleShort = async (
    videoId: string,
    shortIndex: number,
    short: { hook: string; script: string },
    parentTitle: string
  ) => {
    let voiceResult: string | null = null;
    let assetsResult: VideoAssets | null = null;
    let assembledResult: VideoAssemblyResult | null = null;
    let thumbnailResult: ThumbnailResult | null = null;

    const updateShort = (
      step: "voiceOverStep" | "assetsStep" | "assemblyStep" | "thumbnailStep",
      data: Partial<{ status: StepStatus; progress: number; message: string }>
    ) => {
      setPipelineState(prev => {
        const shorts = [...prev.shortsGeneration.shorts];
        const s = { ...shorts[shortIndex] };
        s[step] = { ...s[step], ...data };
        shorts[shortIndex] = s;
        return {
          ...prev,
          shortsGeneration: { ...prev.shortsGeneration, shorts },
        };
      });
    };

    try {
      /* ================== THUMBNAIL (PARALLEL, NON-BLOCKING) ================== */

      updateShort("thumbnailStep", { status: "running", progress: 5 });

      const thumbnailPromise = fetch("/api/generate-thumbnail/shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          shortIndex,
          hook: short.hook,
          script: short.script,
        }),
      }).then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Thumbnail failed");
        thumbnailResult = data.result.thumbnail;
        updateShort("thumbnailStep", { status: "completed", progress: 100, message: "Thumbnail ready!" });
        return data.result.thumbnail;
      });

      /* ================== VOICE OVER + ASSETS (PARALLEL) ================== */

      updateShort("voiceOverStep", { status: "running", progress: 5 });
      updateShort("assetsStep", { status: "running", progress: 5 });

      const [voiceJob, assetsJob] = await Promise.all([
        createJob({
          jobType: "voiceover",
          videoId,
          payload: { narration: short.script },
        }),
        createJob({
          jobType: "assets",
          videoId,
          payload: {
            title: short.hook || parentTitle,
            narration: short.script,
          },
        }),
      ]);

      await Promise.all([
        pollJobProgress(voiceJob.jobId, "shorts.voiceOver", r => {
          voiceResult = r.voiceOverUrl;
          updateShort("voiceOverStep", { status: "completed", progress: 100 });
        }),
        pollJobProgress(assetsJob.jobId, "shorts.assets", r => {
          assetsResult = {
            videoId,
            clips: r.clipsUrls,
            clipTimings: r.clipTimings,
            music: r.music,
            branding: r.branding || {},
          };
          updateShort("assetsStep", { status: "completed", progress: 100 });
        }),
      ]);

      if (!voiceResult || !assetsResult) throw new Error("Deps failed");

      /* ================== ASSEMBLY ================== */

      updateShort("assemblyStep", { status: "running", progress: 5 });

      const assemblyJob = await createJob({
        jobType: "assembly",
        videoId,
        payload: {
          clips: (assetsResult as VideoAssets).clips,
          clipTimings: (assetsResult as VideoAssets).clipTimings,
          narration: short.script,
          voiceOverUrl: voiceResult,
          isShort: true
        },
      });

      await pollJobProgress(assemblyJob.jobId, "shorts.assembly", r => {
        assembledResult = r;
        updateShort("assemblyStep", { status: "completed", progress: 100 });
      });

      /* ================== WAIT FOR THUMBNAIL ================== */

      await thumbnailPromise;

      setPipelineState(prev => {
        const shorts = [...prev.shortsGeneration.shorts];
        shorts[shortIndex] = {
          ...shorts[shortIndex],
          status: "completed",
          assembledVideo: assembledResult,
          voiceOverPath: voiceResult,
          assets: assetsResult,
          thumbnail : thumbnailResult
        };
        return {
          ...prev,
          shortsGeneration: {
            ...prev.shortsGeneration,
            shorts,
            completedCount: shorts.filter(s => s.status === "completed").length,
          },
        };
      });

    } catch (err) {
      console.error(`❌ Short ${shortIndex} failed`, err);
      setPipelineState(prev => {
        const shorts = [...prev.shortsGeneration.shorts];
        shorts[shortIndex] = { ...shorts[shortIndex], status: "error" };
        return { ...prev, shortsGeneration: { ...prev.shortsGeneration, shorts } };
      });
    }

  };


  // Retry a failed short
  const handleRetryShort = useCallback(async (shortIndex: number) => {
    const script = pipelineState.script;
    const videoId = pipelineState.videoGeneration.assets?.videoId;

    if (!script || !videoId || !script.shorts || !script.shorts[shortIndex]) {
      setError("Cannot retry: Missing required data.");
      return;
    }

    const short = script.shorts[shortIndex];
    await generateSingleShort(videoId, shortIndex, short, script.title);
  }, [pipelineState.script, pipelineState.videoGeneration.assets?.videoId]);

  const resetPipeline = () => {
    Object.values(progressIntervals.current).forEach(clearInterval);
    progressIntervals.current = {};
    setPipelineState(initialPipelineState);
    setError(null);
  };

  const exportScript = () => {
    if (!pipelineState.script) return;
    const scriptText = JSON.stringify(pipelineState.script, null, 2);
    const blob = new Blob([scriptText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "video-script.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const overallProgress = calculateOverallProgress(pipelineState);
  const showPipelineProgress = pipelineState.currentPhase !== "idle";
  const isComplete = pipelineState.currentPhase === "complete";
  const hasVideo = !!pipelineState.videoGeneration.assembledVideo;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950" />
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-300 dark:bg-purple-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob" />
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-300 dark:bg-yellow-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 dark:bg-pink-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-4000" />
        <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-300 dark:bg-blue-900 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center space-y-3 mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-primary to-purple-600 rounded-xl shadow-lg">
              <Video className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
              AI Video Pipeline
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Generate complete YouTube videos with AI-powered parallel processing
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center mb-6 backdrop-blur-sm">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>
        )}

        {/* Main Layout */}
        <div className="space-y-6">

          {/* Row 1: Input + Thumbnail (left) | Pipeline Progress (right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:grid-rows-1">
            {/* Left Column: Input + Thumbnail stacked - constrained to row height */}
            <div
              className="lg:col-span-1 lg:row-span-1 flex flex-col gap-4 lg:overflow-hidden"
              style={rightColumnHeight ? { height: rightColumnHeight } : undefined}
            >
              <div className="flex-shrink-0">
                <VideoIdeaInput
                  onSubmit={runPipeline}
                  isGenerating={pipelineState.isRunning}
                  disabled={pipelineState.isRunning}
                />
              </div>

              {/* Thumbnail - constrained to remaining space */}
              {showPipelineProgress && (
                <div className="lg:flex-1 lg:min-h-0 lg:overflow-hidden">
                  {pipelineState.thumbnail ? (
                    <ThumbnailDisplay thumbnail={pipelineState.thumbnail} className="lg:max-h-full" />
                  ) : pipelineState.scriptStep.status === "completed" ? (
                    <PlaceholderCard
                      icon={Image}
                      title="Thumbnail"
                      description="AI-generated thumbnail"
                      color="pink"
                    />
                  ) : null}
                </div>
              )}
            </div>

            {/* Right Column: Pipeline Progress - determines row height */}
            <div className="lg:col-span-2 lg:row-span-1" ref={rightColumnRef}>
              {showPipelineProgress ? (
                <PipelineProgress
                  scriptStep={pipelineState.scriptStep}
                  videoGeneration={{
                    status: pipelineState.videoGeneration.status,
                    voiceOverStep: pipelineState.videoGeneration.voiceOverStep,
                    assetsStep: pipelineState.videoGeneration.assetsStep,
                    assemblyStep: pipelineState.videoGeneration.assemblyStep,
                  }}
                  thumbnailStep={pipelineState.thumbnailStep}
                  overallProgress={overallProgress}
                  // onRetryStep={handleRetryStep}
                />
              ) : (
                <Card className="border-2 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm h-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-yellow-500" />
                      Ready to Create
                    </CardTitle>
                    <CardDescription>
                      Enter a video topic to start the AI-powered generation pipeline
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center py-8">
                    <div className="text-center space-y-4">
                      <div className="flex justify-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                          <Video className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                          <Image className="w-6 h-6 text-pink-600" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Script → Voice-Over + Assets → Video + Thumbnail
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Row 2: Final Video - Full Width (when ready) */}
          {hasVideo && (
            <VideoResultDisplay
              assembledVideo={pipelineState.videoGeneration.assembledVideo!}
              thumbnailPath={pipelineState.thumbnail?.thumbnailPath}
            />
          )}

          {/* Row 3: Script - Full Width */}
          {showPipelineProgress && (
            pipelineState.script ? (
              <ScriptDisplay
                script={pipelineState.script}
                onExport={exportScript}
                onReset={resetPipeline}
              />
            ) : (
              <PlaceholderCard
                icon={FileText}
                title="Script"
                description="AI-generated video script with title, narration, and SEO tags"
                color="blue"
              />
            )
          )}

          {/* Row 4: Voice-over + Video Assets - Side by Side */}
          {showPipelineProgress && pipelineState.scriptStep.status === "completed" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Voice Over */}
              {pipelineState.videoGeneration.voiceOverPath ? (
                <VoiceOverDisplay voiceOverPath={pipelineState.videoGeneration.voiceOverPath} />
              ) : (
                <PlaceholderCard
                  icon={Mic}
                  title="Voice-Over"
                  description="AI-generated narration audio"
                  color="blue"
                />
              )}

              {/* Video Assets */}
              {pipelineState.videoGeneration.assets ? (
                <VideoAssetsDisplay assets={pipelineState.videoGeneration.assets} />
              ) : (
                <PlaceholderCard
                  icon={Film}
                  title="Video Assets"
                  description="Stock footage and branding"
                  color="purple"
                />
              )}
            </div>
          )}

          {/* Row 5: Shorts Generation Progress (when generating shorts) */}
          {(pipelineState.currentPhase === "shorts" || pipelineState.shortsGeneration.totalCount > 0) && (
            <ShortsProgressDisplay
              shortsGeneration={pipelineState.shortsGeneration}
              onRetryShort={handleRetryShort}
            />
          )}

          {/* Row 6: Shorts Results (when complete) */}
          {pipelineState.shortsGeneration.completedCount > 0 && (
            <ShortsResultDisplay shorts={pipelineState.shortsGeneration.shorts} />
          )}

          {/* Row 7: YouTube Upload Button (when complete) */}
          {isComplete && (
            <div className="max-w-md mx-auto">
              <YouTubeUploadButton
                videoReady={!!pipelineState.videoGeneration.assembledVideo}
                thumbnailReady={!!pipelineState.thumbnail}
                disabled={pipelineState.isRunning}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
