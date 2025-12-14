"use client";

import { useState } from "react";
import { ShortGenerationState } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Smartphone, Play, Download, Clock, Film, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShortsResultDisplayProps {
    shorts: ShortGenerationState[];
}

export default function ShortsResultDisplay({ shorts }: ShortsResultDisplayProps) {
    const completedShorts = shorts.filter(s => s.status === "completed" && s.assembledVideo);
    const [fullscreenVideo, setFullscreenVideo] = useState<ShortGenerationState | null>(null);

    if (completedShorts.length === 0) {
        return null;
    }

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
                                Generated Shorts
                            </span>
                        </CardTitle>
                        <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 px-3 py-1">
                            {completedShorts.length} Ready to Upload
                        </Badge>
                    </div>
                </CardHeader>

                <CardContent className="pt-0">
                    {/* Shorts Grid - Full width, evenly distributed */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {completedShorts.map((shortState) => (
                            <ShortResultCard
                                key={shortState.shortIndex}
                                shortState={shortState}
                                onExpand={() => setFullscreenVideo(shortState)}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Fullscreen Video Modal */}
            {fullscreenVideo && fullscreenVideo.assembledVideo && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={() => setFullscreenVideo(null)}
                >
                    <div className="relative max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setFullscreenVideo(null)}
                            className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        {/* Full Size Video */}
                        <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                            <video
                                src={`${fullscreenVideo.assembledVideo.outputPath.replace(/^videos\//, '')}`}
                                className="w-full h-auto max-h-[80vh]"
                                controls
                                autoPlay
                                style={{ aspectRatio: '9/16' }}
                            >
                                Your browser does not support video playback.
                            </video>
                        </div>

                        {/* Info Bar */}
                        <div className="flex items-center justify-between mt-4 px-2">
                            <div className="text-white/70 text-sm">
                                <span>Short #{fullscreenVideo.shortIndex + 1}</span>
                                <span className="mx-2">•</span>
                                <span>9:16</span>
                                <span className="mx-2">•</span>
                                <span>{fullscreenVideo.assembledVideo.duration.toFixed(1)}s</span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                asChild
                            >
                                <a
                                    href={`${fullscreenVideo.assembledVideo.outputPath.replace(/^videos\//, '')}`}
                                    download={`short-${fullscreenVideo.shortIndex + 1}.mp4`}
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

interface ShortResultCardProps {
    shortState: ShortGenerationState;
    onExpand: () => void;
}

function ShortResultCard({ shortState, onExpand }: ShortResultCardProps) {
    const { short, assembledVideo, thumbnail } = shortState;

    if (!assembledVideo) return null;

    const videoUrl = `${assembledVideo.outputPath.replace(/^videos\//, '')}`;
    const thumbnailUrl = thumbnail?.thumbnailPath
        ? `/api/videos/${thumbnail.thumbnailPath.replace(/^videos\//, '')}`
        : undefined;

    return (
        <div className="group relative rounded-2xl border-2 border-pink-200/50 dark:border-pink-800/50 bg-white dark:bg-gray-900 overflow-hidden shadow-lg hover:shadow-xl hover:border-pink-300 dark:hover:border-pink-700 transition-all duration-300">
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-0" />

            {/* Short number badge */}
            <div className="absolute top-3 left-3 z-20">
                <Badge className="bg-black/70 text-white border-0 backdrop-blur-sm font-bold">
                    #{shortState.shortIndex + 1}
                </Badge>
            </div>

            {/* Expand button */}
            <button
                onClick={onExpand}
                className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
            >
                <Maximize2 className="w-4 h-4 text-white" />
            </button>

            {/* Video Preview - Vertical aspect ratio, centered within card */}
            <div
                className="relative w-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center cursor-pointer"
                style={{ height: '320px' }}
                onClick={onExpand}
            >
                <video
                    src={videoUrl}
                    className="h-full w-auto max-w-full object-contain"
                    preload="metadata"
                    poster={thumbnailUrl}
                    style={{ aspectRatio: '9/16' }}
                    muted
                >
                    Your browser does not support video playback.
                </video>

                {/* Play overlay on hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all duration-200">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 rounded-full p-3">
                        <Play className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                    </div>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-3 right-3 z-20">
                    <Badge className="bg-black/70 text-white border-0 backdrop-blur-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {assembledVideo.duration.toFixed(1)}s
                    </Badge>
                </div>
            </div>

            {/* Info Section */}
            <div className="relative z-10 p-4 space-y-3 bg-white dark:bg-gray-900">
                {/* Stats row */}
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-300">
                        <Smartphone className="w-3 h-3 mr-1" />
                        Short
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                        <Film className="w-3 h-3 mr-1" />
                        {assembledVideo.clipCount} clips
                    </Badge>
                </div>

                {/* Hook */}
                <h4 className="font-semibold text-sm line-clamp-2 text-gray-900 dark:text-white">
                    {short.hook}
                </h4>

                {/* Script preview */}
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {short.script}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                    <Button
                        variant="default"
                        size="sm"
                        className="flex-1 text-xs h-9 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0"
                        onClick={onExpand}
                    >
                        <Play className="w-3.5 h-3.5 mr-1.5" />
                        Play
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-9 border-pink-200 dark:border-pink-800 hover:bg-pink-50 dark:hover:bg-pink-900/20"
                        asChild
                    >
                        <a href={videoUrl} download={`short-${shortState.shortIndex + 1}.mp4`}>
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            Download
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
