"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Video, FileText, Mic, Film, Image, Clapperboard, Sparkles, Smartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoScript, VideoAssets, VideoAssemblyResult, ThumbnailResult } from "@/lib/pipeline/types";
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

// Job status type from worker
type JobStatus =
  | 'pending'
  | 'processing'
  | 'script_generating'
  | 'voiceover_generating'
  | 'assets_generating'
  | 'video_assembling'
  | 'shorts_generating'
  | 'uploading'
  | 'completed'
  | 'failed';

// Short step progress from worker
interface ShortStepProgress {
  status: 'idle' | 'running' | 'completed' | 'error';
  progress: number;
  message: string;
}

// Short generation progress from worker
interface WorkerShortProgress {
  shortIndex: number;
  status: 'idle' | 'running' | 'completed' | 'error';
  voiceOverStep: ShortStepProgress;
  assetsStep: ShortStepProgress;
  assemblyStep: ShortStepProgress;
  uploadStep: ShortStepProgress;
}

// Job data from Redis
interface JobData {
  jobId: string;
  videoIdea: string;
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  progress: number;
  message: string;
  script?: VideoScript;
  voiceOverUrl?: string;
  thumbnailUrl?: string;
  mainVideoUrl?: string;
  shortsVideos?: Array<{
    shortIndex: number;
    shortVideoId: string;
    videoUrl: string;
    duration: number;
  }>;
  shortsProgress?: WorkerShortProgress[];
  error?: string;
}

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

  // Job tracking state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Map job status to pipeline state
  const mapJobStatusToPipelineState = useCallback((job: JobData) => {
    setPipelineState(prev => {
      const newState = { ...prev };

      // Update based on job status
      switch (job.status) {
        case 'pending':
        case 'processing':
          newState.isRunning = true;
          newState.currentPhase = 'script';
          newState.scriptStep = { ...prev.scriptStep, status: 'running', progress: 5, message: 'Starting...' };
          break;

        case 'script_generating':
          newState.isRunning = true;
          newState.currentPhase = 'script';
          newState.scriptStep = {
            ...prev.scriptStep,
            status: 'running',
            progress: Math.min(job.progress * 5, 90),
            message: job.message
          };
          break;

        case 'voiceover_generating':
          // After script completes, Voice-over + Assets + Thumbnail run IN PARALLEL
          newState.isRunning = true;
          newState.currentPhase = 'video-thumbnail';
          newState.scriptStep = { ...prev.scriptStep, status: 'completed', progress: 100, message: 'Script generated!' };
          if (job.script) newState.script = job.script;

          // All three parallel steps start running together
          newState.videoGeneration = {
            ...prev.videoGeneration,
            status: 'running',
            voiceOverStep: {
              ...prev.videoGeneration.voiceOverStep,
              status: 'running',
              progress: Math.min((job.progress - 15) * 3, 80),
              message: job.message || 'Generating voice-over...'
            },
            assetsStep: {
              ...prev.videoGeneration.assetsStep,
              status: 'running',
              progress: Math.min((job.progress - 15) * 2, 60),
              message: 'Downloading video assets...'
            },
          };
          // Thumbnail also starts in parallel
          newState.thumbnailStep = {
            ...prev.thumbnailStep,
            status: 'running',
            progress: Math.min((job.progress - 15) * 2, 50),
            message: 'Generating thumbnail...'
          };
          break;

        case 'assets_generating':
          // Parallel phase continues - some steps may complete before others
          newState.isRunning = true;
          newState.currentPhase = 'video-thumbnail';
          newState.scriptStep = { ...prev.scriptStep, status: 'completed', progress: 100, message: 'Script generated!' };
          if (job.script) newState.script = job.script;

          // Voice-over likely completed, assets still running, thumbnail may be done
          newState.videoGeneration = {
            ...prev.videoGeneration,
            status: 'running',
            voiceOverStep: {
              ...prev.videoGeneration.voiceOverStep,
              status: job.voiceOverUrl ? 'completed' : 'running',
              progress: job.voiceOverUrl ? 100 : 90,
              message: job.voiceOverUrl ? 'Voice-over ready!' : 'Finalizing voice-over...'
            },
            voiceOverPath: job.voiceOverUrl || null,
            assetsStep: {
              ...prev.videoGeneration.assetsStep,
              status: 'running',
              progress: Math.min((job.progress - 30) * 4, 90),
              message: job.message || 'Downloading clips...'
            },
          };
          // Thumbnail continues in parallel (may complete independently)
          newState.thumbnailStep = {
            ...prev.thumbnailStep,
            status: job.thumbnailUrl ? 'completed' : 'running',
            progress: job.thumbnailUrl ? 100 : Math.min((job.progress - 20) * 3, 80),
            message: job.thumbnailUrl ? 'Thumbnail ready!' : 'Generating thumbnail...'
          };
          if (job.thumbnailUrl) {
            newState.thumbnail = {
              thumbnailPath: job.thumbnailUrl,
              prompt: '',
              videoId: job.jobId,
              provider: 'gemini'
            };
          }
          break;

        case 'video_assembling':
          // Assembly starts after Voice-over + Assets complete (Thumbnail may still be running)
          newState.isRunning = true;
          newState.currentPhase = 'video-thumbnail';
          newState.scriptStep = { ...prev.scriptStep, status: 'completed', progress: 100, message: 'Script generated!' };
          if (job.script) newState.script = job.script;

          newState.videoGeneration = {
            ...prev.videoGeneration,
            status: 'running',
            voiceOverStep: { ...prev.videoGeneration.voiceOverStep, status: 'completed', progress: 100, message: 'Voice-over ready!' },
            voiceOverPath: job.voiceOverUrl || null,
            assetsStep: { ...prev.videoGeneration.assetsStep, status: 'completed', progress: 100, message: 'Assets ready!' },
            assemblyStep: {
              ...prev.videoGeneration.assemblyStep,
              status: 'running',
              progress: Math.min((job.progress - 50) * 6, 90),
              message: job.message || 'Assembling video with FFmpeg...'
            },
          };
          // Thumbnail should be complete by now (or close to it)
          newState.thumbnailStep = {
            ...prev.thumbnailStep,
            status: job.thumbnailUrl ? 'completed' : 'running',
            progress: job.thumbnailUrl ? 100 : 95,
            message: job.thumbnailUrl ? 'Thumbnail ready!' : 'Finalizing thumbnail...'
          };
          if (job.thumbnailUrl) {
            newState.thumbnail = {
              thumbnailPath: job.thumbnailUrl,
              prompt: '',
              videoId: job.jobId,
              provider: 'gemini'
            };
          }
          break;

        case 'shorts_generating':
          newState.isRunning = true;
          newState.currentPhase = 'shorts';
          newState.scriptStep = { ...prev.scriptStep, status: 'completed', progress: 100, message: 'Script generated!' };
          if (job.script) newState.script = job.script;
          newState.videoGeneration = {
            ...prev.videoGeneration,
            status: 'completed',
            voiceOverStep: { ...prev.videoGeneration.voiceOverStep, status: 'completed', progress: 100, message: 'Voice-over ready!' },
            voiceOverPath: job.voiceOverUrl || null,
            assetsStep: { ...prev.videoGeneration.assetsStep, status: 'completed', progress: 100, message: 'Assets ready!' },
            assemblyStep: { ...prev.videoGeneration.assemblyStep, status: 'completed', progress: 100, message: 'Video assembled!' },
            assembledVideo: job.mainVideoUrl ? {
              videoId: job.jobId,
              outputPath: job.mainVideoUrl,
              duration: 0,
              clipCount: 0,
            } : null,
          };
          newState.thumbnailStep = { ...prev.thumbnailStep, status: 'completed', progress: 100, message: 'Thumbnail ready!' };
          if (job.thumbnailUrl) {
            newState.thumbnail = {
              thumbnailPath: job.thumbnailUrl,
              prompt: '',
              videoId: job.jobId,
              provider: 'gemini'
            };
          }
          // Update shorts progress from worker's detailed progress data
          if (job.script?.shorts) {
            const totalShorts = job.script.shorts.length;
            const completedShorts = job.shortsVideos?.length || 0;

            newState.shortsGeneration = {
              status: 'running',
              totalCount: totalShorts,
              completedCount: completedShorts,
              shorts: job.script.shorts.map((short, index) => {
                const completedShort = job.shortsVideos?.find(s => s.shortIndex === index);
                const workerProgress = job.shortsProgress?.find(p => p.shortIndex === index);
                const baseState = createShortGenerationState(index, short);

                // If we have detailed progress from worker, use it
                if (workerProgress) {
                  return {
                    ...baseState,
                    status: workerProgress.status as StepStatus,
                    voiceOverStep: {
                      ...baseState.voiceOverStep,
                      status: workerProgress.voiceOverStep.status as StepStatus,
                      progress: workerProgress.voiceOverStep.progress,
                      message: workerProgress.voiceOverStep.message,
                    },
                    assetsStep: {
                      ...baseState.assetsStep,
                      status: workerProgress.assetsStep.status as StepStatus,
                      progress: workerProgress.assetsStep.progress,
                      message: workerProgress.assetsStep.message,
                    },
                    assemblyStep: {
                      ...baseState.assemblyStep,
                      status: workerProgress.assemblyStep.status as StepStatus,
                      progress: workerProgress.assemblyStep.progress,
                      message: workerProgress.assemblyStep.message,
                    },
                    // Map uploadStep to thumbnailStep for UI compatibility
                    thumbnailStep: {
                      ...baseState.thumbnailStep,
                      status: workerProgress.uploadStep.status as StepStatus,
                      progress: workerProgress.uploadStep.progress,
                      message: workerProgress.uploadStep.message,
                    },
                    assembledVideo: completedShort ? {
                      videoId: completedShort.shortVideoId,
                      outputPath: completedShort.videoUrl,
                      duration: completedShort.duration,
                      clipCount: 0,
                    } : null,
                  };
                }

                // Fallback: use basic status based on completed shorts
                return {
                  ...baseState,
                  status: completedShort ? 'completed' as StepStatus : (index <= completedShorts ? 'running' as StepStatus : 'idle' as StepStatus),
                  assembledVideo: completedShort ? {
                    videoId: completedShort.shortVideoId,
                    outputPath: completedShort.videoUrl,
                    duration: completedShort.duration,
                    clipCount: 0,
                  } : null,
                };
              }),
            };
          }
          break;

        case 'completed':
          newState.isRunning = false;
          newState.currentPhase = 'complete';
          newState.scriptStep = { ...prev.scriptStep, status: 'completed', progress: 100, message: 'Script generated!' };
          if (job.script) newState.script = job.script;
          newState.videoGeneration = {
            ...prev.videoGeneration,
            status: 'completed',
            voiceOverStep: { ...prev.videoGeneration.voiceOverStep, status: 'completed', progress: 100, message: 'Voice-over ready!' },
            voiceOverPath: job.voiceOverUrl || null,
            assetsStep: { ...prev.videoGeneration.assetsStep, status: 'completed', progress: 100, message: 'Assets ready!' },
            assemblyStep: { ...prev.videoGeneration.assemblyStep, status: 'completed', progress: 100, message: 'Video assembled!' },
            assembledVideo: job.mainVideoUrl ? {
              videoId: job.jobId,
              outputPath: job.mainVideoUrl,
              duration: 0,
              clipCount: 0,
            } : null,
          };
          newState.thumbnailStep = { ...prev.thumbnailStep, status: 'completed', progress: 100, message: 'Thumbnail ready!' };
          if (job.thumbnailUrl) {
            newState.thumbnail = {
              thumbnailPath: job.thumbnailUrl,
              prompt: '',
              videoId: job.jobId,
              provider: 'gemini'
            };
          }
          // Update shorts with final completed state
          if (job.script?.shorts) {
            newState.shortsGeneration = {
              status: 'completed',
              totalCount: job.script.shorts.length,
              completedCount: job.shortsVideos?.length || 0,
              shorts: job.script.shorts.map((short, index) => {
                const completedShort = job.shortsVideos?.find(s => s.shortIndex === index);
                const workerProgress = job.shortsProgress?.find(p => p.shortIndex === index);
                const baseState = createShortGenerationState(index, short);

                if (workerProgress) {
                  return {
                    ...baseState,
                    status: completedShort ? 'completed' as StepStatus : 'error' as StepStatus,
                    voiceOverStep: {
                      ...baseState.voiceOverStep,
                      status: workerProgress.voiceOverStep.status as StepStatus,
                      progress: workerProgress.voiceOverStep.progress,
                      message: workerProgress.voiceOverStep.message,
                    },
                    assetsStep: {
                      ...baseState.assetsStep,
                      status: workerProgress.assetsStep.status as StepStatus,
                      progress: workerProgress.assetsStep.progress,
                      message: workerProgress.assetsStep.message,
                    },
                    assemblyStep: {
                      ...baseState.assemblyStep,
                      status: workerProgress.assemblyStep.status as StepStatus,
                      progress: workerProgress.assemblyStep.progress,
                      message: workerProgress.assemblyStep.message,
                    },
                    thumbnailStep: {
                      ...baseState.thumbnailStep,
                      status: workerProgress.uploadStep.status as StepStatus,
                      progress: workerProgress.uploadStep.progress,
                      message: workerProgress.uploadStep.message,
                    },
                    assembledVideo: completedShort ? {
                      videoId: completedShort.shortVideoId,
                      outputPath: completedShort.videoUrl,
                      duration: completedShort.duration,
                      clipCount: 0,
                    } : null,
                  };
                }

                return {
                  ...baseState,
                  status: completedShort ? 'completed' as StepStatus : 'error' as StepStatus,
                  assembledVideo: completedShort ? {
                    videoId: completedShort.shortVideoId,
                    outputPath: completedShort.videoUrl,
                    duration: completedShort.duration,
                    clipCount: 0,
                  } : null,
                };
              }),
            };
          }
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          break;

        case 'failed':
          newState.isRunning = false;
          setError(job.error || 'Job failed');
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          break;
      }

      return newState;
    });
  }, []);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get job status');
      }

      mapJobStatusToPipelineState(data.job);
    } catch (err) {
      console.error('Polling error:', err);
      // Don't stop polling on transient errors
    }
  }, [mapJobStatusToPipelineState]);

  // Start polling for a job
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll immediately
    pollJobStatus(jobId);

    // Then poll every 2 seconds
    pollingIntervalRef.current = setInterval(() => {
      pollJobStatus(jobId);
    }, 2000);
  }, [pollJobStatus]);

  // Create job and start pipeline
  const runPipeline = async (videoIdea: string) => {
    setError(null);
    setPipelineState({ ...initialPipelineState, isRunning: true, currentPhase: 'script' });

    try {
      // Create job via API
      const response = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIdea }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create job');
      }

      console.log(`✅ Job created: ${data.jobId}`);
      setCurrentJobId(data.jobId);

      // Start polling for job status
      startPolling(data.jobId);

    } catch (err) {
      console.error('Pipeline error:', err);
      setError(err instanceof Error ? err.message : 'Pipeline failed');
      setPipelineState(prev => ({ ...prev, isRunning: false }));
    }
  };

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

  // Handle retry - not supported in worker mode, show message
  const handleRetryStep = useCallback(async (stepId: RetryableStep) => {
    setError("Retry is not supported in worker mode. Please start a new job.");
  }, []);

  const resetPipeline = () => {
    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setCurrentJobId(null);
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
          {currentJobId && (
            <Badge variant="outline" className="text-xs">
              Job: {currentJobId}
            </Badge>
          )}
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
                  onRetryStep={handleRetryStep}
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
                        Script → Voice-Over + Assets + Thumbnail (parallel) → Video Assembly
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
              onRetryShort={() => { }} // Retry not supported in worker mode
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
