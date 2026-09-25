import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    ActivityIndicator,
    Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomAlert, { CustomAlertConfig } from '../components/CustomAlert';
import SkeletonLoader from '../components/SkeletonLoader';
import {
    commentsApi,
    CommentReplySettings,
    ReplyHistoryEntry,
} from '../services/api';
import { colors, spacing, borderRadius, typography, shadows, gradients } from '../theme';

const TONES: Array<{ id: string; label: string }> = [
    { id: 'friendly', label: 'Friendly Peer' },
    { id: 'technical', label: 'Technical' },
    { id: 'humorous', label: 'Witty / Humorous' },
    { id: 'concise', label: 'Concise' },
    { id: 'enthusiastic', label: 'Enthusiastic' },
];

export default function CommentsScreen() {
    const [history, setHistory] = useState<ReplyHistoryEntry[]>([]);
    const [settings, setSettings] = useState<CommentReplySettings>({
        enabled: true,
        dryRun: false,
        maxRepliesPerRun: 10,
        tone: 'friendly',
        replyToQuestionsOnly: false,
        customInstructions: 'Prioritize questions with technical depth, maintain warm collegiate tone.',
    });

    const [stats, setStats] = useState({
        totalLiveReplies: 0,
        totalDryRunReplies: 0,
        totalFailed: 0,
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);
    const [filterTab, setFilterTab] = useState<'all' | 'live' | 'dry_run' | 'queue'>('all');
    const [tuneModalVisible, setTuneModalVisible] = useState(false);
    const [postingId, setPostingId] = useState<string | null>(null);

    // Edit and Delete state for comment replies
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<ReplyHistoryEntry | null>(null);
    const [editDraftText, setEditDraftText] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [postingLiveFromEdit, setPostingLiveFromEdit] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Custom Themed Alert Dialog State
    const [alertConfig, setAlertConfig] = useState<CustomAlertConfig>({
        visible: false,
        title: '',
        message: '',
    });

    // Form settings for modal
    const [formSettings, setFormSettings] = useState<CommentReplySettings>(settings);

    const deduplicateComments = useCallback((items: ReplyHistoryEntry[]): ReplyHistoryEntry[] => {
        const map = new Map<string, ReplyHistoryEntry>();
        for (const item of items) {
            const key = item.commentId && !item.commentId.startsWith('c-')
                ? `cid:${item.commentId}`
                : item.threadId && !item.threadId.startsWith('th-')
                ? `th:${item.threadId}`
                : `${(item.authorName || '').toLowerCase()}:${(item.commentText || '').trim().toLowerCase().slice(0, 60)}`;

            const existing = map.get(key);
            if (!existing) {
                map.set(key, item);
            } else {
                // 'posted' strictly overrides 'dry_run' or 'failed'
                if (item.status === 'posted' && existing.status !== 'posted') {
                    map.set(key, item);
                } else if (existing.status !== 'posted' && item.status !== 'posted') {
                    // Keep the newer one
                    const existingTime = new Date(existing.timestamp).getTime() || 0;
                    const itemTime = new Date(item.timestamp).getTime() || 0;
                    if (itemTime > existingTime) {
                        map.set(key, item);
                    }
                }
            }
        }
        return Array.from(map.values());
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const res = await commentsApi.getHistory(40);
            if (res.ok) {
                const rawList = res.history || [];
                const cleaned = deduplicateComments(rawList);
                setHistory(cleaned);

                if (res.settings) {
                    setSettings(res.settings);
                    setFormSettings(res.settings);
                }

                // Compute deduplicated stats
                setStats({
                    totalLiveReplies: cleaned.filter((h) => h.status === 'posted').length,
                    totalDryRunReplies: cleaned.filter((h) => h.status === 'dry_run').length,
                    totalFailed: cleaned.filter((h) => h.status === 'failed').length,
                });
            }
        } catch (err) {
            console.error('[Comments] Error fetching history:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [deduplicateComments]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleProcessNow = async () => {
        setProcessing(true);
        try {
            const res = await commentsApi.processNow({
                dryRun: settings.dryRun,
                maxReplies: settings.maxRepliesPerRun,
            });
            if (res.ok && res.result) {
                setAlertConfig({
                    visible: true,
                    title: 'Audit Finished',
                    message: `Comments Processed Successfully!\nLive Sent: ${res.result.repliesSent}\nSimulated: ${res.result.repliesDryRun}\nSkipped: ${res.result.repliesSkipped}`,
                    type: 'success',
                });
                fetchData();
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Process Status',
                    message: res.error || 'Comments checked. No new pending items found.',
                    type: 'warning',
                });
            }
        } catch (err: any) {
            setAlertConfig({
                visible: true,
                title: 'Process Error',
                message: err.message || String(err),
                type: 'danger',
            });
        } finally {
            setProcessing(false);
        }
    };

    const handleDispatchGitHub = async () => {
        setDispatching(true);
        try {
            const res = await commentsApi.dispatchGitHub({
                dryRun: settings.dryRun,
                maxReplies: settings.maxRepliesPerRun,
            });
            if (res.success) {
                setAlertConfig({
                    visible: true,
                    title: 'Agent Dispatched',
                    message: 'Cloud Agent dispatch triggered successfully!',
                    type: 'success',
                });
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Dispatch Notice',
                    message: res.error || 'Workflow trigger acknowledged by server.',
                    type: 'warning',
                });
            }
        } catch (err: any) {
            setAlertConfig({
                visible: true,
                title: 'Dispatch Error',
                message: err.message || String(err),
                type: 'danger',
            });
        } finally {
            setDispatching(false);
        }
    };

    const handleSaveTuneSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await commentsApi.updateSettings(formSettings);
            if (res.ok && res.settings) {
                setSettings(res.settings);
                setTuneModalVisible(false);
                setAlertConfig({
                    visible: true,
                    title: 'Rules Updated',
                    message: 'Comment rules & persona updated successfully!',
                    type: 'success',
                });
            } else {
                setSettings(formSettings);
                setTuneModalVisible(false);
                setAlertConfig({
                    visible: true,
                    title: 'Settings Applied',
                    message: 'Persona configurations applied locally.',
                    type: 'success',
                });
            }
        } catch (err: any) {
            setSettings(formSettings);
            setTuneModalVisible(false);
            setAlertConfig({
                visible: true,
                title: 'Settings Applied',
                message: 'Persona configurations applied locally.',
                type: 'success',
            });
        } finally {
            setSavingSettings(false);
        }
    };

    const handlePostLive = async (item: ReplyHistoryEntry) => {
        setPostingId(item.id);
        try {
            const res = await commentsApi.postLiveReply({
                threadId: item.threadId,
                commentId: item.commentId,
                replyText: item.replyText,
                historyId: item.id,
            });

            if (res.ok) {
                // Immediately update local state to reflect 'posted' and eliminate any duplicate dry run of the same comment
                const targetKey = item.commentId && !item.commentId.startsWith('c-')
                    ? `cid:${item.commentId}`
                    : item.threadId && !item.threadId.startsWith('th-')
                    ? `th:${item.threadId}`
                    : `${(item.authorName || '').toLowerCase()}:${(item.commentText || '').trim().toLowerCase().slice(0, 60)}`;

                setHistory(prev => {
                    const updated = prev.map(entry => {
                        const entryKey = entry.commentId && !entry.commentId.startsWith('c-')
                            ? `cid:${entry.commentId}`
                            : entry.threadId && !entry.threadId.startsWith('th-')
                            ? `th:${entry.threadId}`
                            : `${(entry.authorName || '').toLowerCase()}:${(entry.commentText || '').trim().toLowerCase().slice(0, 60)}`;

                        if (entry.id === item.id || entryKey === targetKey) {
                            return { ...entry, status: 'posted' as const };
                        }
                        return entry;
                    });
                    const cleaned = deduplicateComments(updated);

                    // Re-calculate stats from deduplicated list
                    setStats({
                        totalLiveReplies: cleaned.filter((h) => h.status === 'posted').length,
                        totalDryRunReplies: cleaned.filter((h) => h.status === 'dry_run').length,
                        totalFailed: cleaned.filter((h) => h.status === 'failed').length,
                    });

                    return cleaned;
                });

                setAlertConfig({
                    visible: true,
                    title: 'Posted Live',
                    message: `Live comment response successfully synchronized to YouTube for ${item.authorName}.`,
                    type: 'success',
                });
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Post Failed',
                    message: res.error || 'Failed to post live comment to YouTube.',
                    type: 'danger',
                });
            }
        } catch (err: any) {
            setAlertConfig({
                visible: true,
                title: 'Error',
                message: err.message || 'Network error occurred while posting comment.',
                type: 'danger',
            });
        } finally {
            setPostingId(null);
        }
    };

    const handleOpenEdit = (item: ReplyHistoryEntry) => {
        if (item.status === 'posted') return;
        setEditingItem(item);
        setEditDraftText(item.replyText || '');
        setEditModalVisible(true);
    };

    const handleSaveEdit = async () => {
        if (!editingItem) return;
        const trimmed = editDraftText.trim();
        if (!trimmed) {
            setAlertConfig({
                visible: true,
                title: 'Empty Reply',
                message: 'Reply text cannot be empty.',
                type: 'warning',
            });
            return;
        }

        setSavingEdit(true);
        try {
            // Update local state immediately
            setHistory((prev) =>
                prev.map((entry) =>
                    entry.id === editingItem.id ? { ...entry, replyText: trimmed } : entry
                )
            );

            const res = await commentsApi.updateReplyText(editingItem.id, trimmed);
            setEditModalVisible(false);
            if (res.ok) {
                setAlertConfig({
                    visible: true,
                    title: 'Reply Updated',
                    message: 'Comment reply updated successfully.',
                    type: 'success',
                });
            } else {
                setAlertConfig({
                    visible: true,
                    title: 'Saved Locally',
                    message: res.error || 'Reply updated locally in session.',
                    type: 'default',
                });
            }
        } catch (err: any) {
            setEditModalVisible(false);
            setAlertConfig({
                visible: true,
                title: 'Saved Locally',
                message: err.message || 'Updated in memory.',
                type: 'default',
            });
        } finally {
            setSavingEdit(false);
        }
    };

    const handleSaveAndPostLive = async () => {
        if (!editingItem) return;
        const trimmed = editDraftText.trim();
        if (!trimmed) {
            setAlertConfig({
                visible: true,
                title: 'Empty Reply',
                message: 'Reply text cannot be empty.',
                type: 'warning',
            });
            return;
        }

        setPostingLiveFromEdit(true);
        try {
            const updatedItem: ReplyHistoryEntry = { ...editingItem, replyText: trimmed };
            setHistory((prev) =>
                prev.map((entry) =>
                    entry.id === editingItem.id ? updatedItem : entry
                )
            );
            await commentsApi.updateReplyText(editingItem.id, trimmed).catch(() => {});
            setEditModalVisible(false);
            await handlePostLive(updatedItem);
        } finally {
            setPostingLiveFromEdit(false);
        }
    };

    const handleDeletePrompt = (item: ReplyHistoryEntry) => {
        setAlertConfig({
            visible: true,
            title: 'Delete Comment Entry',
            message: `Are you sure you want to remove the comment from "${item.authorName}" and its reply from the log?`,
            type: 'danger',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => confirmDelete(item),
                },
            ],
        });
    };

    const confirmDelete = async (item: ReplyHistoryEntry) => {
        setDeletingId(item.id);
        try {
            const targetKey = item.commentId && !item.commentId.startsWith('c-')
                ? `cid:${item.commentId}`
                : item.threadId && !item.threadId.startsWith('th-')
                ? `th:${item.threadId}`
                : `${(item.authorName || '').toLowerCase()}:${(item.commentText || '').trim().toLowerCase().slice(0, 60)}`;

            setHistory((prev) => {
                const remaining = prev.filter((entry) => {
                    const entryKey = entry.commentId && !entry.commentId.startsWith('c-')
                        ? `cid:${entry.commentId}`
                        : entry.threadId && !entry.threadId.startsWith('th-')
                        ? `th:${entry.threadId}`
                        : `${(entry.authorName || '').toLowerCase()}:${(entry.commentText || '').trim().toLowerCase().slice(0, 60)}`;
                    return entry.id !== item.id && entryKey !== targetKey;
                });

                setStats({
                    totalLiveReplies: remaining.filter((h) => h.status === 'posted').length,
                    totalDryRunReplies: remaining.filter((h) => h.status === 'dry_run').length,
                    totalFailed: remaining.filter((h) => h.status === 'failed').length,
                });

                return remaining;
            });

            await commentsApi.deleteHistoryItem(item.id);

            setAlertConfig({
                visible: true,
                title: 'Deleted',
                message: 'Comment item removed from activity history.',
                type: 'success',
            });
        } catch (err: any) {
            console.error('[Comments] Error deleting comment history item:', err);
        } finally {
            setDeletingId(null);
        }
    };

    const formatRelativeTime = (iso?: string) => {
        if (!iso) return 'recently';
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const displayedComments = history.filter((item) => {
        if (filterTab === 'all') return true;
        if (filterTab === 'live') return item.status === 'posted';
        if (filterTab === 'dry_run') return item.status === 'dry_run';
        if (filterTab === 'queue') return item.status === 'failed' || item.status === 'dry_run';
        return true;
    });

    const liveCount = history.filter((h) => h.status === 'posted').length;
    const dryRunCount = history.filter((h) => h.status === 'dry_run').length;

    if (loading && !refreshing) {
        return (
            <View style={styles.screen}>
                <SkeletonLoader variant="comments" />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.sandstone}
                    />
                }
            >
                {/* Header Title & Status */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.screenTitle}>Auto Comment Reply</Text>
                        <View style={styles.subTitleRow}>
                            <Ionicons name="sparkles" size={12} color={colors.sandstone} />
                            <Text style={styles.screenSubtitle}>Autonomous engagement by Gemini</Text>
                        </View>
                    </View>
                </View>

                {/* Metrics KPI Cards Ribbon */}
                <View style={styles.kpiRibbon}>
                    <View style={styles.kpiCard}>
                        <Text style={styles.kpiNumber}>{liveCount}</Text>
                        <View style={styles.kpiSubRow}>
                            <View style={[styles.kpiDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[styles.kpiLabel, { color: '#10B981' }]}>Live Sent</Text>
                        </View>
                    </View>

                    <View style={styles.kpiCard}>
                        <Text style={[styles.kpiNumber, { color: colors.sandstone }]}>{dryRunCount}</Text>
                        <View style={styles.kpiSubRow}>
                            <View style={[styles.kpiDot, { backgroundColor: colors.sandstone }]} />
                            <Text style={[styles.kpiLabel, { color: colors.sandstone }]}>Dry Run</Text>
                        </View>
                    </View>

                    <View style={styles.kpiCard}>
                        <Text style={[styles.kpiNumber, { color: colors.bone.muted }]}>{stats.totalFailed}</Text>
                        <View style={styles.kpiSubRow}>
                            <View style={[styles.kpiDot, { backgroundColor: colors.obsidian[700] }]} />
                            <Text style={[styles.kpiLabel, { color: colors.bone.muted }]}>Failed</Text>
                        </View>
                    </View>
                </View>

                {/* Primary Actions Trigger Bar */}
                <View style={styles.actionsBar}>
                    <TouchableOpacity
                        style={styles.processBtn}
                        onPress={handleProcessNow}
                        disabled={processing}
                    >
                        {processing ? (
                            <ActivityIndicator size="small" color={colors.obsidian[950]} />
                        ) : (
                            <>
                                <Ionicons name="play" size={14} color={colors.obsidian[950]} />
                                <Text style={styles.processBtnText}>Process Now</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.dispatchBtn}
                        onPress={handleDispatchGitHub}
                        disabled={dispatching}
                    >
                        {dispatching ? (
                            <ActivityIndicator size="small" color={colors.sandstone} />
                        ) : (
                            <>
                                <Ionicons name="send" size={13} color={colors.sandstone} />
                                <Text style={styles.dispatchBtnText}>Dispatch</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.tuneBtn}
                        onPress={() => setTuneModalVisible(true)}
                    >
                        <Ionicons name="options-outline" size={18} color={colors.sandstone} />
                    </TouchableOpacity>
                </View>

                {/* Persona Instruction Banner Widget */}
                <View style={styles.personaBanner}>
                    <View style={styles.personaBannerLeft}>
                        <View style={styles.botIconBox}>
                            <Ionicons name="hardware-chip-outline" size={15} color={colors.sandstone} />
                        </View>
                        <View style={styles.personaTextGroup}>
                            <Text style={styles.personaTitle}>
                                Active Persona: {settings.tone ? settings.tone.toUpperCase() : 'FRIENDLY PEER'}
                            </Text>
                            <Text style={styles.personaSubtitle}>
                                {settings.maxRepliesPerRun || 10} max replies/run • {settings.replyToQuestionsOnly ? 'Questions priority' : 'All commentary'}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.tunePill}
                        onPress={() => setTuneModalVisible(true)}
                    >
                        <Text style={styles.tunePillText}>Tune</Text>
                    </TouchableOpacity>
                </View>

                {/* Activity Stream Section Header & Segmented Tabs */}
                <View style={styles.streamHeader}>
                    <View style={styles.streamTitleRow}>
                        <Text style={styles.streamTitleText}>ACTIVITY LOG</Text>
                        <View style={styles.streamCountBadge}>
                            <Text style={styles.streamCountText}>{history.length}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onRefresh} style={styles.refreshIconBtn}>
                        <Ionicons name="reload" size={13} color={colors.bone.muted} />
                    </TouchableOpacity>
                </View>

                {/* Filter Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterTabsRow}>
                    <TouchableOpacity
                        style={[styles.filterTab, filterTab === 'all' && styles.filterTabActive]}
                        onPress={() => setFilterTab('all')}
                    >
                        <Text style={[styles.filterTabText, filterTab === 'all' && styles.filterTabTextActive]}>
                            All ({history.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterTab, filterTab === 'live' && styles.filterTabActive]}
                        onPress={() => setFilterTab('live')}
                    >
                        <Text style={[styles.filterTabText, filterTab === 'live' && styles.filterTabTextActive]}>
                            Live Posted ({liveCount})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterTab, filterTab === 'dry_run' && styles.filterTabActive]}
                        onPress={() => setFilterTab('dry_run')}
                    >
                        <Text style={[styles.filterTabText, filterTab === 'dry_run' && styles.filterTabTextActive]}>
                            Simulated / Dry ({dryRunCount})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterTab, filterTab === 'queue' && styles.filterTabActive]}
                        onPress={() => setFilterTab('queue')}
                    >
                        <Text style={[styles.filterTabText, filterTab === 'queue' && styles.filterTabTextActive]}>
                            Review Queue
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Comment Cards Stream */}
                <View style={styles.cardsList}>
                    {displayedComments.length === 0 ? (
                        <View style={styles.emptyStateBox}>
                            <Ionicons name="chatbubbles-outline" size={38} color={colors.sandstone} />
                            <Text style={styles.emptyStateTitle}>No Comments Yet</Text>
                            <Text style={styles.emptyStateSubtitle}>
                                {filterTab === 'all'
                                    ? 'When viewers comment on your YouTube videos, automated replies and review drafts will appear here.'
                                    : `No comments found in the "${filterTab.toUpperCase()}" view.`}
                            </Text>
                        </View>
                    ) : (
                        displayedComments.map((item) => {
                        const isLive = item.status === 'posted';
                        return (
                            <View key={item.id} style={styles.commentCard}>
                                {/* Top info: author, status tag, timestamp */}
                                <View style={styles.cardHeader}>
                                    <View style={styles.authorRow}>
                                        <View style={styles.authorAvatar}>
                                            <Ionicons name="person" size={11} color={colors.sandstone} />
                                        </View>
                                        <Text style={styles.authorName}>{item.authorName}</Text>
                                    </View>

                                    <View style={styles.tagTimeRow}>
                                        <View style={[styles.statusTag, isLive ? styles.tagLive : styles.tagDry]}>
                                            <Text style={[styles.statusTagText, isLive ? styles.tagTextLive : styles.tagTextDry]}>
                                                {isLive ? 'Live' : 'Simulated'}
                                            </Text>
                                        </View>
                                        <Text style={styles.timeAgoText}>{formatRelativeTime(item.timestamp)}</Text>
                                    </View>
                                </View>

                                {/* Video Target Pill */}
                                <View style={styles.videoTargetPill}>
                                    <Ionicons name="videocam-outline" size={12} color={colors.sandstone} />
                                    <Text style={styles.videoTargetText} numberOfLines={1}>
                                        {item.videoTitle || 'Active YouTube Premiere'}
                                    </Text>
                                </View>

                                {/* User's Original Comment */}
                                <View style={[styles.quoteBox, isLive ? styles.quoteBoxLive : styles.quoteBoxDry]}>
                                    <Text style={styles.quoteText}>“{item.commentText}”</Text>
                                </View>

                                {/* AI Reply Block */}
                                <View style={styles.aiReplyBlock}>
                                    <View style={styles.aiReplyHeader}>
                                        <View style={styles.aiReplyLabelGroup}>
                                            <Ionicons
                                                name="sparkles"
                                                size={12}
                                                color={isLive ? colors.sandstone : colors.sandstoneDark}
                                            />
                                            <Text style={styles.aiReplyLabel}>
                                                AI Reply ({item.category || 'adaptive'})
                                            </Text>
                                        </View>
                                        <View style={styles.sentimentBadge}>
                                            <Text style={styles.sentimentText}>
                                                {item.sentiment || 'ENGAGEMENT'}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={styles.replyContentText}>{item.replyText}</Text>

                                    {/* Footer micro actions */}
                                    <View style={styles.replyFooter}>
                                        {isLive ? (
                                            <View style={styles.syncStatusRow}>
                                                <Ionicons name="checkmark-done" size={13} color="#10B981" />
                                                <Text style={styles.syncStatusText}>Synchronized</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity
                                                style={[styles.postLiveBtn, postingId === item.id && { opacity: 0.6 }]}
                                                onPress={() => handlePostLive(item)}
                                                disabled={postingId === item.id}
                                                activeOpacity={0.7}
                                            >
                                                {postingId === item.id ? (
                                                    <ActivityIndicator size="small" color={colors.obsidian[950]} style={{ transform: [{ scale: 0.7 }] }} />
                                                ) : (
                                                    <Ionicons name="checkmark" size={11} color={colors.obsidian[950]} />
                                                )}
                                                <Text style={styles.postLiveBtnText}>
                                                    {postingId === item.id ? 'Posting...' : 'Post Live'}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        <View style={styles.cardActionsGroup}>
                                            {!isLive && (
                                                <TouchableOpacity
                                                    onPress={() => handleOpenEdit(item)}
                                                    style={styles.cardActionBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="pencil-outline" size={11} color={colors.sandstone} />
                                                    <Text style={styles.cardActionBtnText}>Edit</Text>
                                                </TouchableOpacity>
                                            )}

                                            <TouchableOpacity
                                                onPress={() => handleDeletePrompt(item)}
                                                style={[styles.cardActionBtn, styles.cardDeleteBtn]}
                                                activeOpacity={0.7}
                                                disabled={deletingId === item.id}
                                            >
                                                {deletingId === item.id ? (
                                                    <ActivityIndicator size="small" color="#EF4444" style={{ transform: [{ scale: 0.6 }] }} />
                                                ) : (
                                                    <Ionicons name="trash-outline" size={11} color="#EF4444" />
                                                )}
                                                <Text style={[styles.cardActionBtnText, styles.cardDeleteBtnText]}>Delete</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => Share.share({ message: item.replyText })}
                                                style={styles.shareIconBtn}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="share-outline" size={13} color={colors.bone.muted} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        );
                    }))}
                </View>
            </ScrollView>

            {/* Persona Tuning Modal Sheet */}
            <Modal
                visible={tuneModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setTuneModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity
                        style={styles.modalDismissArea}
                        activeOpacity={1}
                        onPress={() => setTuneModalVisible(false)}
                    />
                    <View style={styles.tuneSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeaderRow}>
                            <View>
                                <Text style={styles.sheetKicker}>AUTONOMOUS RULES</Text>
                                <Text style={styles.sheetTitle}>Audience Engagement Persona</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.sheetCloseBtn}
                                onPress={() => setTuneModalVisible(false)}
                            >
                                <Ionicons name="close" size={18} color={colors.bone.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                            {/* Execution Mode */}
                            <Text style={styles.settingLabel}>REPLY EXECUTION MODE</Text>
                            <View style={styles.toggleRow}>
                                <TouchableOpacity
                                    style={[styles.toggleBtn, !formSettings.dryRun && styles.toggleBtnActive]}
                                    onPress={() => setFormSettings({ ...formSettings, dryRun: false })}
                                >
                                    <Ionicons
                                        name="radio-button-on"
                                        size={14}
                                        color={!formSettings.dryRun ? colors.sandstone : colors.bone.muted}
                                    />
                                    <Text style={[styles.toggleBtnText, !formSettings.dryRun && styles.toggleBtnTextActive]}>
                                        Live YouTube Reply
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.toggleBtn, formSettings.dryRun && styles.toggleBtnActive]}
                                    onPress={() => setFormSettings({ ...formSettings, dryRun: true })}
                                >
                                    <Ionicons
                                        name="flask-outline"
                                        size={14}
                                        color={formSettings.dryRun ? colors.sandstone : colors.bone.muted}
                                    />
                                    <Text style={[styles.toggleBtnText, formSettings.dryRun && styles.toggleBtnTextActive]}>
                                        Dry Run (Simulate)
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Max replies stepper */}
                            <Text style={styles.settingLabel}>MAX REPLIES PER RUN: {formSettings.maxRepliesPerRun || 10}</Text>
                            <View style={styles.stepperControl}>
                                <TouchableOpacity
                                    style={styles.stepperSubBtn}
                                    onPress={() =>
                                        setFormSettings({
                                            ...formSettings,
                                            maxRepliesPerRun: Math.max(1, (formSettings.maxRepliesPerRun || 10) - 2),
                                        })
                                    }
                                >
                                    <Ionicons name="remove" size={16} color={colors.sandstone} />
                                </TouchableOpacity>
                                <Text style={styles.stepperNumber}>{formSettings.maxRepliesPerRun || 10}</Text>
                                <TouchableOpacity
                                    style={styles.stepperSubBtn}
                                    onPress={() =>
                                        setFormSettings({
                                            ...formSettings,
                                            maxRepliesPerRun: Math.min(30, (formSettings.maxRepliesPerRun || 10) + 2),
                                        })
                                    }
                                >
                                    <Ionicons name="add" size={16} color={colors.sandstone} />
                                </TouchableOpacity>
                            </View>

                            {/* Tone selection */}
                            <Text style={styles.settingLabel}>PERSONA TONE</Text>
                            <View style={styles.toneGrid}>
                                {TONES.map((t) => {
                                    const isSelected = formSettings.tone === t.id;
                                    return (
                                        <TouchableOpacity
                                            key={t.id}
                                            style={[styles.tonePill, isSelected && styles.tonePillActive]}
                                            onPress={() => setFormSettings({ ...formSettings, tone: t.id as any })}
                                        >
                                            <Text style={[styles.tonePillText, isSelected && styles.tonePillTextActive]}>
                                                {t.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* Question priority switch */}
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                activeOpacity={0.8}
                                onPress={() =>
                                    setFormSettings({
                                        ...formSettings,
                                        replyToQuestionsOnly: !formSettings.replyToQuestionsOnly,
                                    })
                                }
                            >
                                <View style={[styles.checkboxBox, formSettings.replyToQuestionsOnly && styles.checkboxBoxActive]}>
                                    {formSettings.replyToQuestionsOnly && (
                                        <Ionicons name="checkmark" size={12} color={colors.obsidian[950]} />
                                    )}
                                </View>
                                <Text style={styles.checkboxLabel}>Prioritize direct questions and technical inquiries</Text>
                            </TouchableOpacity>

                            {/* Custom prompt instructions */}
                            <Text style={styles.settingLabel}>SYSTEM INSTRUCTIONS / CONTEXT</Text>
                            <TextInput
                                style={styles.textInputArea}
                                placeholder="E.g. Avoid mentioning pricing, emphasize high FPS Rust benchmarks..."
                                placeholderTextColor={colors.bone.subtle}
                                multiline
                                numberOfLines={3}
                                value={formSettings.customInstructions}
                                onChangeText={(val) => setFormSettings({ ...formSettings, customInstructions: val })}
                            />

                            <TouchableOpacity
                                style={styles.saveTuneBtn}
                                onPress={handleSaveTuneSettings}
                                disabled={savingSettings}
                            >
                                {savingSettings ? (
                                    <ActivityIndicator size="small" color={colors.obsidian[950]} />
                                ) : (
                                    <Text style={styles.saveTuneBtnText}>Save Rules & Persona</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Edit Comment Reply Modal Sheet */}
            <Modal
                visible={editModalVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity
                        style={styles.modalDismissArea}
                        activeOpacity={1}
                        onPress={() => setEditModalVisible(false)}
                    />
                    <View style={styles.editSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeaderRow}>
                            <View>
                                <Text style={styles.sheetKicker}>EDIT DRAFT REPLY</Text>
                                <Text style={styles.sheetTitle}>Customized YouTube Response</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.sheetCloseBtn}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Ionicons name="close" size={18} color={colors.bone.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                            {/* Original Comment Quote Box */}
                            {editingItem && (
                                <View style={styles.editContextBox}>
                                    <View style={styles.editContextAuthorRow}>
                                        <Ionicons name="person-circle-outline" size={14} color={colors.sandstone} />
                                        <Text style={styles.editContextAuthor}>{editingItem.authorName || 'Viewer'}</Text>
                                        <Text style={styles.editContextVideo} numberOfLines={1}>
                                            • {editingItem.videoTitle || 'YouTube Premiere'}
                                        </Text>
                                    </View>
                                    <Text style={styles.editContextQuote}>
                                        “{editingItem.commentText}”
                                    </Text>
                                </View>
                            )}

                            {/* Reply Text Input Area */}
                            <Text style={styles.settingLabel}>REPLY MESSAGE</Text>
                            <TextInput
                                style={styles.editTextInputArea}
                                placeholder="Type or refine the response to post..."
                                placeholderTextColor={colors.bone.subtle}
                                multiline
                                numberOfLines={5}
                                value={editDraftText}
                                onChangeText={setEditDraftText}
                                textAlignVertical="top"
                            />

                            <View style={styles.editModalButtonsRow}>
                                <TouchableOpacity
                                    style={styles.cancelEditBtn}
                                    onPress={() => setEditModalVisible(false)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelEditBtnText}>Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.saveEditBtn}
                                    onPress={handleSaveEdit}
                                    disabled={savingEdit || postingLiveFromEdit}
                                    activeOpacity={0.7}
                                >
                                    {savingEdit ? (
                                        <ActivityIndicator size="small" color={colors.obsidian[950]} />
                                    ) : (
                                        <>
                                            <Ionicons name="save-outline" size={13} color={colors.obsidian[950]} />
                                            <Text style={styles.saveEditBtnText}>Save</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {editingItem && editingItem.status !== 'posted' && (
                                    <TouchableOpacity
                                        style={styles.saveAndPostBtn}
                                        onPress={handleSaveAndPostLive}
                                        disabled={savingEdit || postingLiveFromEdit}
                                        activeOpacity={0.7}
                                    >
                                        {postingLiveFromEdit ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <Ionicons name="send" size={12} color="#FFFFFF" />
                                                <Text style={styles.saveAndPostBtnText}>Save & Post Live</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ─── Themed Custom Alert Dialog ─── */}
            <CustomAlert
                {...alertConfig}
                onClose={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.obsidian[950],
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: 120,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    screenTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.4,
    },
    subTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 3,
    },
    screenSubtitle: {
        fontSize: 11,
        color: colors.bone.muted,
    },
    kpiRibbon: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: spacing.md,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    kpiNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.5,
    },
    kpiSubRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 3,
    },
    kpiDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    kpiLabel: {
        fontSize: 10,
        fontWeight: '700',
    },
    actionsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: spacing.md,
    },
    processBtn: {
        flex: 1,
        backgroundColor: colors.sandstone,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: borderRadius.md,
        shadowColor: colors.sandstone,
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    processBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    dispatchBtn: {
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: borderRadius.md,
    },
    dispatchBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    tuneBtn: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    personaBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        padding: 12,
        marginBottom: spacing.md,
    },
    personaBannerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
    },
    botIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(200, 178, 155, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    personaTextGroup: {
        flex: 1,
    },
    personaTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    personaSubtitle: {
        fontSize: 10,
        color: colors.bone.muted,
        marginTop: 1,
    },
    tunePill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 6,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.3)',
    },
    tunePillText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.sandstone,
    },
    streamHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    streamTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    streamTitleText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.bone.subtle,
        letterSpacing: 1,
    },
    streamCountBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 10,
        backgroundColor: colors.obsidian[800],
    },
    streamCountText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.sandstone,
    },
    refreshIconBtn: {
        padding: 4,
    },
    filterTabsRow: {
        flexDirection: 'row',
        marginBottom: spacing.md,
    },
    filterTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        marginRight: 8,
    },
    filterTabActive: {
        backgroundColor: colors.sandstone,
        borderColor: colors.sandstone,
    },
    filterTabText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    filterTabTextActive: {
        color: colors.obsidian[950],
        fontWeight: '800',
    },
    cardsList: {
        gap: 12,
    },
    commentCard: {
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.lg,
        padding: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    authorAvatar: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    authorName: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    tagTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusTag: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1,
    },
    tagLive: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    tagDry: {
        backgroundColor: 'rgba(200, 178, 155, 0.15)',
        borderColor: 'rgba(200, 178, 155, 0.35)',
    },
    statusTagText: {
        fontSize: 9,
        fontWeight: '800',
    },
    tagTextLive: {
        color: '#10B981',
    },
    tagTextDry: {
        color: colors.sandstone,
    },
    timeAgoText: {
        fontSize: 10,
        color: colors.bone.subtle,
    },
    videoTargetPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.obsidian[950],
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 6,
        marginBottom: 8,
    },
    videoTargetText: {
        fontSize: 10,
        color: colors.bone.muted,
        flex: 1,
    },
    quoteBox: {
        borderRadius: 8,
        padding: 10,
        marginBottom: 8,
        backgroundColor: colors.obsidian[950],
        borderLeftWidth: 2,
    },
    quoteBoxLive: {
        borderLeftColor: colors.sandstone,
    },
    quoteBoxDry: {
        borderLeftColor: colors.sandstoneDark,
    },
    quoteText: {
        fontSize: 11,
        fontStyle: 'italic',
        color: colors.bone.DEFAULT,
        lineHeight: 16,
    },
    aiReplyBlock: {
        backgroundColor: colors.obsidian[850],
        borderWidth: 1,
        borderColor: colors.obsidian[750] || colors.obsidian[800],
        borderRadius: 10,
        padding: 10,
    },
    aiReplyHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    aiReplyLabelGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    aiReplyLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.sandstoneLight,
    },
    sentimentBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    sentimentText: {
        fontSize: 8,
        fontWeight: '700',
        color: colors.bone.muted,
        textTransform: 'uppercase',
    },
    replyContentText: {
        fontSize: 11,
        color: colors.bone.DEFAULT,
        lineHeight: 16,
        marginBottom: 8,
    },
    replyFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 6,
        borderTopWidth: 1,
        borderTopColor: colors.obsidian[800],
    },
    syncStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    syncStatusText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#10B981',
    },
    postLiveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: colors.sandstone,
    },
    postLiveBtnText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    cardActionsGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: colors.obsidian[700],
    },
    cardActionBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    cardDeleteBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: 'rgba(239, 68, 68, 0.25)',
    },
    cardDeleteBtnText: {
        color: '#EF4444',
    },
    shareIconBtn: {
        padding: 4,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    modalDismissArea: {
        flex: 1,
    },
    editSheet: {
        backgroundColor: colors.obsidian[900],
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.obsidian[700],
        padding: spacing.lg,
        maxHeight: '85%',
    },
    editContextBox: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        padding: 10,
        marginBottom: 12,
    },
    editContextAuthorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    editContextAuthor: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.sandstone,
    },
    editContextVideo: {
        fontSize: 10,
        color: colors.bone.muted,
        flex: 1,
    },
    editContextQuote: {
        fontSize: 12,
        fontStyle: 'italic',
        color: colors.bone.DEFAULT,
        lineHeight: 16,
    },
    editTextInputArea: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        color: colors.bone.DEFAULT,
        fontSize: 12,
        padding: 10,
        minHeight: 110,
        marginBottom: 16,
    },
    editModalButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    cancelEditBtn: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: borderRadius.md,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: colors.obsidian[700],
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelEditBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.muted,
    },
    saveEditBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        backgroundColor: colors.sandstone,
    },
    saveEditBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    saveAndPostBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        backgroundColor: '#10B981',
    },
    saveAndPostBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    tuneSheet: {
        backgroundColor: colors.obsidian[900],
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.obsidian[700],
        padding: spacing.lg,
        maxHeight: '85%',
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.obsidian[700],
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    sheetHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    sheetKicker: {
        fontSize: 9,
        fontWeight: '800',
        color: colors.sandstone,
        letterSpacing: 1,
    },
    sheetTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
    },
    sheetCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalScroll: {
        marginBottom: 10,
    },
    settingLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.bone.subtle,
        letterSpacing: 0.8,
        marginTop: 12,
        marginBottom: 6,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 8,
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: colors.obsidian[700],
    },
    toggleBtnActive: {
        borderColor: colors.sandstone,
        backgroundColor: colors.obsidian[850],
    },
    toggleBtnText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    toggleBtnTextActive: {
        color: colors.bone.DEFAULT,
        fontWeight: '700',
    },
    stepperControl: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    stepperSubBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperNumber: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
    },
    toneGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tonePill: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: colors.obsidian[700],
    },
    tonePillActive: {
        backgroundColor: colors.obsidian[700],
        borderColor: colors.sandstone,
    },
    tonePillText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    tonePillTextActive: {
        color: colors.bone.DEFAULT,
        fontWeight: '800',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 14,
        paddingVertical: 4,
    },
    checkboxBox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: colors.obsidian[700],
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxBoxActive: {
        backgroundColor: colors.sandstone,
        borderColor: colors.sandstone,
    },
    checkboxLabel: {
        fontSize: 11,
        color: colors.bone.DEFAULT,
        flex: 1,
    },
    textInputArea: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        padding: 10,
        color: colors.bone.DEFAULT,
        fontSize: 12,
        minHeight: 65,
        textAlignVertical: 'top',
    },
    saveTuneBtn: {
        backgroundColor: colors.sandstone,
        borderRadius: borderRadius.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    saveTuneBtnText: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.obsidian[900],
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        gap: 8,
    },
    emptyStateTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
        marginTop: 6,
    },
    emptyStateSubtitle: {
        fontSize: 12,
        color: colors.bone.muted,
        textAlign: 'center',
        lineHeight: 18,
    },
});
