"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    CheckCircle2,
    XCircle,
    MinusCircle,
    AlertCircle,
    Lightbulb,
    FileText,
    Film,
    Mic,
    Settings2,
    Image as ImageIcon,
    Youtube,
    PlayCircle,
    RefreshCw,
    Copy,
    Check,
    ExternalLink,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

// ─── Pipeline Types ────────────────────────────────────────────────────────────
type JobResult = 'success' | 'failure' | 'skipped' | 'cancelled' | null;

type ShortResult = {
    shortIndex: number;
    shortId: string;
    youtubeId: string;
    videoUrl?: string;
    scheduledPublishTime?: string;
    rank?: number;
};

type PipelineStatus = {
    overallStatus: 'success' | 'failure';
    ranAt: string;
    videoId: string;
    videoTitle: string;
    description?: string;
    youtubeId?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    sceneUrls?: string[];
    voiceoverUrls?: string[];
    sceneNarrations?: string[];
    ideasAdded?: string[];
    shortHooks?: string[];
    shorts?: ShortResult[];
    scriptData?: unknown;
    jobs: {
        populateIdeas: JobResult;
        generateScript: JobResult;
        renderScenes: JobResult;
        generateVoiceover: JobResult;
        assembleLongForm: JobResult;
        generateThumbnail: JobResult;
        uploadYoutube: JobResult;
        shortsProcessing: JobResult;
    };
};

type IdeasQueue = {
    ideas: string[];
    count: number;
};

// ─── Pipeline Helpers ──────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
    const ms = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ result }: { result: JobResult }) {
    if (!result) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
                –
            </span>
        );
    }
    const config: Record<NonNullable<JobResult>, { classes: string; icon: React.ReactNode; label: string }> = {
        success: { classes: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={12} />, label: 'success' },
        failure: { classes: 'bg-red-100 text-red-700', icon: <XCircle size={12} />, label: 'failed' },
        skipped: { classes: 'bg-gray-100 text-gray-500', icon: <MinusCircle size={12} />, label: 'skipped' },
        cancelled: { classes: 'bg-yellow-100 text-yellow-700', icon: <AlertCircle size={12} />, label: 'cancelled' },
    };
    const c = config[result];
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.classes}`}>
            {c.icon}
            {c.label}
        </span>
    );
}

// ─── Action Buttons ────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={handle}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1 bg-white hover:bg-gray-50 transition-colors"
        >
            {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
            {copied ? 'Copied!' : label}
        </button>
    );
}

function OpenButton({ url, label = 'Open' }: { url: string; label?: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1 bg-white hover:bg-gray-50 transition-colors"
        >
            <ExternalLink size={12} />
            {label}
        </a>
    );
}

function YouTubeButton({ youtubeId, label = 'Watch on YouTube' }: { youtubeId: string; label?: string }) {
    return (
        <a
            href={`https://youtube.com/watch?v=${youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-white bg-red-600 hover:bg-red-700 rounded px-3 py-1.5 font-medium transition-colors"
        >
            <Youtube size={13} />
            {label}
        </a>
    );
}

// ─── Media Components ──────────────────────────────────────────────────────────

function AudioPlayerItem({ url, narration }: { url: string; narration?: string }) {
    return (
        <div className="space-y-2">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={url} className="w-full h-9" preload="none" />
            {narration && (
                <p className="text-xs text-gray-600 italic leading-relaxed">{narration}</p>
            )}
        </div>
    );
}

