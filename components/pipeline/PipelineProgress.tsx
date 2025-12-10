"use client";

import { useEffect, useState } from "react";
import { PipelineStep, StepStatus } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, Loader2, Circle, AlertCircle, FileText, Video, Image, Mic, Film, Clapperboard, Clock, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

export default function PipelineProgress({
    scriptStep,
    videoGeneration,
    thumbnailStep,
    overallProgress,
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

    const completedSteps = [
        scriptStep.status === "completed",
        videoGeneration.voiceOverStep.status === "completed",
        videoGeneration.assetsStep.status === "completed",
        videoGeneration.assemblyStep.status === "completed",
        thumbnailStep.status === "completed",
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
                    <span className="text-muted-foreground flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-yellow-500" />
                        Parallel processing active
                    </span>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
                <div className="flex items-center justify-between px-2 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <StepDot status={scriptStep.status} label="Script" />
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <StepDot status={videoGeneration.voiceOverStep.status} label="Voice" />
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <StepDot status={videoGeneration.assetsStep.status} label="Assets" />
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <StepDot status={videoGeneration.assemblyStep.status} label="Video" />
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <StepDot status={thumbnailStep.status} label="Thumb" />
                </div>

                <StepRow
                    icon={<FileText className="w-5 h-5" />}
                    title="Script Generation"
                    step={scriptStep}
                    color="blue"
                />

                <Separator className="my-2" />

                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs px-2 py-0.5">
                            ⚡ Parallel
                        </Badge>
                        <span className="text-xs text-muted-foreground">Running simultaneously</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Video className="w-4 h-4 text-purple-600" />
                                <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">Video</span>
                                <StatusBadge status={videoGeneration.status} small />
                            </div>
                            <StepRow
                                icon={<Mic className="w-4 h-4" />}
                                title="Voice-Over"
                                step={videoGeneration.voiceOverStep}
                                color="purple"
                                compact
                            />
                            <StepRow
                                icon={<Film className="w-4 h-4" />}
                                title="Assets"
                                step={videoGeneration.assetsStep}
                                color="purple"
                                compact
                            />
                            <StepRow
                                icon={<Clapperboard className="w-4 h-4" />}
                                title="Assembly"
                                step={videoGeneration.assemblyStep}
                                color="green"
                                compact
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                                <Image className="w-4 h-4 text-pink-600" />
                                <span className="text-sm font-semibold text-pink-700 dark:text-pink-400">Thumbnail</span>
                                <StatusBadge status={thumbnailStep.status} small />
                            </div>
                            <StepRow
                                icon={<Image className="w-4 h-4" />}
                                title="AI Generation"
                                step={thumbnailStep}
                                color="pink"
                                compact
                            />
                        </div>
                    </div>
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
}

function StepRow({ icon, title, step, color, compact = false }: StepRowProps) {
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

    return (
        <div className={cn(
            "rounded-lg border p-3",
            classes.bg, classes.border,
            compact && "p-2"
        )}>
            <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={step.status} />
                <span className={cn("font-medium", compact ? "text-sm" : "text-base", classes.icon)}>
                    {title}
                </span>
                {step.status === "running" && animatedProgress > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">{animatedProgress}%</span>
                )}
                {step.status === "completed" && (
                    <Check className="w-4 h-4 text-green-500 ml-auto" />
                )}
            </div>

            {step.message && (
                <p className={cn("text-muted-foreground mb-2", compact ? "text-xs" : "text-sm")}>
                    {step.message}
                </p>
            )}

            <div className={cn("w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden", compact ? "h-1.5" : "h-2")}>
                <div
                    className={cn(
                        "rounded-full transition-all duration-300",
                        compact ? "h-1.5" : "h-2",
                        step.status === "completed" ? "bg-green-500" : classes.progress,
                        step.status === "running" && "animate-pulse"
                    )}
                    style={{ width: `${animatedProgress}%` }}
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

function StatusBadge({ status, small = false }: { status: StepStatus; small?: boolean }) {
    const variants: Record<StepStatus, { className: string; label: string }> = {
        idle: { className: "bg-gray-200 text-gray-700", label: "Pending" },
        running: { className: "bg-blue-500 text-white animate-pulse", label: "Running" },
        completed: { className: "bg-green-500 text-white", label: "Done" },
        error: { className: "bg-red-500 text-white", label: "Error" },
    };

    const { className, label } = variants[status];

    return (
        <Badge className={cn("ml-auto", className, small && "text-[10px] px-1.5 py-0")}>
            {label}
        </Badge>
    );
}
