"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

type IdeasQueue = {
    ideas: string[];
    count: number;
};

export default function DashboardClient() {
    const [ideasQueue, setIdeasQueue] = useState<IdeasQueue | null>(null);
    const [newIdea, setNewIdea] = useState('');
    const [ideasLoading, setIdeasLoading] = useState(false);
    const [ideasError, setIdeasError] = useState<string | null>(null);

    const [shortsPublishTime, setShortsPublishTime] = useState<string>('16:30');
    const [shortsTimeLoading, setShortsTimeLoading] = useState(false);
    const [shortsTimeError, setShortsTimeError] = useState<string | null>(null);

    useEffect(() => {
        loadIdeasQueue();
        loadShortsPublishTime();
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

            <Card>
                <CardHeader>
                    <CardTitle>Shorts Publish Time (IST)</CardTitle>
                    <CardDescription>Set the default time for publishing YouTube Shorts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {shortsTimeError && (
                        <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                            {shortsTimeError}
                        </div>
                    )}

                    <div className="flex items-end gap-4">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="shorts-time">Time (24-hour format HH:MM)</Label>
                            <Input
                                id="shorts-time"
                                type="time"
                                value={shortsPublishTime}
                                onChange={e => setShortsPublishTime(e.target.value)}
                                disabled={shortsTimeLoading}
                            />
                        </div>
                        <Button
                            onClick={saveShortsPublishTime}
                            disabled={shortsTimeLoading}
                        >
                            {shortsTimeLoading ? 'Saving...' : 'Save'}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Current: {shortsPublishTime} IST (Indian Standard Time)
                    </p>
                </CardContent>
            </Card>

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
                                                disabled={index === 0 || ideasLoading}
                                                className="h-6 w-6 p-0"
                                                title="Move up"
                                            >
                                                ↑
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => moveIdea(index, 'down')}
                                                disabled={index === ideasQueue.ideas.length - 1 || ideasLoading}
                                                className="h-6 w-6 p-0"
                                                title="Move down"
                                            >
                                                ↓
                                            </Button>
                                        </div>
                                        <p className="flex-1 text-sm">{idea}</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeIdea(index)}
                                            disabled={ideasLoading}
                                            className="text-red-600 hover:text-red-700"
                                            title="Remove idea"
                                        >
                                            ✕
                                        </Button>
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

