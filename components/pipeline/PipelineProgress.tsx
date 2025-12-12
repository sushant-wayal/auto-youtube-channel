"use client";

import { useEffect, useState } from "react";
import { PipelineStep, StepStatus } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Circle, AlertCircle, FileText, Video, Image, Mic, Film, Clapperboard, Clock, Zap, ArrowRight, RotateCcw, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Step IDs for retry functionality
export type RetryableStep = "script" | "voiceover" | "assets" | "assembly" | "thumbnail";

interface PipelineProgressProps {
    scriptStep: PipelineStep;
    videoGeneration: {
        status: StepStatus;
        voiceOverStep: PipelineStep;
        assetsStep: PipelineStep;
        assemblyStep: PipelineStep;
    };
    thumbnailStep: PipelineStep;
    overallProgress: number;
    onRetryStep?: (stepId: RetryableStep) => void;
}

export default function PipelineProgress({
    scriptStep,
    videoGeneration,
    thumbnailStep,
    overallProgress,
    onRetryStep,
}: PipelineProgressProps) {
    const [animatedProgress, setAnimatedProgress] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setAnimatedProgress(prev => {
                if (prev < overallProgress) {
                    return Math.min(prev + 1, overallProgress);
                }
                return prev;
            });
        }, 30);
        return () => clearInterval(timer);
    }, [overallProgress]);

    useEffect(() => {
        const timer = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Check if parallel phase is active (after script, before assembly)
    const isParallelPhaseActive = scriptStep.status === "completed" &&
        videoGeneration.assemblyStep.status !== "completed" &&
        (videoGeneration.voiceOverStep.status === "running" ||
            videoGeneration.assetsStep.status === "running" ||
            thumbnailStep.status === "running");

    const completedSteps = [
        scriptStep.status === "completed",
        videoGeneration.voiceOverStep.status === "completed",
        videoGeneration.assetsStep.status === "completed",
        thumbnailStep.status === "completed",
        videoGeneration.assemblyStep.status === "completed",
    ].filter(Boolean).length;

    return (
        <Card className="border-2 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm h-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-xl font-bold">Pipeline Progress</CardTitle>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {formatTime(elapsedTime)}
                        </div>
                        <Badge
                            variant={animatedProgress === 100 ? "default" : "secondary"}
                            className={cn(
                                "text-base px-3 py-0.5 font-bold",
                                animatedProgress === 100 && "bg-green-500"
                            )}
                        >
                            {animatedProgress}%
                        </Badge>
                    </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden mt-2">
                    <div
                        className="h-3 rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 relative"
                        style={{ width: `${animatedProgress}%` }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </div>
                </div>

                <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-muted-foreground">{completedSteps}/5 steps completed</span>
                    {isParallelPhaseActive && (
                        <span className="text-muted-foreground flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
                            Parallel processing active
                        </span>
                    )}
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
                {/* Visual Pipeline Flow */}
                <div className="flex flex-col items-center gap-2 px-2 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    {/* Script Step */}
                    <div className="flex items-center gap-2">
                        <StepDot status={scriptStep.status} label="Script" />
                    </div>

                    <ArrowDown className="w-4 h-4 text-gray-400" />

                    {/* Parallel Steps: Voice-over, Assets, Thumbnail */}
                    <div className="flex items-center gap-4">
                        <StepDot status={videoGeneration.voiceOverStep.status} label="Voice" />
                        <StepDot status={videoGeneration.assetsStep.status} label="Assets" />
                        <StepDot status={thumbnailStep.status} label="Thumb" />
                    </div>

                    {isParallelPhaseActive && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300">
                            ⚡ Running in parallel
                        </Badge>
                    )}

                    <ArrowDown className="w-4 h-4 text-gray-400" />

                    {/* Assembly Step (waits for Voice-over + Assets) */}
                    <div className="flex items-center gap-2">
                        <StepDot status={videoGeneration.assemblyStep.status} label="Assembly" />
                    </div>
                </div>

                {/* Step 1: Script Generation */}
                <StepRow
                    icon={<FileText className="w-5 h-5" />}
                    title="Script Generation"
                    step={scriptStep}
                    color="blue"
                    onRetry={onRetryStep ? () => onRetryStep("script") : undefined}
                />

                <Separator className="my-2" />

                {/* Parallel Phase: Voice-over + Assets + Thumbnail */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn(
                            "text-xs px-2 py-0.5",
                            isParallelPhaseActive && "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-400 animate-pulse"
                        )}>
                            ⚡ Parallel Phase
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            {isParallelPhaseActive ? "Running simultaneously" : "Voice-over + Assets + Thumbnail"}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        {/* Voice-Over */}
                        <StepRow
                            icon={<Mic className="w-4 h-4" />}
                            title="Voice-Over"
                            step={videoGeneration.voiceOverStep}
                            color="purple"
                            compact
                            onRetry={onRetryStep ? () => onRetryStep("voiceover") : undefined}
                        />

                        {/* Assets */}
                        <StepRow
                            icon={<Film className="w-4 h-4" />}
                            title="Assets"
                            step={videoGeneration.assetsStep}
                            color="purple"
                            compact
                            onRetry={onRetryStep ? () => onRetryStep("assets") : undefined}
                        />

                        {/* Thumbnail */}
                        <StepRow
                            icon={<Image className="w-4 h-4" />}
                            title="Thumbnail"
                            step={thumbnailStep}
                            color="pink"
                            compact
                            onRetry={onRetryStep ? () => onRetryStep("thumbnail") : undefined}
                        />
                    </div>
                </div>

                <Separator className="my-2" />

                {/* Video Assembly (waits for Voice-over + Assets only) */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                            🎬 Assembly
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            Waits for Voice-over + Assets (not Thumbnail)
                        </span>
                    </div>
                    <StepRow
                        icon={<Clapperboard className="w-5 h-5" />}
                        title="Video Assembly"
                        step={videoGeneration.assemblyStep}
                        color="green"
                        onRetry={onRetryStep ? () => onRetryStep("assembly") : undefined}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function StepDot({ status, label }: { status: StepStatus; label: string }) {
    const getColor = () => {
        switch (status) {
            case "completed": return "bg-green-500";
            case "running": return "bg-blue-500 animate-pulse";
            case "error": return "bg-red-500";
            default: return "bg-gray-300 dark:bg-gray-600";
        }
    };

    return (
        <div className="flex flex-col items-center gap-1">
            <div className={cn("w-3 h-3 rounded-full", getColor())} />
            <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
    );
}

interface StepRowProps {
    icon: React.ReactNode;
    title: string;
    step: PipelineStep;
    color: "blue" | "purple" | "pink" | "green";
    compact?: boolean;
    onRetry?: () => void;
}

function StepRow({ icon, title, step, color, compact = false, onRetry }: StepRowProps) {
    const [animatedProgress, setAnimatedProgress] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setAnimatedProgress(prev => {
                const target = step.status === "running" ? Math.max(step.progress, 15) : step.progress;
                if (prev < target) {
                    return Math.min(prev + 2, target);
                }
                return prev;
            });
        }, 50);
        return () => clearInterval(timer);
    }, [step.progress, step.status]);

    const colorClasses = {
        blue: { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", progress: "bg-blue-500", icon: "text-blue-600" },
        purple: { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", progress: "bg-purple-500", icon: "text-purple-600" },
        pink: { bg: "bg-pink-50 dark:bg-pink-950/30", border: "border-pink-200 dark:border-pink-800", progress: "bg-pink-500", icon: "text-pink-600" },
        green: { bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", progress: "bg-green-500", icon: "text-green-600" },
    };

    const classes = colorClasses[color];
    const hasError = step.status === "error";

    return (
        <div className={cn(
            "rounded-lg border p-3",
            classes.bg, classes.border,
            compact && "p-2",
            hasError && "border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
        )}>
            <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={step.status} />
                <span className={cn(
                    "font-medium",
                    compact ? "text-xs" : "text-base",
                    hasError ? "text-red-600" : classes.icon
                )}>
                    {title}
                </span>
                {step.status === "running" && animatedProgress > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">{animatedProgress}%</span>
                )}
                {step.status === "completed" && (
                    <Check className="w-4 h-4 text-green-500 ml-auto" />
                )}
                {hasError && onRetry && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRetry}
                        className="ml-auto h-6 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30"
                        title="Retry this step"
                    >
                        <RotateCcw className="w-3 h-3" />
                    </Button>
                )}
            </div>

            {step.message && (
                <p className={cn(
                    "mb-2 truncate",
                    compact ? "text-[10px]" : "text-sm",
                    hasError ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
                )}>
                    {step.message}
                </p>
            )}

            <div className={cn("w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden", compact ? "h-1" : "h-2")}>
                <div
                    className={cn(
                        "rounded-full transition-all duration-300",
                        compact ? "h-1" : "h-2",
                        step.status === "completed" ? "bg-green-500" :
                            step.status === "error" ? "bg-red-500" : classes.progress,
                        step.status === "running" && "animate-pulse"
                    )}
                    style={{ width: `${step.status === "error" ? 100 : animatedProgress}%` }}
                />
            </div>
        </div>
    );
}

function StatusIcon({ status }: { status: StepStatus }) {
    switch (status) {
        case "completed":
            return <Check className="w-4 h-4 text-green-600" />;
        case "running":
            return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
        case "error":
            return <AlertCircle className="w-4 h-4 text-red-600" />;
        default:
            return <Circle className="w-4 h-4 text-gray-400" />;
    }
}
