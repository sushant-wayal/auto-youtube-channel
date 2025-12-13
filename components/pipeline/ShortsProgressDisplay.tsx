"use client";

import { useEffect, useState } from "react";
import { ShortsPipelineState, ShortGenerationState, StepStatus } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import {
    Check, Loader2, Circle, AlertCircle, Play,
    Mic, Film, Clapperboard, Image, RotateCcw,
    Smartphone, Zap, ChevronDown, ChevronRight,
    Volume2, ImageIcon, Video, Maximize2, X, Download
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortsProgressDisplayProps {
    shortsGeneration: ShortsPipelineState;
    onRetryShort?: (shortIndex: number) => void;
}

export default function ShortsProgressDisplay({
    shortsGeneration,
    onRetryShort,
}: ShortsProgressDisplayProps) {
    const [fullscreenThumbnail, setFullscreenThumbnail] = useState<{ path: string; shortIndex: number } | null>(null);

    if (shortsGeneration.totalCount === 0) {
        return null;
    }

    const overallProgress = shortsGeneration.totalCount > 0
        ? Math.round((shortsGeneration.completedCount / shortsGeneration.totalCount) * 100)
        : 0;

    return (
        <>
            <Card className="border-2 shadow-xl bg-gradient-to-br from-pink-50/80 to-purple-50/80 dark:from-pink-950/30 dark:to-purple-950/30 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <div className="p-2 bg-gradient-to-br from-pink-500 to-purple-600 rounded-lg">
                                <Smartphone className="w-5 h-5 text-white" />
                            </div>
                            <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                                Shorts Generation
                            </span>
                        </CardTitle>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded-full">
                                <Zap className="w-3.5 h-3.5 text-yellow-600" />
                                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Parallel</span>
                            </div>
                            <Badge
                                variant={overallProgress === 100 ? "default" : "secondary"}
                                className={cn(
                                    "text-sm px-3 py-1 font-bold",
                                    overallProgress === 100 && "bg-gradient-to-r from-green-500 to-emerald-500"
                                )}
                            >
                                {shortsGeneration.completedCount}/{shortsGeneration.totalCount} Complete
                            </Badge>
                        </div>
                    </div>

                    {/* Overall progress bar */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden mt-3">
                        <div
                            className="h-2.5 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 relative"
                            style={{ width: `${overallProgress}%` }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {/* Shorts Grid - Side by Side */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {shortsGeneration.shorts.map((shortState) => (
                            <ShortProgressCard
                                key={shortState.shortIndex}
                                shortState={shortState}
                                onRetry={onRetryShort ? () => onRetryShort(shortState.shortIndex) : undefined}
                                onExpandThumbnail={(path) => setFullscreenThumbnail({ path, shortIndex: shortState.shortIndex })}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Fullscreen Thumbnail Modal */}
            {fullscreenThumbnail && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setFullscreenThumbnail(null)}
                >
                    <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setFullscreenThumbnail(null)}
                            className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        {/* Full Size Image */}
                        <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                            <img
                                src={`/api/videos/${fullscreenThumbnail.path}`}
                                alt={`Short #${fullscreenThumbnail.shortIndex + 1} Thumbnail`}
                                className="w-full h-auto"
                            />
                        </div>

                        {/* Info Bar */}
                        <div className="flex items-center justify-between mt-4 px-2">
                            <div className="text-white/70 text-sm">
                                <span>Short #{fullscreenThumbnail.shortIndex + 1} Thumbnail</span>
                                <span className="mx-2">•</span>
                                <span>9:16</span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = `/api/videos/${fullscreenThumbnail.path}`;
                                    link.download = `short-${fullscreenThumbnail.shortIndex + 1}-thumbnail.png`;
                                    link.click();
                                }}
                            >
                                <Download className="w-4 h-4 mr-2" />
                                Download
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

interface ShortProgressCardProps {
    shortState: ShortGenerationState;
    onRetry?: () => void;
    onExpandThumbnail: (path: string) => void;
}

function ShortProgressCard({ shortState, onRetry, onExpandThumbnail }: ShortProgressCardProps) {
    const [showDetails, setShowDetails] = useState(false);

    const getStatusGradient = (status: StepStatus) => {
        switch (status) {
            case "completed": return "from-green-500 to-emerald-500";
            case "running": return "from-blue-500 to-cyan-500";
            case "error": return "from-red-500 to-orange-500";
            default: return "from-gray-400 to-gray-500";
        }
    };

    const getCardBorder = (status: StepStatus) => {
        switch (status) {
            case "completed": return "border-green-300 dark:border-green-700";
            case "running": return "border-blue-300 dark:border-blue-700 shadow-blue-100 dark:shadow-blue-900/20 shadow-lg";
            case "error": return "border-red-300 dark:border-red-700";
            default: return "border-gray-200 dark:border-gray-700";
        }
    };

    const completedSteps = [
        shortState.voiceOverStep.status === "completed",
        shortState.assetsStep.status === "completed",
        shortState.assemblyStep.status === "completed",
        shortState.thumbnailStep.status === "completed",
    ].filter(Boolean).length;

    const progress = (completedSteps / 4) * 100;

    return (
        <div className={cn(
            "rounded-xl border-2 bg-white dark:bg-gray-900 overflow-hidden transition-all duration-300",
            getCardBorder(shortState.status)
        )}>
            {/* Header with gradient */}
            <div className={cn(
                "p-3 bg-gradient-to-r text-white",
                getStatusGradient(shortState.status)
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <StatusIcon status={shortState.status} className="text-white" />
                        <span className="font-bold text-sm">Short #{shortState.shortIndex + 1}</span>
                    </div>
                    <Badge className="bg-white/20 text-white border-0 text-xs">
                        {completedSteps}/4
                    </Badge>
                </div>

                {/* Mini progress bar */}
                <div className="w-full bg-white/30 rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                        className="h-1.5 rounded-full bg-white transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="p-3 space-y-3">
                {/* Hook preview */}
                <p className="text-xs text-muted-foreground line-clamp-2 italic">
                    "{shortState.short.hook}"
                </p>

                {/* Step indicators - Compact grid */}
                <div className="grid grid-cols-2 gap-2">
                    <StepIndicator
                        icon={<Mic className="w-3 h-3" />}
                        label="Voice"
                        status={shortState.voiceOverStep.status}
                        progress={shortState.voiceOverStep.progress}
                    />
                    <StepIndicator
                        icon={<Film className="w-3 h-3" />}
                        label="Assets"
                        status={shortState.assetsStep.status}
                        progress={shortState.assetsStep.progress}
                    />
                    <StepIndicator
                        icon={<Image className="w-3 h-3" />}
                        label="Thumb"
                        status={shortState.thumbnailStep.status}
                        progress={shortState.thumbnailStep.progress}
                    />
                    <StepIndicator
                        icon={<Video className="w-3 h-3" />}
                        label="Video"
                        status={shortState.assemblyStep.status}
                        progress={shortState.assemblyStep.progress}
                    />
                </div>

                {/* Expandable details with generated content */}
                {(shortState.voiceOverPath || shortState.assets || shortState.thumbnail) && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                        >
                            {showDetails ? (
                                <ChevronDown className="w-3 h-3" />
                            ) : (
                                <ChevronRight className="w-3 h-3" />
                            )}
                            <span>View generated content</span>
                        </button>

                        {showDetails && (
                            <div className="mt-2 space-y-2">
                                {shortState.voiceOverPath && (
                                    <DetailItem
                                        icon={<Volume2 className="w-3 h-3 text-blue-500" />}
                                        label="Voice-Over"
                                    >
                                        <audio
                                            src={`${shortState.voiceOverPath}`}
                                            controls
                                            className="w-full h-7 rounded"
                                            preload="metadata"
                                        />
                                    </DetailItem>
                                )}
                                {shortState.assets && (
                                    <DetailItem
                                        icon={<Film className="w-3 h-3 text-purple-500" />}
                                        label={`${shortState.assets.clips.length} Clips`}
                                    >
                                        <div className="flex gap-1 overflow-x-auto pb-1">
                                            {shortState.assets.clips.slice(0, 3).map((clip, i) => (
                                                <div key={i} className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                                                    <Film className="w-4 h-4 text-gray-400" />
                                                </div>
                                            ))}
                                            {shortState.assets.clips.length > 3 && (
                                                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded flex-shrink-0 flex items-center justify-center">
                                                    <span className="text-[10px] text-muted-foreground">+{shortState.assets.clips.length - 3}</span>
                                                </div>
                                            )}
                                        </div>
                                    </DetailItem>
                                )}
                                {shortState.thumbnail && (
                                    <DetailItem
                                        icon={<ImageIcon className="w-3 h-3 text-pink-500" />}
                                        label="Thumbnail"
                                    >
                                        {shortState.thumbnail.thumbnailPath ? (
                                            <div
                                                className="relative group cursor-pointer"
                                                onClick={() => onExpandThumbnail(shortState.thumbnail!.thumbnailPath)}
                                            >
                                                <img
                                                    src={`/api/videos/${shortState.thumbnail.thumbnailPath}`}
                                                    alt="Thumbnail"
                                                    className="w-full h-20 object-cover rounded"
                                                />
                                                {/* Expand overlay on hover */}
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-200 rounded">
                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 rounded-full p-1.5">
                                                        <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center">
                                                <ImageIcon className="w-6 h-6 text-gray-400" />
                                            </div>
                                        )}
                                    </DetailItem>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Completed indicator */}
                {shortState.assembledVideo && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <Play className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">
                            Ready • {shortState.assembledVideo.duration.toFixed(1)}s
                        </span>
                    </div>
                )}

                {/* Error state */}
                {shortState.status === "error" && onRetry && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                        className="w-full text-xs h-8 border-red-200 text-red-600 hover:bg-red-50"
                    >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Retry Generation
                    </Button>
                )}
            </div>
        </div>
    );
}

function StepIndicator({
    icon,
    label,
    status,
    progress
}: {
    icon: React.ReactNode;
    label: string;
    status: StepStatus;
    progress: number;
}) {
    const getStatusStyle = () => {
        switch (status) {
            case "completed": return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800";
            case "running": return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800";
            case "error": return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800";
            default: return "bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700";
        }
    };

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all",
            getStatusStyle()
        )}>
            {status === "running" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
            ) : status === "completed" ? (
                <Check className="w-3 h-3" />
            ) : status === "error" ? (
                <AlertCircle className="w-3 h-3" />
            ) : (
                icon
            )}
            <span>{label}</span>
            {status === "running" && (
                <span className="text-[10px] opacity-70">{progress}%</span>
            )}
        </div>
    );
}

function DetailItem({
    icon,
    label,
    children
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {icon}
                <span>{label}</span>
            </div>
            {children}
        </div>
    );
}

function StatusIcon({ status, className }: { status: StepStatus; className?: string }) {
    const baseClass = "w-4 h-4";

    switch (status) {
        case "completed":
            return <Check className={cn(baseClass, "text-green-600", className)} />;
        case "running":
            return <Loader2 className={cn(baseClass, "animate-spin", className)} />;
        case "error":
            return <AlertCircle className={cn(baseClass, "text-red-600", className)} />;
        default:
            return <Circle className={cn(baseClass, "text-gray-400", className)} />;
    }
}
