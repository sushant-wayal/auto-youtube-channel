"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Youtube,
  Sparkles,
  Settings2,
  PlayCircle,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  Video,
  Mic,
  Palette,
} from "lucide-react";

export const GENRE_PRESETS = [
  {
    id: "tech",
    label: "Software & Systems Forensics",
    description: "Systems architecture, OS primitives, database internals & engineering deep-dives",
    icon: "💻",
  },
  {
    id: "space",
    label: "Space, Cosmology & Physics",
    description: "Black holes, astrophysics, quantum enigmas & deep space exploration",
    icon: "🚀",
  },
  {
    id: "history",
    label: "History & Ancient Mysteries",
    description: "Lost civilizations, ancient tactical masterstrokes & declassified cold war files",
    icon: "🏛️",
  },
  {
    id: "finance",
    label: "Finance, Markets & Economy",
    description: "Macroeconomics, market collapses, corporate scandals & liquidity cycles",
    icon: "💰",
  },
  {
    id: "crime",
    label: "True Crime & Forensic Mysteries",
    description: "Baffling unsolved disappearances, cognitive traps & forensic investigation",
    icon: "🔍",
  },
  {
    id: "science",
    label: "Biology, Neuroscience & Nature",
    description: "Human cognition, biological marvels & awe-inspiring scientific phenomena",
    icon: "🧬",
  },
  {
    id: "custom",
    label: "Custom Niche",
    description: "Specify your own custom channel audience and storytelling persona",
    icon: "✍️",
  },
];

