"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Youtube, Upload, ExternalLink } from "lucide-react";

interface YouTubeUploadButtonProps {
    disabled?: boolean;
    videoReady: boolean;
    thumbnailReady: boolean;
}

export default function YouTubeUploadButton({
    disabled = false,
    videoReady,
    thumbnailReady,
}: YouTubeUploadButtonProps) {
    const isReady = videoReady && thumbnailReady;

    const handleUpload = () => {
        // TODO: Implement YouTube upload functionality
        alert("YouTube upload functionality coming soon! 🚀");
    };

    return (
        <Card className="border-2 border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Youtube className="w-5 h-5 text-red-600" />
                    Upload to YouTube
                </CardTitle>
                <CardDescription>
                    {isReady
                        ? "Your video and thumbnail are ready for upload!"
                        : "Complete video and thumbnail generation to enable upload"}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Status Indicators */}
                <div className="grid grid-cols-2 gap-3">
                    <div
                        className={`rounded-lg p-3 text-center border ${videoReady
                                ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            }`}
                    >
                        <p className="text-xs text-muted-foreground">Video</p>
                        <p className="text-sm font-bold">{videoReady ? "✓ Ready" : "Pending"}</p>
                    </div>
                    <div
                        className={`rounded-lg p-3 text-center border ${thumbnailReady
                                ? "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
                                : "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            }`}
                    >
                        <p className="text-xs text-muted-foreground">Thumbnail</p>
                        <p className="text-sm font-bold">
                            {thumbnailReady ? "✓ Ready" : "Pending"}
                        </p>
                    </div>
                </div>

                {/* Upload Button */}
                <Button
                    onClick={handleUpload}
                    disabled={disabled || !isReady}
                    className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
                    size="lg"
                >
                    <Upload className="w-5 h-5 mr-2" />
                    Upload to YouTube
                </Button>

                {/* Helper Text */}
                <p className="text-xs text-muted-foreground text-center">
                    <ExternalLink className="w-3 h-3 inline mr-1" />
                    This will open YouTube Studio to complete the upload
                </p>
            </CardContent>
        </Card>
    );
}
