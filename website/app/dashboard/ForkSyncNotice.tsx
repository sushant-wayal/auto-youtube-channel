"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { GitFork, RefreshCw, Sparkles, ExternalLink, CheckCircle2, AlertTriangle } from 'lucide-react';

type ForkSyncStatus = {
    ok: boolean;
    isFork: boolean;
    isBehind?: boolean;
    behindBy?: number;
    aheadBy?: number;
    parentRepo?: string;
    parentBranch?: string;
    forkRepo?: string;
    forkBranch?: string;
    compareUrl?: string;
    error?: string;
};

export default function ForkSyncNotice() {
    const [status, setStatus] = useState<ForkSyncStatus | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);

    const checkStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/fork-sync', { cache: 'no-store' });
            const data: ForkSyncStatus = await res.json();
            if (data.ok) {
                setStatus(data);
            }
        } catch (err) {
            console.error('[ForkSyncNotice] Failed to check fork status:', err);
        }
    }, []);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const handleSync = async () => {
        setSyncing(true);
        setSyncError(null);
        setSyncSuccess(null);
        try {
            const res = await fetch('/api/fork-sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();

            if (data.ok) {
                setSyncSuccess(
                    data.message || 'Fork synced successfully! Vercel is now building and deploying the latest updates.'
                );
                // Re-check after 4 seconds to see updated commit comparison
                setTimeout(() => {
                    checkStatus();
                }, 4000);
            } else {
                setSyncError(data.error || 'Failed to sync fork with upstream.');
            }
        } catch (err: any) {
            setSyncError(String(err.message || err));
        } finally {
            setSyncing(false);
        }
    };

    // Only render if dismissed is false, and:
    // 1. Repo is a fork AND it is behind parent commit, OR
    // 2. A sync was just successfully triggered (to show deployment confirmation)
    if (dismissed) return null;
    if (!status?.isFork) return null;
    if (!status?.isBehind && !syncSuccess && !syncError) return null;

    const behindCount = status.behindBy || 1;

    return (
        <aside 
            aria-label="Repository update notification"
            className="w-full bg-linear-to-r from-blue-50 via-indigo-50/80 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/40 border-b border-blue-200/80 dark:border-blue-900/60 shadow-xs transition-all duration-300"
        >
            <div className="max-w-4xl mx-auto px-6 py-3">
                {syncSuccess ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                        <div className="flex items-start sm:items-center gap-2.5">
                            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5 sm:mt-0" />
                            <div>
                                <p className="font-semibold text-green-900 dark:text-green-200">
                                    Update Triggered & Redeploying! 🚀
                                </p>
                                <p className="text-xs text-green-800 dark:text-green-300 mt-0.5">
                                    {syncSuccess} Your site will reflect the new features in 1-2 minutes once Vercel finishes building.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDismissed(true)}
                            className="text-xs text-green-800 hover:text-green-900 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-950/50 self-end sm:self-auto h-8 px-3"
                        >
                            Dismiss
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                        <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                                <GitFork className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                                        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                        Upstream Update Available
                                    </span>
                                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                                        {behindCount} {behindCount === 1 ? 'commit' : 'commits'} behind
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                                    The developer pushed new updates to <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200">{status.parentRepo}</span>. Sync your fork to update your website and trigger an automatic Vercel redeployment.
                                </p>
                                {syncError && (
                                    <div className="flex items-center gap-1.5 mt-2 text-xs text-red-700 dark:text-red-400 font-medium bg-red-100/70 dark:bg-red-950/50 p-2 rounded border border-red-200 dark:border-red-900">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        <span>{syncError}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {status.compareUrl && (
                                <a
                                    href={status.compareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 inline-flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                                    title="View changes on GitHub"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">View Changes</span>
                                </a>
                            )}

                            <Button
                                onClick={handleSync}
                                disabled={syncing}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm gap-1.5 text-xs h-8 px-3.5 cursor-pointer"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                                {syncing ? 'Syncing Fork...' : 'Sync Fork & Update Website'}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

