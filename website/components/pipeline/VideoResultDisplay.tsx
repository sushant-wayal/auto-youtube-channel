"use client";

import { useState } from "react";
import { VideoAssemblyResult } from "@/lib/pipeline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Download, Play, Clock, Film, MonitorPlay, Maximize2, X } from "lucide-react";

interface VideoResultDisplayProps {
    assembledVideo: VideoAssemblyResult;
    thumbnailPath?: string;
}

export default function VideoResultDisplay({ assembledVideo, thumbnailPath }: VideoResultDisplayProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const videoUrl = `${assembledVideo.outputPath}`;
    const posterUrl = thumbnailPath ? `${thumbnailPath}` : undefined;

    return (
        <>
            <Card className="border-2 border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-50/90 to-teal-50/90 dark:from-emerald-950/50 dark:to-teal-950/50 backdrop-blur-sm shadow-2xl shadow-emerald-500/20">
                <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 bg-emerald-500 rounded-lg">
                            <MonitorPlay className="w-6 h-6 text-white" />
                        </div>
                        <span>Your Video is Ready!</span>
                        <Badge className="ml-auto bg-emerald-500 text-sm px-3 py-1">Complete</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Video Preview - Shows thumbnail with play overlay */}
                    <div
                        className="relative bg-black rounded-xl overflow-hidden shadow-xl ring-2 ring-emerald-500/20 cursor-pointer group"
                        onClick={() => setIsFullscreen(true)}
                    >
                        {/* Thumbnail/Poster Image or Video Frame */}
                        {posterUrl ? (
                            <img
                                src={posterUrl}
                                alt="Video thumbnail"
                                className="w-full aspect-video object-cover"
                            />
                        ) : (
                            <video
                                className="w-full aspect-video"
                                src={videoUrl}
                                preload="metadata"
                                muted
                            >
                                Your browser does not support the video element.
                            </video>
                        )}

                        {/* Play overlay on hover */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-300">
                            <div className="transform scale-100 group-hover:scale-110 transition-transform duration-300">
                                <div className="bg-white/90 dark:bg-gray-800/90 rounded-full p-5 shadow-2xl">
                                    <Play className="w-10 h-10 text-emerald-600 ml-1" />
                                </div>
                            </div>
                        </div>

                        {/* Expand button */}
                        <button
                            className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
                        >
                            <Maximize2 className="w-5 h-5 text-white" />
                        </button>

                        {/* Duration badge */}
                        <div className="absolute bottom-3 right-3">
                            <Badge className="bg-black/70 text-white border-0 backdrop-blur-sm flex items-center gap-1 text-sm px-2 py-1">
                                <Clock className="w-3.5 h-3.5" />
                                {Math.floor(assembledVideo.duration / 60)}:{String(Math.floor(assembledVideo.duration % 60)).padStart(2, '0')}
                            </Badge>
                        </div>

                        {/* Click to play hint */}
                        <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Badge className="bg-emerald-500 text-white border-0">
                                Click to play
                            </Badge>
                        </div>
                    </div>

                    {/* Video Stats */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white/80 dark:bg-gray-900/60 rounded-lg p-3 text-center border border-emerald-200 dark:border-emerald-800">
                            <Clock className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                            <p className="text-xs text-muted-foreground">Duration</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                                {Math.floor(assembledVideo.duration / 60)}:{String(Math.floor(assembledVideo.duration % 60)).padStart(2, '0')}
                            </p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-900/60 rounded-lg p-3 text-center border border-emerald-200 dark:border-emerald-800">
                            <Film className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                            <p className="text-xs text-muted-foreground">Clips</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{assembledVideo.clipCount}</p>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-900/60 rounded-lg p-3 text-center border border-emerald-200 dark:border-emerald-800">
                            <Video className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                            <p className="text-xs text-muted-foreground">Resolution</p>
                            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">1080p</p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base"
                            onClick={() => setIsFullscreen(true)}
                        >
                            <Play className="w-5 h-5 mr-2" />
                            Play Video
                        </Button>
                        <Button
                            variant="outline"
                            className="flex-1 h-12 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 font-semibold text-base"
                            onClick={() => {
                                const link = document.createElement("a");
                                link.href = videoUrl;
                                link.download = `final-video-${assembledVideo.videoId}.mp4`;
                                link.click();
                            }}
                        >
                            <Download className="w-5 h-5 mr-2" />
                            Download
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Fullscreen Video Modal */}
            {isFullscreen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
                    onClick={() => setIsFullscreen(false)}
                >
                    <div className="relative max-w-6xl w-full mx-4" onClick={e => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        {/* Full Size Video Player */}
                        <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                            <video
                                src={videoUrl}
                                className="w-full aspect-video"
                                controls
                                autoPlay
                                poster={posterUrl}
                            >
                                Your browser does not support video playback.
                            </video>
                        </div>

                        {/* Info Bar */}
                        <div className="flex items-center justify-between mt-4 px-2">
                            <div className="text-white/70 text-sm flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    {Math.floor(assembledVideo.duration / 60)}:{String(Math.floor(assembledVideo.duration % 60)).padStart(2, '0')}
                                </span>
                                <span>•</span>
                                <span>16:9</span>
                                <span>•</span>
                                <span>1080p</span>
                                <span>•</span>
                                <span>{assembledVideo.clipCount} clips</span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = videoUrl;
                                    link.download = `final-video-${assembledVideo.videoId}.mp4`;
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
