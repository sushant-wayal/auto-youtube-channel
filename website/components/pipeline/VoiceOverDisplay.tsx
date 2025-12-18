"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mic, Download } from "lucide-react";

interface VoiceOverDisplayProps {
    voiceOverPath: string;
}

export default function VoiceOverDisplay({ voiceOverPath }: VoiceOverDisplayProps) {
    return (
        <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/80 to-cyan-50/80 dark:from-blue-950/30 dark:to-cyan-950/30 backdrop-blur-sm h-fit">
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Mic className="w-4 h-4 text-blue-600" />
                    Voice-Over
                    <Badge className="ml-auto bg-blue-600 text-xs">Ready</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
                {/* Audio Player */}
                <audio
                    controls
                    className="w-full h-10"
                    src={`${voiceOverPath}`}
                    preload="metadata"
                >
                    Your browser does not support the audio element.
                </audio>

                {/* Download Button */}
                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                        const link = document.createElement("a");
                        link.href = `${voiceOverPath}`;
                        link.download = `voiceover-${Date.now()}.wav`;
                        link.click();
                    }}
                >
                    <Download className="w-3 h-3 mr-2" />
                    Download
                </Button>
            </CardContent>
        </Card>
    );
}
