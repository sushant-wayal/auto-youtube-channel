"use client";

import { useState } from "react";
import { ThumbnailResult } from "@/lib/pipeline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageIcon, Download, Maximize2, X } from "lucide-react";

interface ThumbnailDisplayProps {
    thumbnail: ThumbnailResult;
    className?: string;
}

export default function ThumbnailDisplay({ thumbnail, className }: ThumbnailDisplayProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <>
            <Card className={`border-2 border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50/50 to-rose-50/50 dark:from-pink-950/20 dark:to-rose-950/20 flex flex-col h-full ${className || ''}`}>
                <CardHeader className="pb-2 pt-3 flex-shrink-0">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ImageIcon className="w-4 h-4 text-pink-600" />
                        Thumbnail
                        <Badge className="ml-auto bg-pink-600 text-xs">Ready</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-3 pb-3 min-h-0">
                    {/* Thumbnail Preview - Expands to fill available space */}
                    <div className="relative group flex-1 min-h-[8rem]">
                        <div className="bg-black rounded-lg overflow-hidden h-full">
                            <img
                                src={`/${thumbnail.thumbnailPath}`}
                                alt="Generated YouTube Thumbnail"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        {/* Expand Button Overlay */}
                        <button
                            onClick={() => setIsFullscreen(true)}
                            className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all duration-200 rounded-lg"
                        >
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 rounded-full p-2">
                                <Maximize2 className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                            </div>
                        </button>
                    </div>

                    {/* Compact Info + Download Row */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span>16:9</span>
                            <span>•</span>
                            <span className="capitalize">{thumbnail.provider}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                const link = document.createElement("a");
                                link.href = `/${thumbnail.thumbnailPath}`;
                                link.download = `thumbnail-${thumbnail.videoId}.png`;
                                link.click();
                            }}
                        >
                            <Download className="w-3 h-3 mr-1" />
                            Download
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Fullscreen Modal */}
            {isFullscreen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                    onClick={() => setIsFullscreen(false)}
                >
                    <div className="relative max-w-5xl w-full mx-4" onClick={e => e.stopPropagation()}>
                        {/* Close Button */}
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="absolute -top-12 right-0 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        {/* Full Size Image */}
                        <div className="bg-black rounded-xl overflow-hidden shadow-2xl">
                            <img
                                src={`/${thumbnail.thumbnailPath}`}
                                alt="Generated YouTube Thumbnail"
                                className="w-full h-auto"
                            />
                        </div>

                        {/* Info Bar */}
                        <div className="flex items-center justify-between mt-4 px-2">
                            <div className="text-white/70 text-sm">
                                <span>YouTube Thumbnail</span>
                                <span className="mx-2">•</span>
                                <span>16:9</span>
                                <span className="mx-2">•</span>
                                <span className="capitalize">{thumbnail.provider}</span>
                            </div>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => {
                                    const link = document.createElement("a");
                                    link.href = `/${thumbnail.thumbnailPath}`;
                                    link.download = `thumbnail-${thumbnail.videoId}.png`;
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
