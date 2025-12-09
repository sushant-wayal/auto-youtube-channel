"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, Video, FileText, Tag, Zap, Copy, Check, Film, Music, Image as ImageIcon, Play, Download, Mic } from "lucide-react";
import { VideoScript, VideoAssets, VideoAssemblyResult } from "@/lib/pipeline/types";

export default function Home() {
  const [videoIdea, setVideoIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingVoiceOver, setIsGeneratingVoiceOver] = useState(false);
  const [isGeneratingAssets, setIsGeneratingAssets] = useState(false);
  const [isAssemblingVideo, setIsAssemblingVideo] = useState(false);
  const [generatedScript, setGeneratedScript] = useState<VideoScript | null>(null);
  const [voiceOverPath, setVoiceOverPath] = useState<string | null>(null);
  const [generatedAssets, setGeneratedAssets] = useState<VideoAssets | null>(null);
  const [assembledVideo, setAssembledVideo] = useState<VideoAssemblyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedNarration, setCopiedNarration] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!videoIdea.trim()) return;

    setIsGenerating(true);
    setGeneratedScript(null);
    setVoiceOverPath(null);
    setGeneratedAssets(null);
    setAssembledVideo(null);
    setError(null);

    try {
      const response = await fetch("/api/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoIdea }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate script");
      }

      setGeneratedScript(data.script);
    } catch (err) {
      console.error("Error generating script:", err);
      setError(err instanceof Error ? err.message : "Failed to generate script");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVoiceOver = async () => {
    if (!generatedScript) return;

    console.log("🎙️ Starting voice-over generation...");
    setIsGeneratingVoiceOver(true);
    setError(null);

    try {
      // Generate unique video ID for this voice-over
      const videoId = `video-${Date.now()}`;

      console.log("📤 Sending request to /api/generate-voiceover");
      const response = await fetch("/api/generate-voiceover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          narration: generatedScript.narration,
        }),
      });

      console.log("📡 Response status:", response.status);
      const data = await response.json();
      console.log("📦 Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate voice-over");
      }

      if (!data.voiceOverPath) {
        console.error("❌ No voice-over path in response!");
        throw new Error("No voice-over path returned from server");
      }

      console.log("✅ Voice-over generated:", data.voiceOverPath);
      setVoiceOverPath(data.voiceOverPath);
    } catch (err) {
      console.error("❌ Error generating voice-over:", err);
      setError(err instanceof Error ? err.message : "Failed to generate voice-over");
    } finally {
      setIsGeneratingVoiceOver(false);
    }
  };

  const handleGenerateAssets = async () => {
    if (!generatedScript || !voiceOverPath) return;

    console.log("🎬 Starting assets generation...");
    setIsGeneratingAssets(true);
    setError(null);

    try {
      // Extract video ID from voice-over path
      const videoId = voiceOverPath.split('/')[0];

      console.log("📤 Sending request to /api/generate-assets");
      const response = await fetch("/api/generate-assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId,
          title: generatedScript.title,
          narration: generatedScript.narration,
        }),
      });

      console.log("📡 Response status:", response.status);
      const data = await response.json();
      console.log("📦 Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate assets");
      }

      if (!data.assets) {
        console.error("❌ No assets in response!");
        throw new Error("No assets returned from server");
      }

      console.log("✅ Assets received:", data.assets);
      setGeneratedAssets(data.assets);
    } catch (err) {
      console.error("❌ Error generating assets:", err);
      setError(err instanceof Error ? err.message : "Failed to generate assets");
    } finally {
      setIsGeneratingAssets(false);
    }
  };

  const handleAssembleVideo = async () => {
    if (!generatedAssets || !generatedScript || !voiceOverPath) return;

    console.log("🎬 Starting video assembly...");
    setIsAssemblingVideo(true);
    setError(null);

    try {
      console.log("📤 Sending request to /api/assemble-video");
      const response = await fetch("/api/assemble-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          videoId: generatedAssets.videoId,
          clips: generatedAssets.clips,
          narration: generatedScript.narration,
          narrationAudio: voiceOverPath, // Pass the pre-generated voice-over
          music: generatedAssets.music,
          branding: generatedAssets.branding,
        }),
      });

      console.log("📡 Response status:", response.status);
      const data = await response.json();
      console.log("📦 Response data:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to assemble video");
      }

      if (!data.result) {
        console.error("❌ No result in response!");
        throw new Error("No video result returned from server");
      }

      console.log("✅ Video assembled:", data.result);
      setAssembledVideo(data.result);
    } catch (err) {
      console.error("❌ Error assembling video:", err);
      setError(err instanceof Error ? err.message : "Failed to assemble video");
    } finally {
      setIsAssemblingVideo(false);
    }
  };

  const copyToClipboard = async (text: string, type: 'narration' | 'short') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'narration') {
        setCopiedNarration(true);
        setTimeout(() => setCopiedNarration(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatNarration = (narration: string) => {
    return narration.split('\n\n').map((paragraph, index) => (
      <p key={index} className="mb-4 last:mb-0">
        {paragraph.split('[PAUSE]').map((segment, i, arr) => (
          <span key={i}>
            {segment}
            {i < arr.length - 1 && (
              <span className="inline-flex items-center mx-2 px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 text-xs font-mono">
                [PAUSE]
              </span>
            )}
          </span>
        ))}
      </p>
    ));
  };

  const estimateWordCount = (text: string) => {
    return text.trim().split(/\s+/).length;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl space-y-8 py-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Video className="w-10 h-10 text-primary" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              AI Video Production Pipeline
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Generate scripts, download footage, and prepare video assets automatically
          </p>
        </div>

        {/* Input Card */}
        <Card className="shadow-xl border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              Create Your Video
            </CardTitle>
            <CardDescription>
              Enter your video topic to generate script and download stock footage
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
                  disabled={isGenerating}
                  className="h-12 text-base"
                />
              </div>

              <Button
                type="submit"
                disabled={isGenerating || !videoIdea.trim()}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Generating Script...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Script
                  </>
                )}
              </Button>

              {/* Error Message */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                  <p className="text-sm font-medium text-destructive">
                    {error}
                  </p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Script Display Card */}
        {generatedScript && (
          <Card className="shadow-xl border-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <FileText className="w-6 h-6 text-green-500" />
                    {generatedScript.title}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {generatedScript.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="ml-4">
                  {estimateWordCount(generatedScript.narration)} words
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Tags */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="w-4 h-4" />
                  SEO Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedScript.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Voice-Over Generation */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-lg p-6 border-2 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                  <Mic className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="font-semibold text-lg">Generate Voice-Over</h3>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Generate professional AI voice-over for the script narration.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Requires TTS API key configured in the backend
                    </p>
                  </div>

                  <Button
                    onClick={handleGenerateVoiceOver}
                    disabled={isGeneratingVoiceOver || voiceOverPath !== null}
                    className="w-full h-12"
                    size="lg"
                  >
                    {isGeneratingVoiceOver ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Generating Voice-Over...
                      </>
                    ) : voiceOverPath ? (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Voice-Over Generated!
                      </>
                    ) : (
                      <>
                        <Mic className="mr-2 h-5 w-5" />
                        Generate Voice-Over
                      </>
                    )}
                  </Button>

                  {/* Audio Player - Display after generation */}
                  {voiceOverPath && (
                    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 border-2 border-blue-300 dark:border-blue-700 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center gap-2 mb-3">
                        <Music className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-semibold text-sm">Voice-Over Audio Preview</span>
                        <Badge variant="secondary" className="ml-auto">Ready</Badge>
                      </div>
                      
                      {/* Audio Player */}
                      <audio
                        controls
                        className="w-full"
                        src={`/api/videos/${voiceOverPath}`}
                        preload="metadata"
                      >
                        Your browser does not support the audio element.
                      </audio>

                      <p className="text-xs text-muted-foreground mt-2">
                        📁 Saved at: {voiceOverPath}
                      </p>

                      {/* Download Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = `/api/videos/${voiceOverPath}`;
                          link.download = `narration-${Date.now()}.wav`;
                          link.click();
                        }}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Voice-Over
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Assets Generation */}
              {voiceOverPath && (
                <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 rounded-lg p-6 border-2 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Film className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    <h3 className="font-semibold text-lg">Generate Video Assets</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Download stock footage from Pexels and prepare background music & branding assets.
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        💡 Add PEXELS_API_KEY to .env.local (<a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="underline">get free API key</a>)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        📁 Place .mp3 files in assets/music/ and logo/intro/outro in assets/branding/
                      </p>
                    </div>

                    <Button
                      onClick={handleGenerateAssets}
                      disabled={isGeneratingAssets || generatedAssets !== null}
                      className="w-full h-12"
                      size="lg"
                    >
                      {isGeneratingAssets ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Downloading Footage... (This may take a minute)
                        </>
                      ) : generatedAssets ? (
                        <>
                          <Check className="mr-2 h-5 w-5" />
                          Assets Generated!
                        </>
                      ) : (
                        <>
                          <Film className="mr-2 h-5 w-5" />
                          Generate Assets
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Assets Display */}
              {generatedAssets && (
                <>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg p-6 border-2 border-green-200 dark:border-green-800 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 mb-4">
                      <Film className="w-5 h-5 text-green-600 dark:text-green-400" />
                      <h3 className="font-semibold text-lg">Assets Ready</h3>
                      <Badge className="ml-auto bg-green-600">Complete</Badge>
                    </div>

                    <div className="space-y-4">
                      {/* Clips */}
                      <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Video className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-sm">Stock Footage Clips</span>
                          <Badge variant="secondary" className="ml-auto">{generatedAssets.clips.length} clips</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Downloaded to: tmp/footage/{generatedAssets.videoId}/
                        </p>
                      </div>

                      {/* Music */}
                      {generatedAssets.music && (
                        <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Music className="w-4 h-4 text-purple-600" />
                            <span className="font-semibold text-sm">Background Music</span>
                            <Badge variant="secondary" className="ml-auto">✓</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {generatedAssets.music.split('/').pop()}
                          </p>
                        </div>
                      )}

                      {/* Branding */}
                      {Object.keys(generatedAssets.branding).length > 0 && (
                        <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <ImageIcon className="w-4 h-4 text-pink-600" />
                            <span className="font-semibold text-sm">Branding Assets</span>
                            <Badge variant="secondary" className="ml-auto">{Object.keys(generatedAssets.branding).length} files</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {generatedAssets.branding.logo && <Badge variant="outline">Logo</Badge>}
                            {generatedAssets.branding.intro && <Badge variant="outline">Intro</Badge>}
                            {generatedAssets.branding.outro && <Badge variant="outline">Outro</Badge>}
                          </div>
                        </div>
                      )}

                      <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mt-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          🎉 All assets are ready for video editing! Next step: FFmpeg video composition.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Video Assembly Section */}
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-lg p-6 border-2 border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-2 mb-4">
                      <Play className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h3 className="font-semibold text-lg">Assemble Final Video</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Combine video clips, voice-over narration, background music, and branding into the final video.
                        </p>

                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          ⚠️ Requires FFmpeg installed on your system
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ⏱️ This process may take 2-5 minutes depending on clip count
                        </p>
                      </div>

                      <Button
                        onClick={handleAssembleVideo}
                        disabled={isAssemblingVideo || assembledVideo !== null}
                        className="w-full h-12"
                        size="lg"
                      >
                        {isAssemblingVideo ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Assembling Video...
                          </>
                        ) : assembledVideo ? (
                          <>
                            <Check className="mr-2 h-5 w-5" />
                            Video Assembled!
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-5 w-5" />
                            Assemble Video
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Final Video Display */}
                  {assembledVideo && (
                    <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-6 border-2 border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex items-center gap-2 mb-4">
                        <Video className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="font-semibold text-lg">Final Video Ready!</h3>
                        <Badge className="ml-auto bg-emerald-600">Complete</Badge>
                      </div>

                      <div className="space-y-4">
                        {/* Video Stats */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Duration</p>
                            <p className="text-lg font-bold">{assembledVideo.duration.toFixed(0)}s</p>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Clips</p>
                            <p className="text-lg font-bold">{assembledVideo.clipCount}</p>
                          </div>
                          <div className="bg-white/50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
                            <p className="text-xs text-muted-foreground mb-1">Resolution</p>
                            <p className="text-lg font-bold">1080p</p>
                          </div>
                        </div>

                        {/* Video Player */}
                        <div className="bg-black rounded-lg overflow-hidden">
                          <video
                            controls
                            autoPlay={false}
                            className="w-full"
                            src={`/api/videos/${assembledVideo.outputPath}`}
                          >
                            Your browser does not support the video element.
                          </video>
                        </div>

                        {/* Download Button */}
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = `/api/videos/${assembledVideo.outputPath}`;
                            link.download = `final-video-${generatedAssets.videoId}.mp4`;
                            link.click();
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Final Video
                        </Button>

                        <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-4">
                          <p className="text-sm text-emerald-800 dark:text-emerald-300">
                            🎉 Your video is ready! The file is saved at: <code className="text-xs bg-white/50 dark:bg-black/30 px-2 py-1 rounded">{assembledVideo.outputPath}</code>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <Separator />

              {/* Script Content */}
              <Accordion type="single" collapsible className="w-full" defaultValue="narration">
                {/* Main Narration */}
                <AccordionItem value="narration">
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500">Main Script</Badge>
                      <span className="font-semibold">Full Narration</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="bg-muted rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-semibold text-muted-foreground uppercase">
                            Ready for AI Voiceover
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(generatedScript.narration, 'narration')}
                          >
                            {copiedNarration ? (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <ScrollArea className="h-[400px] pr-4">
                          <div className="text-base leading-relaxed space-y-4">
                            {formatNarration(generatedScript.narration)}
                          </div>
                        </ScrollArea>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* YouTube Shorts */}
                {generatedScript.shorts && generatedScript.shorts.length > 0 && (
                  <AccordionItem value="shorts">
                    <AccordionTrigger className="text-left">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-500">Bonus</Badge>
                        <span className="font-semibold">YouTube Shorts ({generatedScript.shorts.length})</span>
                        <Zap className="w-4 h-4 text-yellow-500" />
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {generatedScript.shorts.map((short, index) => (
                          <div
                            key={index}
                            className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <Badge variant="secondary">Short {index + 1}</Badge>
                              <span className="text-xs text-muted-foreground">15-20s</span>
                            </div>

                            {/* Hook */}
                            <div className="mb-3">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1 uppercase">
                                Hook
                              </p>
                              <p className="text-sm font-medium">{short.hook}</p>
                            </div>

                            {/* Script */}
                            <div>
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1 uppercase">
                                Script
                              </p>
                              <p className="text-sm leading-relaxed">{short.script}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const scriptText = JSON.stringify(generatedScript, null, 2);
                    const blob = new Blob([scriptText], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = 'video-script.json';
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export Script
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setGeneratedScript(null);
                    setVoiceOverPath(null);
                    setGeneratedAssets(null);
                    setAssembledVideo(null);
                    setVideoIdea("");
                  }}
                >
                  Create New Video
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
