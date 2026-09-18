"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    MessageSquare,
    Play,
    RefreshCw,
    CheckCircle2,
    Clock,
    AlertCircle,
    Sliders,
    Sparkles,
    ShieldCheck,
    FlaskConical,
    User,
    Check,
} from 'lucide-react';
import { CommentReplySettings, ReplyHistoryEntry } from '@/lib/comment-reply/types';

export default function CommentReplySection() {
    const [settings, setSettings] = useState<CommentReplySettings>({
        enabled: true,
        dryRun: false,
        maxRepliesPerRun: 5,
        tone: 'friendly',
        replyToQuestionsOnly: false,
        customInstructions: '',
    });

    const [history, setHistory] = useState<ReplyHistoryEntry[]>([]);
    const [stats, setStats] = useState({ totalLiveReplies: 0, totalDryRunReplies: 0, totalFailed: 0 });
    const [loading, setLoading] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [processResult, setProcessResult] = useState<any | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showConfig, setShowConfig] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch('/api/comments/history?limit=30');
            const data = await res.json();
            if (data.ok) {
                if (data.settings) setSettings(data.settings);
                if (data.history) setHistory(data.history);
                if (data.stats) setStats(data.stats);
            } else {
                setErrorMsg(data.error || 'Failed to load comments data');
            }
        } catch (err: any) {
            setErrorMsg(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            const res = await fetch('/api/comments/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });
            const data = await res.json();
            if (data.ok) {
                setSettings(data.settings);
                setSuccessMsg('Settings saved successfully!');
                setTimeout(() => setSuccessMsg(null), 4000);
            } else {
                setErrorMsg(data.error || 'Failed to save settings');
            }
        } catch (err: any) {
            setErrorMsg(String(err));
        } finally {
            setSavingSettings(false);
        }
    };

    const handleProcessNow = async (forceDryRun?: boolean) => {
        setProcessing(true);
        setErrorMsg(null);
        setSuccessMsg(null);
        setProcessResult(null);

        try {
            const res = await fetch('/api/comments/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dryRun: forceDryRun !== undefined ? forceDryRun : settings.dryRun,
                    maxReplies: settings.maxRepliesPerRun,
                    force: true,
                }),
            });
            const data = await res.json();
            if (data.ok) {
                setProcessResult(data.result);
                setSuccessMsg(
                    `Processed successfully! Scanned: ${data.result.totalChecked} | Sent: ${data.result.repliesSent} | DryRun: ${data.result.repliesDryRun} | Skipped: ${data.result.repliesSkipped}`
                );
                await loadData();
            } else {
                setErrorMsg(data.error || 'Processing run failed');
            }
        } catch (err: any) {
            setErrorMsg(String(err));
        } finally {
            setProcessing(false);
        }
    };

    const [dispatching, setDispatching] = useState(false);

    const handleDispatchGitHub = async () => {
        setDispatching(true);
        setErrorMsg(null);
        setSuccessMsg(null);
        try {
            const res = await fetch('/api/cron/auto-comment-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dryRun: settings.dryRun,
                    maxReplies: settings.maxRepliesPerRun,
                    force: true,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg('GitHub Actions comment reply workflow dispatched successfully!');
                setTimeout(() => setSuccessMsg(null), 5000);
            } else {
                setErrorMsg(data.error || 'Failed to dispatch GitHub workflow');
            }
        } catch (err: any) {
            setErrorMsg(String(err));
        } finally {
            setDispatching(false);
        }
    };

    const formatRelativeTime = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    return (
        <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
                            <MessageSquare size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-lg">Auto Comment Reply</CardTitle>
                                {settings.enabled ? (
                                    settings.dryRun ? (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                                            <FlaskConical size={11} /> Dry Run Mode
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                                            <ShieldCheck size={11} /> Active (Live)
                                        </span>
                                    )
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                                        Paused
                                    </span>
                                )}
                            </div>
                            <CardDescription className="text-xs mt-0.5">
                                AI-powered comment engagement with Gemini & YouTube Data API v3
                            </CardDescription>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowConfig(!showConfig)}
                            className="gap-1.5 text-xs h-9"
                        >
                            <Sliders size={14} />
                            {showConfig ? 'Hide Settings' : 'Settings'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadData}
                            disabled={loading || processing}
                            className="gap-1.5 text-xs h-9"
                            title="Refresh logs"
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handleProcessNow()}
                            disabled={processing || loading || dispatching}
                            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9"
                        >
                            {processing ? (
                                <>
                                    <RefreshCw size={13} className="animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Play size={13} fill="currentColor" />
                                    Process Now
                                </>
                            )}
                        </Button>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDispatchGitHub()}
                            disabled={dispatching || processing || loading}
                            className="gap-1.5 text-xs h-9 bg-gray-100 hover:bg-gray-200 text-gray-800"
                            title="Dispatch workflow on GitHub Actions"
                        >
                            <RefreshCw size={13} className={dispatching ? 'animate-spin' : ''} />
                            {dispatching ? 'Dispatching...' : 'Dispatch GitHub Action'}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {errorMsg && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                        <AlertCircle size={15} className="shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                    </div>
                )}

                {successMsg && (
                    <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-200 p-3 rounded-lg">
                        <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                        <span>{successMsg}</span>
                    </div>
                )}

                {/* KPI Metrics */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 border rounded-lg">
                        <span className="text-xs text-muted-foreground font-medium">Live Replies Sent</span>
                        <p className="text-xl font-bold text-gray-900 mt-1">{stats.totalLiveReplies}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border rounded-lg">
                        <span className="text-xs text-muted-foreground font-medium">Dry-Run Simulations</span>
                        <p className="text-xl font-bold text-amber-700 mt-1">{stats.totalDryRunReplies}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border rounded-lg">
                        <span className="text-xs text-muted-foreground font-medium">Execution Errors</span>
                        <p className="text-xl font-bold text-red-600 mt-1">{stats.totalFailed}</p>
                    </div>
                </div>

                {/* Configuration Panel */}
                {showConfig && (
                    <div className="border border-indigo-100 bg-indigo-50/20 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 border-b border-indigo-100 pb-2">
                            <Sliders size={16} className="text-indigo-600" />
                            <h4 className="text-sm font-semibold text-gray-900">Auto Reply Configuration</h4>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Feature Status</Label>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.enabled}
                                            onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-600"
                                        />
                                        Enable Auto Replies
                                    </label>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settings.dryRun}
                                            onChange={(e) => setSettings({ ...settings, dryRun: e.target.checked })}
                                            className="rounded border-gray-300 text-indigo-600"
                                        />
                                        Dry-Run Only (simulate)
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="tone" className="text-xs font-semibold">Reply Tone / Personality</Label>
                                <select
                                    id="tone"
                                    value={settings.tone}
                                    onChange={(e: any) => setSettings({ ...settings, tone: e.target.value })}
                                    className="w-full text-xs h-9 border rounded-md px-3 bg-white"
                                >
                                    <option value="friendly">Friendly & Approachable</option>
                                    <option value="professional">Professional & Direct</option>
                                    <option value="technical">Deeply Technical & Clear</option>
                                    <option value="enthusiastic">Enthusiastic & High Energy</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="maxReplies" className="text-xs font-semibold">Max Replies Per Run</Label>
                                <Input
                                    id="maxReplies"
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={settings.maxRepliesPerRun}
                                    onChange={(e) => setSettings({ ...settings, maxRepliesPerRun: parseInt(e.target.value, 10) || 5 })}
                                    className="text-xs h-9 bg-white"
                                />
                                <span className="text-[11px] text-muted-foreground">Default 5 (conserves YouTube API quota)</span>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Filter Rules</Label>
                                <label className="flex items-center gap-2 text-xs cursor-pointer pt-2">
                                    <input
                                        type="checkbox"
                                        checked={settings.replyToQuestionsOnly}
                                        onChange={(e) => setSettings({ ...settings, replyToQuestionsOnly: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600"
                                    />
                                    Reply to Questions Only (skip compliments)
                                </label>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="instructions" className="text-xs font-semibold">Custom Persona & Instructions</Label>
                            <Textarea
                                id="instructions"
                                rows={2}
                                value={settings.customInstructions || ''}
                                onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
                                placeholder="E.g., Speak as the software engineer founder. If viewers ask about code, mention our open-source repo."
                                className="text-xs bg-white resize-none"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                size="sm"
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                            >
                                {savingSettings ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                Save Settings
                            </Button>
                        </div>
                    </div>
                )}

                {/* Live Processing Summary Banner */}
                {processResult && (
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-indigo-900">
                            <Sparkles size={14} className="text-indigo-600" />
                            Latest Run Results:
                        </div>
                        <p className="text-indigo-800">
                            Checked <span className="font-bold">{processResult.totalChecked}</span> comment threads.
                            Replied: <span className="font-bold text-green-700">{processResult.repliesSent}</span> |
                            Dry-run: <span className="font-bold text-amber-700">{processResult.repliesDryRun}</span> |
                            Skipped: <span className="font-bold text-gray-600">{processResult.repliesSkipped}</span>.
                        </p>
                    </div>
                )}

                {/* Recent Replies Feed */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Recent Auto-Reply Activity ({history.length})
                        </span>
                    </div>

                    {history.length === 0 ? (
                        <div className="text-center py-8 border rounded-lg border-dashed bg-gray-50/50">
                            <MessageSquare size={24} className="mx-auto text-gray-400 mb-1.5 opacity-60" />
                            <p className="text-xs font-medium text-gray-600">No comment reply activity yet</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                Click &quot;Process Now&quot; above to scan and reply to recent viewer comments.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                            {history.map((item) => (
                                <div
                                    key={item.id}
                                    className="p-3 border rounded-lg bg-white hover:border-indigo-200 transition-colors space-y-2 text-xs shadow-xs"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
                                                <User size={13} />
                                            </div>
                                            <span className="font-semibold text-gray-900 truncate">
                                                {item.authorName}
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 text-gray-600 truncate max-w-[200px]" title={item.videoTitle}>
                                                📺 {item.videoTitle}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {item.status === 'posted' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 flex items-center gap-1">
                                                    <CheckCircle2 size={10} /> Live
                                                </span>
                                            )}
                                            {item.status === 'dry_run' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 flex items-center gap-1">
                                                    <FlaskConical size={10} /> Simulated
                                                </span>
                                            )}
                                            {item.status === 'failed' && (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-700 flex items-center gap-1">
                                                    <AlertCircle size={10} /> Failed
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                <Clock size={10} /> {formatRelativeTime(item.timestamp)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Viewer Comment */}
                                    <div className="bg-gray-50 p-2 rounded text-gray-700 italic border-l-2 border-gray-300">
                                        &ldquo;{item.commentText}&rdquo;
                                    </div>

                                    {/* AI Reply */}
                                    <div className="bg-indigo-50/60 p-2.5 rounded-md text-indigo-950 border-l-2 border-indigo-500 space-y-1">
                                        <div className="flex items-center justify-between text-[10px] text-indigo-700 font-semibold">
                                            <span className="flex items-center gap-1">
                                                <Sparkles size={11} /> AI Reply ({item.category})
                                            </span>
                                            <span className="capitalize">{item.sentiment} sentiment</span>
                                        </div>
                                        <p className="text-xs font-normal">{item.replyText}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
