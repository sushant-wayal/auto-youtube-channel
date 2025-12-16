"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createJob, getJobStatus } from "@/lib/redis-client";
import { Youtube, Upload, ExternalLink } from "lucide-react";
import { useState } from "react";

interface YoutubeUploadVideoData {
    videoUrl: string;
    title: string;
    description: string;
    tags: string[];
    thumbnailUrl: string;
    privacyStatus: "public" | "unlisted" | "private";
}

interface YouTubeUploadButtonProps {
    disabled?: boolean;
    longFormVideo: YoutubeUploadVideoData;
    shortFormVideos: YoutubeUploadVideoData[];
}

export default function YouTubeUploadButton({
    disabled = false,
    longFormVideo,
    shortFormVideos
}: YouTubeUploadButtonProps) {
    // Assume video is ready if longFormVideo has a videoUrl, and thumbnail is ready if thumbnailUrl exists
    const videoReady = Boolean(longFormVideo?.videoUrl);
    const thumbnailReady = Boolean(longFormVideo?.thumbnailUrl);
    const isReady = videoReady && thumbnailReady;

    const [uploadStatus, setUploadStatus] = useState<string | null>("Upload to Youtube");
    const [longFormVideoId, setLongFormVideoId] = useState<string | null>(null);
    const [shortFormVideoIds, setShortFormVideoIds] = useState<(string | null)[]>([]);

    const pollJobProgress = async (jobId: string, onComplete: (result: any) => void) => {
        let polling = true;
        while (polling) {
          try {
            const status = await getJobStatus(jobId);
            if (status.status === 'completed') {
              onComplete({
                ...status
              });
              polling = false;
            } else if (status.status === 'error') {
              setUploadStatus(`Error: ${status.error}`);
              polling = false;
            } else {
                setUploadStatus(`${status.message} (${status.progress}%)`);
                await new Promise(res => setTimeout(res, 1200));
            }
          } catch (err) {
            setUploadStatus(`Error: ${err instanceof Error ? err.message : 'Failed'}`);
            polling = false;
          }
        }
    };

    const handleUpload = async () => {
        const longFormUploadJob = await createJob({
            jobType: 'youtube-upload',
            videoId: 'longform-upload' + Date.now(),
            payload: longFormVideo,
        });

        await pollJobProgress(longFormUploadJob.jobId, (result) => {
            setUploadStatus("Long-form video uploaded successfully!");
            setLongFormVideoId(result.uploadedVideoId);
        });

        const shortFormIds: (string | null)[] = [];
        for (const shortVideo of shortFormVideos) {
            const shortFormUploadJob = await createJob({
                jobType: 'youtube-upload',
                videoId: 'shortform-upload' + Date.now(),
                payload: shortVideo,
            });

            // eslint-disable-next-line no-loop-func
            await pollJobProgress(shortFormUploadJob.jobId, (result) => {
                shortFormIds.push(result.uploadedVideoId);
                setShortFormVideoIds(shortFormIds);
                setUploadStatus("Short-form video uploaded successfully!");
            });
        }
    };

    return (
        <>
            {longFormVideoId && (
                <Card className="mb-4 border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/30 dark:to-blue-950/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base text-green-700 dark:text-green-300">
                            <ExternalLink className="w-4 h-4 text-green-600" />
                            Uploaded Video
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Your video is live! View it on YouTube:
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <a
                            href={`https://www.youtube.com/watch?v=${longFormVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-4 py-2 rounded-md bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-medium hover:underline transition"
                        >
                            {longFormVideo.title}
                        </a>
                    </CardContent>
                </Card>
            )}
            {shortFormVideoIds.length > 0 && (
                <Card className="mb-4 border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base text-blue-700 dark:text-blue-300">
                            <ExternalLink className="w-4 h-4 text-blue-600" />
                            Uploaded Shorts
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Your short-form videos are live!
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2">
                            {shortFormVideos.map(
                                (video, idx) =>
                                    shortFormVideoIds[idx] && (
                                        <li key={idx}>
                                            <a
                                                href={`https://www.youtube.com/watch?v=${shortFormVideoIds[idx]}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block px-4 py-2 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 font-medium hover:underline transition"
                                            >
                                                {video.title}
                                            </a>
                                        </li>
                                    )
                            )}
                        </ul>
                    </CardContent>
                </Card>
            )}
            <Card className="border-2 border-red-200 dark:border-red-800 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30">
                <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Youtube className="w-5 h-5 text-red-600" />
                        {uploadStatus}
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
        </>
    );
}
