"use client";

import { VideoAssemblyResult } from "@/lib/pipeline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Download, Play, Clock, Film, MonitorPlay } from "lucide-react";

interface VideoResultDisplayProps {
    assembledVideo: VideoAssemblyResult;
}

export default function VideoResultDisplay({ assembledVideo }: VideoResultDisplayProps) {
    return (
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
                {/* Video Player - Large and prominent */}
                <div className="bg-black rounded-xl overflow-hidden shadow-xl ring-2 ring-emerald-500/20">
                    <video
                        controls
                        className="w-full aspect-video"
                        src={`/api/videos/${assembledVideo.outputPath}`}
                        poster=""
                    >
                        Your browser does not support the video element.
                    </video>
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

                {/* Download Button */}
                <Button
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-base"
                    onClick={() => {
                        const link = document.createElement("a");
                        link.href = `/api/videos/${assembledVideo.outputPath}`;
                        link.download = `final-video-${assembledVideo.videoId}.mp4`;
                        link.click();
                    }}
                >
                    <Download className="w-5 h-5 mr-2" />
                    Download Video
                </Button>
            </CardContent>
        </Card>
    );
}