function MediaCarousel({ urls, type, narrations }: {
    urls: string[];
    type: 'video' | 'audio';
    narrations?: string[];
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    if (!urls || urls.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{activeIndex + 1} / {urls.length}</span>
                <div className="flex gap-1">
                    {urls.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveIndex(i)}
                            className={`w-2 h-2 rounded-full transition-colors ${i === activeIndex ? 'bg-gray-800' : 'bg-gray-300 hover:bg-gray-400'}`}
                        />
                    ))}
                </div>
            </div>
            <div className="border rounded-lg p-3 bg-gray-50 space-y-2">
                {type === 'video' ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video key={urls[activeIndex]} controls className="w-full rounded bg-black aspect-video object-contain" preload="metadata">
                        <source src={urls[activeIndex]} />
                    </video>
                ) : (
                    <AudioPlayerItem url={urls[activeIndex]} narration={narrations?.[activeIndex]} />
                )}
                <div className="flex gap-2">
                    <CopyButton text={urls[activeIndex]} />
                    <OpenButton url={urls[activeIndex]} label={type === 'video' ? 'Open video' : 'Open audio'} />
                </div>
            </div>
            {urls.length > 1 && (
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveIndex(i => Math.max(0, i - 1))}
                        disabled={activeIndex === 0}
                        className="text-xs border rounded px-3 py-1 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ← Prev
                    </button>
                    <button
                        onClick={() => setActiveIndex(i => Math.min(urls.length - 1, i + 1))}
                        disabled={activeIndex === urls.length - 1}
                        className="text-xs border rounded px-3 py-1 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Job Output Components ─────────────────────────────────────────────────────

function IdeasOutput({ ideas }: { ideas?: string[] }) {
    if (!ideas || ideas.length === 0) {
        return <p className="text-xs text-gray-500 italic">Queue was already full — no new ideas were added.</p>;
    }
    return (
        <ul className="space-y-1.5">
            {ideas.map((idea, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                    {idea}
                </li>
            ))}
        </ul>
    );
}

function ScriptOutput({ title, description, sceneNarrations, shortHooks, scriptData }: {
    title?: string;
    description?: string;
    sceneNarrations?: string[];
    shortHooks?: string[];
    scriptData?: unknown;
}) {
    const [showScenes, setShowScenes] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyJson = async () => {
        const raw = JSON.stringify(scriptData ?? { title, description, sceneNarrations, shortHooks }, null, 2);
        await navigator.clipboard.writeText(raw);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-3">
            <button
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1 bg-white hover:bg-gray-50 transition-colors"
            >
                {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy raw JSON'}
            </button>
            {title && <p className="font-semibold text-sm">{title}</p>}
            {description && <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">{description}</p>}
            {sceneNarrations && sceneNarrations.length > 0 && (
                <div>
                    <button
                        onClick={() => setShowScenes(v => !v)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900"
                    >
                        <Film size={13} />
                        {sceneNarrations.length} scenes
                        {showScenes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {showScenes && (
                        <div className="mt-2 space-y-2">
                            {sceneNarrations.map((n, i) => (
                                <div key={i} className="border rounded p-2 bg-gray-50">
                                    <span className="text-xs font-medium text-gray-400 block mb-1">Scene {i + 1}</span>
                                    <p className="text-sm text-gray-700">{n}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {shortHooks && shortHooks.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">Short hooks ({shortHooks.length})</p>
                    {shortHooks.map((hook, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-xs font-medium text-gray-400 shrink-0">#{i + 1}</span>
                            <p className="text-gray-700">{hook}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ThumbnailOutput({ url }: { url: string }) {
    return (
        <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Video thumbnail" className="w-full max-w-sm rounded-lg border" />
            <div className="flex gap-2">
                <CopyButton text={url} />
                <OpenButton url={url} label="Open image" />
            </div>
        </div>
    );
}

function AssembledVideoOutput({ url }: { url: string }) {
    return (
        <div className="space-y-2">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video controls className="w-full rounded-lg max-h-80 bg-black" preload="none">
                <source src={url} />
            </video>
            <div className="flex gap-2">
                <CopyButton text={url} />
                <OpenButton url={url} label="Open video" />
            </div>
        </div>
    );
}

function ShortsOutput({ shorts, shortHooks }: { shorts?: ShortResult[]; shortHooks?: string[] }) {
    if (!shorts || shorts.length === 0) {
        return <p className="text-xs text-gray-500 italic">No shorts data available yet.</p>;
    }
    return (
        <div className="space-y-2">
            {[...shorts]
                .sort((a, b) => a.shortIndex - b.shortIndex)
                .map((s) => (
                    <div key={s.shortIndex} className="flex items-start justify-between gap-3 border rounded-lg p-3 bg-gray-50">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">Short {s.shortIndex + 1}</p>
                            {shortHooks?.[s.shortIndex] && (
                                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{shortHooks[s.shortIndex]}</p>
                            )}
                            {s.scheduledPublishTime && (
                                <p className="text-xs text-gray-400 mt-0.5">Scheduled: {s.scheduledPublishTime}</p>
                            )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <YouTubeButton youtubeId={s.youtubeId} label="YouTube" />
                            {s.videoUrl && <CopyButton text={s.videoUrl} />}
                        </div>
                    </div>
                ))}
        </div>
    );
}

// ─── Pipeline Section Component ────────────────────────────────────────────────

function PipelineSection() {
    const [status, setStatus] = useState<PipelineStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch('/api/pipeline-status');
            const data = await res.json();
            if (data.ok) {
                setStatus(data.status ?? null);
            } else {
                setError(data.error ?? 'Failed to load pipeline status');
            }
        } catch (err: any) {
            setError(String(err));
        }
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const handleRefresh = async () => {
        setLoading(true);
        await load();
        setLoading(false);
    };

    const isSuccess = status?.overallStatus === 'success';

    const jobItems = status ? [
        {
            key: 'populateIdeas',
            title: 'Populate Ideas',
            icon: <Lightbulb size={16} />,
            result: status.jobs.populateIdeas,
            content: <IdeasOutput ideas={status.ideasAdded} />,
        },
        {
            key: 'generateScript',
            title: 'Generate Script',
            icon: <FileText size={16} />,
            result: status.jobs.generateScript,
            content: (
                <ScriptOutput
                    title={status.videoTitle}
                    description={status.description}
                    sceneNarrations={status.sceneNarrations}
                    shortHooks={status.shortHooks}
                    scriptData={status.scriptData}
                />
            ),
        },
        {
            key: 'renderScenes',
            title: 'Render Scenes',
            icon: <Film size={16} />,
            result: status.jobs.renderScenes,
            content: status.sceneUrls && status.sceneUrls.length > 0
                ? <MediaCarousel urls={status.sceneUrls} type="video" narrations={status.sceneNarrations} />
                : <p className="text-xs text-gray-500 italic">No scene videos available.</p>,
        },
        {
            key: 'generateVoiceover',
            title: 'Generate Voiceover',
            icon: <Mic size={16} />,
            result: status.jobs.generateVoiceover,
            content: status.voiceoverUrls && status.voiceoverUrls.length > 0
                ? <MediaCarousel urls={status.voiceoverUrls} type="audio" narrations={status.sceneNarrations} />
                : <p className="text-xs text-gray-500 italic">No voiceover audio available.</p>,
        },
        {
            key: 'assembleLongForm',
            title: 'Assemble Video',
            icon: <Settings2 size={16} />,
            result: status.jobs.assembleLongForm,
            content: status.videoUrl
                ? <AssembledVideoOutput url={status.videoUrl} />
                : <p className="text-xs text-gray-500 italic">No assembled video URL.</p>,
        },
        {
            key: 'generateThumbnail',
            title: 'Generate Thumbnail',
            icon: <ImageIcon size={16} />,
            result: status.jobs.generateThumbnail,
            content: status.thumbnailUrl
                ? <ThumbnailOutput url={status.thumbnailUrl} />
                : <p className="text-xs text-gray-500 italic">No thumbnail URL.</p>,
        },
        {
            key: 'uploadYoutube',
            title: 'Upload to YouTube',
            icon: <Youtube size={16} />,
            result: status.jobs.uploadYoutube,
            content: status.youtubeId
                ? <div className="flex"><YouTubeButton youtubeId={status.youtubeId} /></div>
                : <p className="text-xs text-gray-500 italic">No YouTube ID available.</p>,
        },
        {
            key: 'shortsProcessing',
            title: 'Shorts Processing',
            icon: <PlayCircle size={16} />,
            result: status.jobs.shortsProcessing,
            content: <ShortsOutput shorts={status.shorts} shortHooks={status.shortHooks} />,
        },
    ] : [];

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Pipeline Status</CardTitle>
                        <CardDescription>Latest video generation pipeline run</CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={loading}
                        className="gap-2"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading && !status && (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <RefreshCw size={20} className="animate-spin mr-2" />
                        Loading...
                    </div>
                )}
                {error && !status && (
                    <div className="space-y-3">
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>
                        <Button variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
                    </div>
                )}
                {!loading && !error && !status && (
                    <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
                        <p className="font-medium">No pipeline runs yet</p>
                        <p className="text-sm mt-1">Once a video pipeline completes, results will appear here.</p>
                    </div>
                )}
                {status && (
                    <div className="space-y-4">
                        {/* Overall status banner */}
                        <div className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${isSuccess ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            {isSuccess
                                ? <CheckCircle2 size={28} className="text-green-600 shrink-0 mt-0.5" />
                                : <XCircle size={28} className="text-red-600 shrink-0 mt-0.5" />
                            }
                            <div className="flex-1 min-w-0">
                                <p className={`font-bold text-base ${isSuccess ? 'text-green-800' : 'text-red-800'}`}>
                                    {isSuccess ? 'Pipeline Succeeded ✅' : 'Pipeline Failed ❌'}
                                </p>
                                {status.videoTitle && (
                                    <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{status.videoTitle}</p>
                                )}
                                {status.ranAt && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {formatRelativeTime(status.ranAt)} · {new Date(status.ranAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            {status.youtubeId && (
                                <div className="shrink-0">
                                    <YouTubeButton youtubeId={status.youtubeId} />
                                </div>
                            )}
                        </div>

                        {/* Per-job accordions */}
                        <div>
                            <p className="text-sm font-semibold mb-2">Pipeline Jobs</p>
                            <Accordion type="multiple" className="border rounded-lg divide-y">
                                {jobItems.map((job) => (
                                    <AccordionItem key={job.key} value={job.key} className="border-0 last:border-0">
                                        <AccordionTrigger className="px-4 hover:no-underline [&>svg]:ml-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <span className="text-gray-500 shrink-0">{job.icon}</span>
                                                <span className="font-medium text-sm">{job.title}</span>
                                            </div>
                                            <div className="shrink-0 mr-1">
                                                <StatusBadge result={job.result} />
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4">
                                            {job.content}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function DashboardClient() {
    const [ideasQueue, setIdeasQueue] = useState<IdeasQueue | null>(null);
    const [newIdea, setNewIdea] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');
    const [ideasLoading, setIdeasLoading] = useState(false);
    const [ideasError, setIdeasError] = useState<string | null>(null);

    const [shortsPublishTime, setShortsPublishTime] = useState<string>('16:30');
    const [shortsTimeLoading, setShortsTimeLoading] = useState(false);
    const [shortsTimeError, setShortsTimeError] = useState<string | null>(null);

    // New schedule times state
    const [shortsTimes, setShortsTimes] = useState<string[]>(['16:30', '18:00', '20:00', '12:00', '14:00']);
    const [longFormTime, setLongFormTime] = useState<string>('18:30');
    const [scheduleLoading, setScheduleLoading] = useState(false);
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

    useEffect(() => {
        loadIdeasQueue();
        loadShortsPublishTime();
        loadScheduleTimes();
    }, []);

    const loadIdeasQueue = async () => {
        try {
            const res = await fetch('/api/ideas-queue');
            const data = await res.json();
            if (data.ok) {
                setIdeasQueue({ ideas: data.ideas, count: data.count });
            } else {
                setIdeasError(data.error);
            }
        } catch (err) {
            setIdeasError(String(err));
        }
    };

    const loadShortsPublishTime = async () => {
        try {
            const res = await fetch('/api/shorts-publish-time');
            const data = await res.json();
            if (data.ok) {
                setShortsPublishTime(data.time);
            }
        } catch (err) {
            console.error('Failed to load shorts publish time:', err);
        }
    };

    const saveShortsPublishTime = async () => {
        setShortsTimeLoading(true);
        setShortsTimeError(null);
        try {
            const res = await fetch('/api/shorts-publish-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ time: shortsPublishTime }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
        } catch (err: any) {
            setShortsTimeError(String(err));
        } finally {
            setShortsTimeLoading(false);
        }
    };

    const loadScheduleTimes = async () => {
        try {
            const res = await fetch('/api/schedule-times');
            const data = await res.json();
            if (data.ok) {
                setShortsTimes(data.shortsTimes);
                setLongFormTime(data.longFormTime);
            }
        } catch (err) {
            console.error('Failed to load schedule times:', err);
        }
    };

    const saveScheduleTimes = async () => {
        setScheduleLoading(true);
        setScheduleError(null);
        setScheduleSuccess(null);
        try {
            const res = await fetch('/api/schedule-times', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shortsTimes, longFormTime }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setScheduleSuccess('Schedule times updated successfully!');
            setTimeout(() => setScheduleSuccess(null), 3000);
        } catch (err: any) {
            setScheduleError(String(err));
        } finally {
            setScheduleLoading(false);
        }
    };



    const addIdea = async () => {
        if (!newIdea.trim()) return;

        setIdeasLoading(true);
        setIdeasError(null);
        try {
            const res = await fetch('/api/ideas-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'add', idea: newIdea.trim() }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setIdeasQueue({ ideas: data.ideas, count: data.count });
            setNewIdea('');
        } catch (err: any) {
            setIdeasError(String(err));
        } finally {
            setIdeasLoading(false);
        }
    };

    const editIdea = async (index: number) => {
        if (!editingText.trim()) return;

        setIdeasLoading(true);
        setIdeasError(null);
        try {
            const res = await fetch('/api/ideas-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'edit', index, idea: editingText.trim() }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setIdeasQueue({ ideas: data.ideas, count: data.count });
            setEditingIndex(null);
            setEditingText('');
        } catch (err: any) {
            setIdeasError(String(err));
        } finally {
            setIdeasLoading(false);
        }
    };

    const startEditing = (index: number, currentIdea: string) => {
        setEditingIndex(index);
        setEditingText(currentIdea);
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditingText('');
    };

    const removeIdea = async (index: number) => {
        setIdeasLoading(true);
        setIdeasError(null);
        try {
            const res = await fetch('/api/ideas-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove', index }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setIdeasQueue({ ideas: data.ideas, count: data.count });
        } catch (err: any) {
            setIdeasError(String(err));
        } finally {
            setIdeasLoading(false);
        }
    };

    const moveIdea = async (index: number, direction: 'up' | 'down') => {
        if (!ideasQueue) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= ideasQueue.ideas.length) return;

        setIdeasLoading(true);
        setIdeasError(null);
        try {
            const res = await fetch('/api/ideas-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'move', index, newIndex }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setIdeasQueue({ ideas: data.ideas, count: data.count });
        } catch (err: any) {
            setIdeasError(String(err));
        } finally {
            setIdeasLoading(false);
        }
    };

    const clearQueue = async () => {
        if (!confirm('Are you sure you want to clear all ideas?')) return;

        setIdeasLoading(true);
        setIdeasError(null);
        try {
            const res = await fetch('/api/ideas-queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'clear' }),
            });
            const data = await res.json();
            if (!data.ok) throw new Error(data.error);
            setIdeasQueue({ ideas: data.ideas, count: data.count });
        } catch (err: any) {
            setIdeasError(String(err));
        } finally {
            setIdeasLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Pipeline Dashboard</h1>
                <p className="text-muted-foreground mt-2">
                    Manage video ideas queue and shorts publishing schedule
                </p>
            </div>

            <PipelineSection />

            <Card>
                <CardHeader>
                    <CardTitle>Shorts Schedule Times (IST)</CardTitle>
                    <CardDescription>Configure 5 ranked publish times for shorts (best to worst performance)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {scheduleError && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                            {scheduleError}
                        </div>
                    )}
                    {scheduleSuccess && (
                        <div className="text-sm text-green-600 bg-green-50 p-3 rounded">
                            {scheduleSuccess}
                        </div>
                    )}

                    <div className="space-y-3">
                        {shortsTimes.map((time, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <div className="w-20 text-sm font-medium text-muted-foreground">
                                    Rank {index + 1}
                                    {index === 0 && ' 🏆'}
                                </div>
                                <Input
                                    type="time"
                                    value={time}
                                    onChange={e => {
                                        const newTimes = [...shortsTimes];
                                        newTimes[index] = e.target.value;
                                        setShortsTimes(newTimes);
                                    }}
                                    disabled={scheduleLoading}
                                    className="flex-1"
                                />
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Shorts are automatically assigned times based on their rank. Best shorts get Rank 1 time.
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Long-Form Video Schedule Time (IST)</CardTitle>
                    <CardDescription>Set the default publish time for long-form YouTube videos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-end gap-4">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="longform-time">Time (24-hour format HH:MM)</Label>
                            <Input
                                id="longform-time"
                                type="time"
                                value={longFormTime}
                                onChange={e => setLongFormTime(e.target.value)}
                                disabled={scheduleLoading}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Current: {longFormTime} IST (Indian Standard Time)
                    </p>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    onClick={saveScheduleTimes}
                    disabled={scheduleLoading}
                    size="lg"
                >
                    {scheduleLoading ? 'Saving...' : 'Save Schedule Times'}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Video Ideas Queue</CardTitle>
                            <CardDescription>Manage the queue of video ideas for generation</CardDescription>
                        </div>
                        <div className="text-sm font-medium">
                            {ideasQueue && <span className="text-muted-foreground">{ideasQueue.count} ideas</span>}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {ideasError && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                            {ideasError}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Add New Idea</Label>
                        <div className="flex gap-2">
                            <Textarea
                                placeholder="Enter a video idea, e.g., 'How DNS Works' or 'Docker Containers Explained'"
                                value={newIdea}
                                onChange={e => setNewIdea(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                        addIdea();
                                    }
                                }}
                                className="flex-1"
                                rows={2}
                            />
                            <Button
                                onClick={addIdea}
                                disabled={!newIdea.trim() || ideasLoading}
                            >
                                Add
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Press Ctrl+Enter to add</p>
                    </div>

                    {ideasQueue && ideasQueue.ideas.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Current Queue ({ideasQueue.count})</Label>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={clearQueue}
                                    disabled={ideasLoading}
                                    className="text-red-600 hover:text-red-700"
                                >
                                    Clear All
                                </Button>
                            </div>

                            <div className="border rounded-md divide-y max-h-96 overflow-y-auto">
                                {ideasQueue.ideas.map((idea, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-3 p-3 hover:bg-gray-50"
                                    >
                                        <span className="text-xs text-muted-foreground w-8">#{index + 1}</span>
                                        <div className="flex flex-col gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => moveIdea(index, 'up')}
                                                disabled={index === 0 || ideasLoading || editingIndex === index}
                                                className="h-6 w-6 p-0"
                                                title="Move up"
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => moveIdea(index, 'down')}
                                                disabled={index === ideasQueue.ideas.length - 1 || ideasLoading || editingIndex === index}
                                                className="h-6 w-6 p-0"
                                                title="Move down"
                                            >
                                                ↓
                                            </Button>
                                        </div>
                                        {editingIndex === index ? (
                                            <div className="flex-1 flex items-center gap-2">
                                                <Textarea
                                                    value={editingText}
                                                    onChange={(e) => setEditingText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && e.ctrlKey) {
                                                            editIdea(index);
                                                        } else if (e.key === 'Escape') {
                                                            cancelEditing();
                                                        }
                                                    }}
                                                    className="flex-1 text-sm"
                                                    rows={2}
                                                    autoFocus
                                                />
                                                <div className="flex flex-col gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => editIdea(index)}
                                                        disabled={!editingText.trim() || ideasLoading}
                                                        className="h-8"
                                                        title="Save (Ctrl+Enter)"
                                                    >
                                                        ✓
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={cancelEditing}
                                                        disabled={ideasLoading}
                                                        className="h-8"
                                                        title="Cancel (Esc)"
                                                    >
                                                        ✕
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (() => {
                                            let parsedIdea = null;
                                            try {
                                                parsedIdea = JSON.parse(idea);
                                            } catch (e) {
                                                // Ignore, it's a regular string
                                            }
                                            
                                            const isSeries = parsedIdea && parsedIdea.isSeries;
                                            
                                            return (
                                            <>
                                                {isSeries ? (
                                                    <div className="flex-1 flex flex-col gap-1 border-l-4 border-indigo-500 pl-3 py-1 bg-indigo-50/30 rounded-r-md overflow-hidden">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded flex items-center uppercase tracking-wider">
                                                                📺 Series: {parsedIdea.seriesContext?.seriesTitle || 'Unknown Series'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm font-medium">{parsedIdea.topic}</p>
                                                        {parsedIdea.seriesContext?.learningObjective && (
                                                            <p className="text-xs text-muted-foreground truncate" title={parsedIdea.seriesContext.learningObjective}>
                                                                {parsedIdea.seriesContext.learningObjective}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="flex-1 text-sm break-words">{idea}</p>
                                                )}
                                                
                                                <div className="flex flex-col gap-1 sm:flex-row sm:gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => startEditing(index, idea)}
                                                        disabled={ideasLoading || editingIndex !== null || isSeries}
                                                        className="text-blue-600 hover:text-blue-700 disabled:opacity-30 h-8 w-8 p-0"
                                                        title={isSeries ? "Cannot edit series episodes directly" : "Edit idea"}
                                                    >
                                                        ✎
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => removeIdea(index)}
                                                        disabled={ideasLoading || editingIndex !== null}
                                                        className="text-red-600 hover:text-red-700 h-8 w-8 p-0"
                                                        title="Remove idea"
                                                    >
                                                        ✕
                                                    </Button>
                                                </div>
                                            </>
                                        )})()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground border rounded-md border-dashed">
                            <p>No ideas in queue</p>
                            <p className="text-xs mt-1">Add your first video idea above</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