export default function ChannelSettingsSection() {
  // Settings state
  const [channelGenre, setChannelGenre] = useState<string>("tech");
  const [customGenrePrompt, setCustomGenrePrompt] = useState<string>("");
  const [sceneRenderMethod, setSceneRenderMethod] = useState<"code" | "ai">("ai");
  const [voiceoverProvider, setVoiceoverProvider] = useState<"gemini" | "f5">("gemini");
  const [loading, setLoading] = useState<boolean>(true);
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // YouTube OAuth state
  const [ytChecking, setYtChecking] = useState<boolean>(false);
  const [ytStatus, setYtStatus] = useState<{
    connected: boolean;
    configured?: boolean;
    channel?: { title?: string; handle?: string; avatarUrl?: string };
    authUrl?: string;
  } | null>(null);

  // Trigger state
  const [customIdea, setCustomIdea] = useState<string>("");
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [triggerResult, setTriggerResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Load settings & YouTube status
  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, ytRes] = await Promise.all([
        fetch("/api/settings").then((r) => r.json()),
        fetch("/api/auth/youtube/status").then((r) => r.json()),
      ]);

      if (settingsRes.ok) {
        if (settingsRes.channelGenre) setChannelGenre(settingsRes.channelGenre);
        if (settingsRes.channelGenrePrompt) setCustomGenrePrompt(settingsRes.channelGenrePrompt);
        if (settingsRes.sceneRenderMethod) setSceneRenderMethod(settingsRes.sceneRenderMethod);
        if (settingsRes.voiceoverProvider) setVoiceoverProvider(settingsRes.voiceoverProvider);
      }

      if (ytRes.ok) {
        setYtStatus(ytRes);
      }
    } catch (e) {
      console.warn("Could not load settings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSaveSuccess(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelGenre,
          channelGenrePrompt: customGenrePrompt,
          sceneRenderMethod,
          voiceoverProvider,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaveSuccess("Channel preferences updated successfully!");
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch {
      // Ignore
    } finally {
      setSavingSettings(false);
    }
  };

  const checkYouTube = async () => {
    setYtChecking(true);
    try {
      const res = await fetch("/api/auth/youtube/status").then((r) => r.json());
      if (res.ok) setYtStatus(res);
    } catch {
      // Ignore
    } finally {
      setYtChecking(false);
    }
  };

  const handleTriggerPipeline = async () => {
    setIsTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/trigger-youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoIdea: customIdea.trim() || undefined }),
      });
      const data = await res.json();
      if (data.ok || data.success) {
        setTriggerResult({
          ok: true,
          msg: "Pipeline launched! Dispatched to GitHub Actions runner.",
        });
        setCustomIdea("");
      } else {
        setTriggerResult({
          ok: false,
          msg: data.error || "Failed to trigger workflow",
        });
      }
    } catch (err: any) {
      setTriggerResult({ ok: false, msg: err.message || "Failed to trigger" });
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: YouTube Channel Connection */}
      <Card className="border-red-100 dark:border-red-950/40 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-100 dark:bg-red-950/50 rounded-lg text-red-600">
                <Youtube size={18} />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">YouTube Publishing Channel</CardTitle>
                <CardDescription className="text-xs">
                  OAuth authorization for automated video uploads and scheduled releases
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkYouTube}
              disabled={ytChecking}
              className="h-8 gap-1 text-xs"
            >
              <RefreshCw size={13} className={ytChecking ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3.5">
              {ytStatus?.channel?.avatarUrl ? (
                <img
                  src={ytStatus.channel.avatarUrl}
                  alt="Channel Avatar"
                  className="w-11 h-11 rounded-full border-2 border-red-500 object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold">
                  YT
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm">
                    {ytStatus?.connected
                      ? ytStatus.channel?.title || "Connected YouTube Channel"
                      : "Channel Not Connected"}
                  </h4>
                  {ytStatus?.connected ? (
                    <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-300 text-[11px] gap-1 py-0">
                      <CheckCircle2 size={11} /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-300 text-[11px] py-0">
                      Unauthenticated
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ytStatus?.connected
                    ? ytStatus.channel?.handle || "Ready for automated publication"
                    : "Authorize Google account to generate your YT_REFRESH_TOKEN"}
                </p>
              </div>
            </div>

            <Button
              variant={ytStatus?.connected ? "outline" : "default"}
              size="sm"
              className={ytStatus?.connected ? "text-xs" : "bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5 shadow-sm"}
              onClick={() => window.open("/api/auth/youtube/start", "_blank")}
            >
              <Youtube size={14} />
              {ytStatus?.connected ? "Re-authorize Account" : "Connect YouTube Account"}
              <ExternalLink size={12} className="opacity-70 ml-0.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: Content Niche & Pipeline Steering */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-lg text-indigo-600">
              <Palette size={18} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Channel Niche & Content Persona</CardTitle>
              <CardDescription className="text-xs">
                AI dynamically adapts video topic ideas, script narration tone, and visual animation to this niche
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {GENRE_PRESETS.map((preset) => {
              const isSelected = channelGenre === preset.id;
              return (
                <div
                  key={preset.id}
                  onClick={() => setChannelGenre(preset.id)}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-all text-left flex items-start gap-3 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 dark:border-indigo-500 shadow-sm"
                      : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <span className="text-xl shrink-0 mt-0.5">{preset.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? "text-indigo-950 dark:text-indigo-200" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {preset.label}
                      </span>
                      {isSelected && <CheckCircle2 size={14} className="text-indigo-600 shrink-0 ml-1" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                      {preset.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {channelGenre === "custom" && (
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-medium">Custom Channel Audience & Storytelling Prompt</Label>
              <Textarea
                placeholder="e.g. You are an investigative automotive engineering AI creating high-tension aerodynamic and engine failure analyses..."
                value={customGenrePrompt}
                onChange={(e) => setCustomGenrePrompt(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
          )}

          {/* Engine Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Video size={14} className="text-zinc-500" />
                <Label className="text-xs font-semibold">Visual Scene Rendering Mode</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={sceneRenderMethod === "ai" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSceneRenderMethod("ai")}
                  className={`flex-1 text-xs ${sceneRenderMethod === "ai" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                >
                  AI Generative (Recommended)
                </Button>
                <Button
                  type="button"
                  variant={sceneRenderMethod === "code" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSceneRenderMethod("code")}
                  className={`flex-1 text-xs ${sceneRenderMethod === "code" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                >
                  Deterministic Code
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {sceneRenderMethod === "ai"
                  ? "Gemini generates custom animated illustrations & cinematic graphics for every scene."
                  : "Renders tech UI boxes & code blocks via deterministic canvas."}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Mic size={14} className="text-zinc-500" />
                <Label className="text-xs font-semibold">Voiceover Provider</Label>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={voiceoverProvider === "gemini" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVoiceoverProvider("gemini")}
                  className={`flex-1 text-xs ${voiceoverProvider === "gemini" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                >
                  Gemini TTS (Cloud API)
                </Button>
                <Button
                  type="button"
                  variant={voiceoverProvider === "f5" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setVoiceoverProvider("f5")}
                  className={`flex-1 text-xs ${voiceoverProvider === "f5" ? "bg-indigo-600 hover:bg-indigo-700" : ""}`}
                >
                  F5-TTS (Voice Clone)
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {voiceoverProvider === "gemini"
                  ? "Uses Google Gemini Flash TTS API with crystal-clear conversational pacing."
                  : "Uses open-source local reference audio voice clone model."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                <CheckCircle2 size={13} /> {saveSuccess}
              </span>
            )}
            <div className="ml-auto">
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                size="sm"
                className="text-xs gap-1.5"
              >
                {savingSettings ? <RefreshCw size={13} className="animate-spin" /> : <Settings2 size={13} />}
                Save Preferences
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: One-Click Pipeline Launcher */}
      <Card className="bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 border-indigo-200/60 dark:border-indigo-900/40 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-lg text-emerald-700">
              <PlayCircle size={18} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Run Video Generation Pipeline</CardTitle>
              <CardDescription className="text-xs">
                Trigger GitHub Actions to generate, render, assemble, and publish a new video
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <Input
              placeholder="Custom topic idea (optional — leave empty to pull next idea from queue)"
              value={customIdea}
              onChange={(e) => setCustomIdea(e.target.value)}
              disabled={isTriggering}
              className="text-xs flex-1"
            />
            <Button
              onClick={handleTriggerPipeline}
              disabled={isTriggering}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shrink-0 shadow-sm"
            >
              {isTriggering ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Dispatching...
                </>
              ) : (
                <>
                  <PlayCircle size={14} />
                  Trigger Pipeline
                </>
              )}
            </Button>
          </div>

          {triggerResult && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                triggerResult.ok
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:border-red-900/50"
              }`}
            >
              {triggerResult.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              <span>{triggerResult.msg}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
