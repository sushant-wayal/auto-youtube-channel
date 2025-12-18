"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Video } from "lucide-react";

interface VideoIdeaInputProps {
    onSubmit: (videoIdea: string) => void;
    isGenerating: boolean;
    disabled?: boolean;
}

export default function VideoIdeaInput({
    onSubmit,
    isGenerating,
    disabled = false,
}: VideoIdeaInputProps) {
    const [videoIdea, setVideoIdea] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!videoIdea.trim() || isGenerating || disabled) return;
        onSubmit(videoIdea);
    };

    return (
        <Card className="shadow-xl border-2">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-yellow-500" />
                    Create Your Video
                </CardTitle>
                <CardDescription>
                    Enter your video topic to start the AI-powered video generation pipeline
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="video-idea" className="text-base">
                            Video Topic
                        </Label>
                        <Input
                            id="video-idea"
                            type="text"
                            placeholder="e.g., How React Hooks Work"
                            value={videoIdea}
                            onChange={(e) => setVideoIdea(e.target.value)}
                            disabled={isGenerating || disabled}
                            className="h-12 text-base"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={isGenerating || !videoIdea.trim() || disabled}
                        className="w-full h-12 text-base font-semibold"
                        size="lg"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Starting Pipeline...
                            </>
                        ) : (
                            <>
                                <Video className="mr-2 h-5 w-5" />
                                Start Video Generation
                            </>
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
