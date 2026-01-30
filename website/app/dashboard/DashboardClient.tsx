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
                                        ) : (
                                            <>
                                                <p className="flex-1 text-sm">{idea}</p>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => startEditing(index, idea)}
                                                    disabled={ideasLoading || editingIndex !== null}
                                                    className="text-blue-600 hover:text-blue-700"
                                                    title="Edit idea"
                                                >
                                                    ✎
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeIdea(index)}
                                                    disabled={ideasLoading || editingIndex !== null}
                                                    className="text-red-600 hover:text-red-700"
                                                    title="Remove idea"
                                                >
                                                    ✕
                                                </Button>
                                            </>
                                        )}
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

