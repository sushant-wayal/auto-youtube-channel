"use client";

import { VideoAssets } from "@/lib/pipeline/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Music, Image as ImageIcon, Film } from "lucide-react";

interface VideoAssetsDisplayProps {
    assets: VideoAssets;
}

export default function VideoAssetsDisplay({ assets }: VideoAssetsDisplayProps) {
    return (
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/80 to-indigo-50/80 dark:from-purple-950/30 dark:to-indigo-950/30 backdrop-blur-sm h-fit">
            <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Film className="w-4 h-4 text-purple-600" />
                    Video Assets
                    <Badge className="ml-auto bg-purple-600 text-xs">Ready</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
                <div className="grid grid-cols-3 gap-2">
                    {/* Clips */}
                    <div className="bg-white/70 dark:bg-gray-900/50 rounded-lg p-2 text-center">
                        <Video className="w-4 h-4 mx-auto mb-1 text-blue-600" />
                        <p className="text-xs text-muted-foreground">Clips</p>
                        <p className="text-sm font-bold">{assets.clips.length}</p>
                    </div>

                    {/* Music */}
                    <div className="bg-white/70 dark:bg-gray-900/50 rounded-lg p-2 text-center">
                        <Music className="w-4 h-4 mx-auto mb-1 text-green-600" />
                        <p className="text-xs text-muted-foreground">Music</p>
                        <p className="text-sm font-bold">{assets.music ? "✓" : "—"}</p>
                    </div>

                    {/* Branding */}
                    <div className="bg-white/70 dark:bg-gray-900/50 rounded-lg p-2 text-center">
                        <ImageIcon className="w-4 h-4 mx-auto mb-1 text-pink-600" />
                        <p className="text-xs text-muted-foreground">Brand</p>
                        <p className="text-sm font-bold">
                            {Object.keys(assets.branding).length}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
