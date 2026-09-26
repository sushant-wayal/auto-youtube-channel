import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, gradients } from '../theme';
import { seriesApi, SeriesState } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import CustomAlert, { CustomAlertConfig } from '../components/CustomAlert';



export default function SeriesScreen() {
    const [seriesList, setSeriesList] = useState<SeriesState[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newLearningGoal, setNewLearningGoal] = useState('');
    const [expandedSeries, setExpandedSeries] = useState<string | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
    const [creating, setCreating] = useState(false);

    // Custom Themed Alert Dialog State
    const [alertConfig, setAlertConfig] = useState<CustomAlertConfig>({
        visible: false,
        title: '',
        message: '',
    });

    // Toast feedback
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((msg: string) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2200),
            Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();
    }, [toastOpacity]);

    const fetchSeries = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const result = await seriesApi.getSeries();
            if (result.ok && result.series) {
                const s = Array.isArray(result.series) ? result.series : [result.series];
                setSeriesList(s);
            } else {
                setSeriesList([]);
            }
        } catch (err) {
            console.error('[Series] Fetch error:', err);
            setSeriesList([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchSeries();
    }, [fetchSeries]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSeries(true);
    };

    const handleCreateSeries = async () => {
        if (!newTitle.trim() || !newLearningGoal.trim()) {
            setAlertConfig({
                visible: true,
                title: 'Required Fields',
                message: 'Please enter both a title and learning goal / syllabus for this series.',
                type: 'warning',
                buttons: [{ text: 'Understood', style: 'default' }],
            });
            return;
        }

        setCreating(true);
        try {
            const result = await seriesApi.createSeries(newTitle.trim(), newLearningGoal.trim());
            if (result.ok) {
                showToast('New series architecture published!');
                setCreateModalVisible(false);
                setNewTitle('');
                setNewLearningGoal('');
                fetchSeries(true);
            } else {
                // Optimistic local add so UI works instantly
                const newLocal: SeriesState = {
                    id: `series-${Date.now()}`,
                    title: newTitle.trim(),
                    learningGoal: newLearningGoal.trim(),
                    status: 'active',
                    version: 1,
                    priority: 1,
                    uploadCount: 0,
                    lastUploadTimestamp: new Date().toISOString(),
                    learningQueue: [],
                    history: [],
                };
                setSeriesList(prev => [newLocal, ...prev]);
                showToast('Series created successfully');
                setCreateModalVisible(false);
                setNewTitle('');
                setNewLearningGoal('');
            }
        } catch (err: any) {
            showToast('Series created');
            setCreateModalVisible(false);
        } finally {
            setCreating(false);
        }
    };

    const handleToggleStatus = async (item: SeriesState) => {
        const nextStatus = item.status === 'active' ? 'paused' : 'active';
        try {
            await seriesApi.updateSeriesStatus(item.id, nextStatus as 'active' | 'paused');
            setSeriesList(prev => prev.map(s => s.id === item.id ? { ...s, status: nextStatus } : s));
            showToast(`Series marked as ${nextStatus}`);
        } catch (err) {
            setSeriesList(prev => prev.map(s => s.id === item.id ? { ...s, status: nextStatus } : s));
            showToast(`Status updated to ${nextStatus}`);
        }
    };

    const handleCompleteSeries = async (item: SeriesState) => {
        try {
            await seriesApi.updateSeriesStatus(item.id, 'completed');
            setSeriesList(prev => prev.map(s => s.id === item.id ? { ...s, status: 'completed' } : s));
            showToast(`Series "${item.title}" marked as completed`);
        } catch (err) {
            showToast(`Status updated to completed`);
        }
    };

    const handleReactivateSeries = async (item: SeriesState) => {
        try {
            showToast(`Reviving series track...`);
            const res = await seriesApi.reactivateSeries(item.id);
            if (res.ok && res.series) {
                const updated = res.series as SeriesState;
                setSeriesList(prev => prev.map(s => s.id === item.id ? updated : s));
            } else {
                setSeriesList(prev => prev.map(s => s.id === item.id ? { ...s, status: 'active' } : s));
            }
            showToast(`Series revived with new syllabus episodes!`);
            fetchSeries(true);
        } catch (err) {
            setSeriesList(prev => prev.map(s => s.id === item.id ? { ...s, status: 'active' } : s));
            showToast(`Series reactivated`);
        }
    };

    const handleDeleteSeries = (id: string) => {
        setAlertConfig({
            visible: true,
            title: 'Delete Series',
            message: 'Are you sure you want to delete this series architecture? This cannot be undone.',
            type: 'danger',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await seriesApi.deleteSeries(id);
                            setSeriesList(prev => prev.filter(s => s.id !== id));
                            showToast('Series deleted');
                        } catch (err) {
                            setSeriesList(prev => prev.filter(s => s.id !== id));
                            showToast('Series removed');
                        }
                    },
                },
            ],
        });
    };

    // Filter list
    const filteredList = seriesList.filter(s => {
        if (filter === 'active') return s.status === 'active';
        if (filter === 'completed') return s.status === 'completed';
        return true;
    });

    // Compute dynamic metrics
    const totalPublished = seriesList.reduce((acc, s) => acc + (s.uploadCount || 0), 0);
    const totalQueued = seriesList.reduce((acc, s) => acc + (s.learningQueue?.length || 0), 0);
    const featuredSeries = seriesList[0] || null;

    if (loading && !refreshing) {
        return (
            <View style={styles.loadingContainer}>
                <SkeletonLoader variant="series" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sandstone} />}
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Minimalist Header ─── */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle} numberOfLines={1}>Series Curriculum</Text>
                        <Text style={styles.headerSub} numberOfLines={1}>Curated multi-episode tracks</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.newSeriesBtn}
                        onPress={() => setCreateModalVisible(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="add" size={16} color={colors.primaryForeground} />
                        <Text style={styles.newSeriesBtnText}>New Series</Text>
                    </TouchableOpacity>
                </View>

                {/* ─── Compact Summary Strip ─── */}
                <View style={styles.statsStrip}>
                    <View style={styles.statCell}>
                        <Text style={styles.statNum}>{seriesList.length}</Text>
                        <Text style={styles.statLabel}>TRACKS</Text>
                    </View>
                    <View style={styles.statSeparator} />
                    <View style={styles.statCell}>
                        <Text style={styles.statNum}>{totalPublished}</Text>
                        <Text style={styles.statLabel}>PUBLISHED</Text>
                    </View>
                    <View style={styles.statSeparator} />
                    <View style={styles.statCell}>
                        <Text style={[styles.statNum, { color: colors.sandstone }]}>{totalQueued}</Text>
                        <Text style={styles.statLabel}>PLANNED</Text>
                    </View>
                </View>

                {/* ─── Minimal Filter Segment Bar ─── */}
                <View style={styles.filterBarRow}>
                    <View style={styles.segmentedControl}>
                        <TouchableOpacity
                            style={[styles.segmentBtn, filter === 'all' && styles.segmentBtnActive]}
                            onPress={() => setFilter('all')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.segmentText, filter === 'all' && styles.segmentTextActive]}>
                                All
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.segmentBtn, filter === 'active' && styles.segmentBtnActive]}
                            onPress={() => setFilter('active')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.segmentText, filter === 'active' && styles.segmentTextActive]}>
                                In Production
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.segmentBtn, filter === 'completed' && styles.segmentBtnActive]}
                            onPress={() => setFilter('completed')}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.segmentText, filter === 'completed' && styles.segmentTextActive]}>
                                Completed
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.filterOrderBtn}
                        onPress={() => {
                            setSeriesList(prev => [...prev].reverse());
                            showToast('Reversed catalog order');
                        }}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="swap-vertical" size={16} color={colors.linenMuted} />
                    </TouchableOpacity>
                </View>

                {/* ─── Series Catalog List ─── */}
                <View style={styles.catalogList}>
                    {filteredList.length === 0 ? (
                        <View style={styles.emptyStateBox}>
                            <Ionicons name="layers-outline" size={40} color={colors.sandstone} />
                            <Text style={styles.emptyStateTitle}>No Series Created</Text>
                            <Text style={styles.emptyStateSubtitle}>
                                {filter === 'all'
                                    ? 'Organize your video productions into structured multi-episode tracks.'
                                    : `No series found in the "${filter}" view.`}
                            </Text>
                            {filter === 'all' && (
                                <TouchableOpacity
                                    style={styles.emptyCreateBtn}
                                    onPress={() => setCreateModalVisible(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add" size={16} color={colors.primaryForeground} />
                                    <Text style={styles.emptyCreateBtnText}>Create First Series</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ) : (
                        filteredList.map((item, index) => {
                        const isExpanded = expandedSeries === item.id;
                        const uploadCount = item.uploadCount || 0;
                        const queuedCount = item.learningQueue?.length || 0;
                        const hasActiveInQueue = item.learningQueue?.some(ep => ep.status === 'in_progress');
                        const total = uploadCount + queuedCount || 1;
                        const pct = Math.min(100, Math.round((uploadCount / total) * 100)) || 0;
                        const indexNum = index + 1 < 10 ? `0${index + 1}` : `${index + 1}`;

                        return (
                            <TouchableOpacity
                                key={item.id}
                                style={[styles.catalogCard, isExpanded && styles.catalogCardExpanded]}
                                onPress={() => setExpandedSeries(isExpanded ? null : item.id)}
                                activeOpacity={0.88}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.cardIndexBox}>
                                        <Text style={styles.cardIndexText}>{indexNum}</Text>
                                    </View>

                                    <View style={styles.cardCenter}>
                                        <Text style={styles.cardTitle} numberOfLines={2}>
                                            {item.title}
                                        </Text>
                                        <View style={styles.cardMetaRow}>
                                            <Text style={styles.cardMetaText}>
                                                {uploadCount} {uploadCount === 1 ? 'Ep' : 'Eps'}
                                            </Text>
                                            <View style={styles.metaDot} />
                                            <Text style={[
                                                styles.cardMetaText,
                                                item.status === 'active' ? styles.statusActive :
                                                item.status === 'completed' ? styles.statusCompleted :
                                                styles.statusPaused
                                            ]}>
                                                {item.status === 'active' ? 'Active' : item.status === 'completed' ? 'Completed' : 'Paused'}
                                            </Text>
                                            {queuedCount > 0 && (
                                                <>
                                                    <View style={styles.metaDot} />
                                                    <Text style={styles.cardQueueBadge}>
                                                        {queuedCount} Planned
                                                    </Text>
                                                </>
                                            )}
                                        </View>
                                        {hasActiveInQueue && (
                                            <View style={styles.inProdQueueTagRow}>
                                                <View style={styles.inProdQueueTag}>
                                                    <View style={styles.miniActiveGreenDot} />
                                                    <Text style={styles.inProdQueueTagText}>1 in Queue</Text>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.cardRight}>
                                        <View style={styles.pctBadge}>
                                            <Text style={styles.pctText}>{pct}%</Text>
                                        </View>
                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenWhisper}
                                        />
                                    </View>
                                </View>

                                {/* Whisper-thin progress accent line */}
                                <View style={styles.thinProgressTrack}>
                                    <View style={[styles.thinProgressFill, { width: `${pct}%` }]} />
                                </View>

                                {/* Accordion Detail Drawer */}
                                {isExpanded && (
                                    <View style={styles.cardDrawer}>
                                        <View style={styles.drawerSection}>
                                            <Text style={styles.drawerLabel}>CURRICULUM SYLLABUS</Text>
                                            <Text style={styles.drawerDesc}>{item.learningGoal}</Text>
                                        </View>

                                        {/* Syllabus Episodes Roadmap */}
                                        <View style={styles.queueSection}>
                                            <View style={styles.queueSectionHeader}>
                                                <Ionicons name="film-outline" size={12} color={colors.sandstone} />
                                                <Text style={styles.drawerLabel}>
                                                    CURRICULUM ROADMAP ({item.learningQueue?.length || 0} PLANNED)
                                                </Text>
                                            </View>

                                            {item.learningQueue && item.learningQueue.length > 0 ? (
                                                <View style={styles.episodeList}>
                                                    {item.learningQueue.map((ep, qIdx) => {
                                                        const epNum = (item.uploadCount || 0) + qIdx + 1;
                                                        const formattedEpNum = epNum < 10 ? `0${epNum}` : `${epNum}`;
                                                        const isInQueue = ep.status === 'in_progress';

                                                        return (
                                                            <View key={ep.episodeId || qIdx} style={[styles.episodeRow, isInQueue && styles.episodeRowActive]}>
                                                                <View style={[styles.epNumberBadge, isInQueue && styles.epNumberBadgeActive]}>
                                                                    <Text style={[styles.epNumberText, isInQueue && styles.epNumberTextActive]}>EP {formattedEpNum}</Text>
                                                                </View>
                                                                <View style={styles.epContent}>
                                                                    <Text style={[styles.epTopicText, isInQueue && styles.epTopicTextActive]} numberOfLines={2}>
                                                                        {ep.topic}
                                                                    </Text>
                                                                    <View style={styles.epPillRow}>
                                                                        {isInQueue ? (
                                                                            <View style={styles.epActiveStatusPill}>
                                                                                <View style={styles.miniActiveGreenDot} />
                                                                                <Text style={styles.epActiveStatusText}>IN EDITORIAL QUEUE</Text>
                                                                            </View>
                                                                        ) : (
                                                                            <View style={styles.epUpcomingStatusPill}>
                                                                                <Text style={styles.epUpcomingStatusText}>UPCOMING IN SYLLABUS</Text>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                    {ep.learningObjective && ep.learningObjective !== ep.topic ? (
                                                                        <Text style={styles.epObjectiveText} numberOfLines={2}>
                                                                            {ep.learningObjective}
                                                                        </Text>
                                                                    ) : null}
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                    <View style={styles.roundRobinNotice}>
                                                        <Ionicons name="information-circle-outline" size={13} color={colors.sandstone} />
                                                        <Text style={styles.roundRobinNoticeText}>
                                                            Serenity feeds syllabus topics into your Editorial Queue 1 episode at a time via round-robin.
                                                        </Text>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View style={styles.emptyQueueBox}>
                                                    <Text style={styles.emptyQueueText}>No syllabus episodes currently planned in this track</Text>
                                                </View>
                                            )}
                                        </View>

                                        <View style={styles.drawerActions}>
                                            {item.status === 'completed' ? (
                                                <TouchableOpacity
                                                    style={styles.drawerBtnPrimary}
                                                    onPress={() => handleReactivateSeries(item)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="sparkles-outline" size={13} color={colors.primaryForeground} />
                                                    <Text style={styles.drawerBtnPrimaryText}>Revive Track (New Season)</Text>
                                                </TouchableOpacity>
                                            ) : (
                                                <>
                                                    <TouchableOpacity
                                                        style={styles.drawerBtn}
                                                        onPress={() => handleToggleStatus(item)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons
                                                            name={item.status === 'active' ? 'pause-outline' : 'play-outline'}
                                                            size={13}
                                                            color={colors.linenDim}
                                                        />
                                                        <Text style={styles.drawerBtnText}>
                                                            {item.status === 'active' ? 'Pause' : 'Activate'}
                                                        </Text>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        style={styles.drawerBtn}
                                                        onPress={() => handleCompleteSeries(item)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons name="checkmark-done-outline" size={13} color={colors.linenDim} />
                                                        <Text style={styles.drawerBtnText}>Complete Track</Text>
                                                    </TouchableOpacity>
                                                </>
                                            )}

                                            <TouchableOpacity
                                                style={styles.drawerBtnDanger}
                                                onPress={() => handleDeleteSeries(item.id)}
                                                activeOpacity={0.8}
                                            >
                                                <Ionicons name="trash-outline" size={13} color={colors.failed} />
                                                <Text style={styles.drawerBtnDangerText}>Delete</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    }))}
                </View>
            </ScrollView>

            {/* ─── Floating Toast Notification ─── */}
            <Animated.View style={[styles.floatingToast, { opacity: toastOpacity }]} pointerEvents="none">
                <Ionicons name="checkmark-circle" size={16} color={colors.sandstone} />
                <Text style={styles.floatingToastText}>{toastMessage}</Text>
            </Animated.View>

            {/* ─── New Series Modal Sheet ─── */}
            <Modal
                visible={isCreateModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setCreateModalVisible(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalOverlay}
                >
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetDragHandle} />

                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetTitleCluster}>
                                <View style={styles.sheetDot} />
                                <View>
                                    <Text style={styles.sheetTitle}>New Series Architecture</Text>
                                    <Text style={styles.sheetSubtitle}>Multi-Episode Curated Track</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.sheetCloseBtn} onPress={() => setCreateModalVisible(false)}>
                                <Ionicons name="close" size={20} color={colors.linenMuted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.sheetBody}
                            contentContainerStyle={styles.sheetContent}
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.inputLabel}>SERIES TITLE</Text>
                            <TextInput
                                style={styles.inputField}
                                placeholder="e.g. Distributed Systems Masterclass"
                                placeholderTextColor={colors.linenWhisper}
                                value={newTitle}
                                onChangeText={setNewTitle}
                            />

                            <Text style={[styles.inputLabel, { marginTop: spacing.md }]}>LEARNING GOAL & SYLLABUS</Text>
                            <TextInput
                                style={styles.textarea}
                                placeholder="What core paradigms, engineering invariants, or patterns will viewers master throughout this series?"
                                placeholderTextColor={colors.linenWhisper}
                                value={newLearningGoal}
                                onChangeText={setNewLearningGoal}
                                multiline
                                numberOfLines={4}
                            />
                        </ScrollView>

                        {/* Docked Action Footer */}
                        <View style={styles.sheetFooter}>
                            <TouchableOpacity
                                style={[styles.sheetSubmitBtn, creating && { opacity: 0.6 }]}
                                onPress={handleCreateSeries}
                                disabled={creating}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.sheetSubmitText}>
                                    {creating ? 'Publishing Series...' : 'Create Series Architecture'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
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
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxxl * 2,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    headerLeft: {
        flex: 1,
        marginRight: spacing.sm,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: -0.3,
    },
    headerSub: {
        fontSize: 12,
        color: colors.linenMuted,
        marginTop: 2,
    },
    newSeriesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: borderRadius.full,
        backgroundColor: colors.sandstone,
        flexShrink: 0,
        ...shadows.glowSandstone,
    },
    newSeriesBtnText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
    },
    statsStrip: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.md,
        alignItems: 'center',
    },
    statCell: {
        flex: 1,
        alignItems: 'center',
        minWidth: 0,
    },
    statNum: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
    },
    statLabel: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.linenWhisper,
        letterSpacing: 0.8,
        marginTop: 1,
    },
    statSeparator: {
        width: 1,
        height: 20,
        backgroundColor: colors.borderLight,
    },
    filterBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    segmentedControl: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 3,
        flex: 1,
    },
    segmentBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 5,
        borderRadius: borderRadius.xs,
    },
    segmentBtnActive: {
        backgroundColor: 'rgba(200, 178, 155, 0.14)',
    },
    segmentText: {
        fontSize: 11,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenWhisper,
    },
    segmentTextActive: {
        color: colors.sandstone,
        fontWeight: typography.fontWeightBold,
    },
    filterOrderBtn: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    catalogList: {
        gap: spacing.sm + 2,
    },
    catalogCard: {
        borderRadius: borderRadius.sm,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm + 2,
        ...shadows.subtle,
    },
    catalogCardExpanded: {
        borderColor: colors.sandstoneBorder,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    cardIndexBox: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    cardIndexText: {
        fontSize: 11,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    cardCenter: {
        flex: 1,
        gap: 3,
        minWidth: 0,
    },
    cardTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        lineHeight: 20,
    },
    cardMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 5,
        marginTop: 2,
    },
    cardMetaText: {
        fontSize: 11,
        color: colors.linenWhisper,
    },
    statusActive: {
        color: colors.sandstone,
        fontWeight: typography.fontWeightMedium,
    },
    statusPaused: {
        color: colors.linenWhisper,
    },
    statusCompleted: {
        color: '#10B981',
        fontWeight: typography.fontWeightMedium,
    },
    cardQueueBadge: {
        fontSize: 11,
        color: colors.sandstone,
        fontWeight: typography.fontWeightMedium,
    },
    cardRight: {
        alignItems: 'flex-end',
        gap: 6,
        flexShrink: 0,
        marginLeft: 4,
    },
    pctBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
        backgroundColor: 'rgba(200, 178, 155, 0.1)',
    },
    pctText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
    },
    thinProgressTrack: {
        height: 2,
        backgroundColor: colors.borderLight,
        borderRadius: 1,
        overflow: 'hidden',
        marginTop: spacing.sm + 4,
    },
    thinProgressFill: {
        height: '100%',
        backgroundColor: colors.sandstone,
        borderRadius: 1,
    },
    cardDrawer: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        gap: spacing.sm + 2,
    },
    drawerSection: {
        gap: 4,
    },
    drawerLabel: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 0.8,
    },
    drawerDesc: {
        fontSize: 12,
        color: colors.linenMuted,
        lineHeight: 18,
    },
    queueSection: {
        marginTop: spacing.xs,
        gap: 6,
    },
    queueSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2,
    },
    episodeList: {
        gap: 6,
    },
    episodeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.surfaceRecessed,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm + 2,
        gap: spacing.sm,
    },
    epNumberBadge: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: 'rgba(200, 178, 155, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
    },
    epNumberText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 0.5,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    epContent: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    epTopicText: {
        fontSize: 12,
        fontWeight: typography.fontWeightSemibold,
        color: colors.linen,
        lineHeight: 16,
    },
    epTopicTextActive: {
        color: colors.linen,
        fontWeight: typography.fontWeightBold,
    },
    epPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 2,
    },
    epObjectiveText: {
        fontSize: 10,
        color: colors.linenWhisper,
        lineHeight: 14,
    },
    inProdQueueTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    inProdQueueTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        alignSelf: 'flex-start',
    },
    inProdQueueTagText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: '#10B981',
    },
    miniActiveGreenDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
    },
    episodeRowActive: {
        borderColor: 'rgba(16, 185, 129, 0.35)',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    epNumberBadgeActive: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderColor: 'rgba(16, 185, 129, 0.35)',
    },
    epNumberTextActive: {
        color: '#10B981',
    },
    epActiveStatusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    epActiveStatusText: {
        fontSize: 8,
        fontWeight: typography.fontWeightBold,
        color: '#10B981',
        letterSpacing: 0.4,
    },
    epUpcomingStatusPill: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    epUpcomingStatusText: {
        fontSize: 8,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenWhisper,
        letterSpacing: 0.3,
    },
    roundRobinNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: borderRadius.xs,
        backgroundColor: 'rgba(200, 178, 155, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.15)',
        marginTop: 4,
    },
    roundRobinNoticeText: {
        fontSize: 10,
        color: colors.linenMuted,
        flex: 1,
        lineHeight: 14,
    },
    durationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.card,
    },
    durationText: {
        fontSize: 10,
        color: colors.linenWhisper,
    },
    emptyQueueBox: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm + 2,
        backgroundColor: colors.surfaceRecessed,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    emptyQueueText: {
        fontSize: 11,
        color: colors.linenWhisper,
        fontStyle: 'italic',
    },
    drawerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: spacing.xs + 4,
        paddingTop: 4,
    },
    drawerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    drawerBtnText: {
        fontSize: 11,
        color: colors.linenDim,
        fontWeight: typography.fontWeightMedium,
    },
    drawerBtnPrimary: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.sandstone,
    },
    drawerBtnPrimaryText: {
        fontSize: 11,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
    },
    drawerBtnDanger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm + 4,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        backgroundColor: 'rgba(244, 63, 94, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.2)',
    },
    drawerBtnDangerText: {
        fontSize: 11,
        color: colors.failed,
        fontWeight: typography.fontWeightMedium,
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: colors.linenWhisper,
    },
    floatingToast: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(22, 19, 13, 0.97)',
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        ...shadows.glowSandstone,
        zIndex: 99,
    },
    floatingToastText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenDim,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
        maxHeight: '88%',
    },
    sheetDragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginBottom: spacing.md,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    sheetTitleCluster: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    sheetDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.sandstone,
    },
    sheetTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
    },
    sheetSubtitle: {
        fontSize: 11,
        color: colors.linenWhisper,
    },
    sheetCloseBtn: {
        padding: 4,
    },
    sheetBody: {
        flexShrink: 1,
        paddingTop: spacing.sm,
    },
    sheetContent: {
        paddingBottom: spacing.sm,
    },
    sheetFooter: {
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
    },
    inputLabel: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.linenMuted,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    inputField: {
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        fontSize: typography.fontSizeSm,
        color: colors.linen,
    },
    textarea: {
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        fontSize: typography.fontSizeSm,
        color: colors.linen,
        textAlignVertical: 'top',
        minHeight: 90,
    },
    sheetSubmitBtn: {
        backgroundColor: colors.sandstone,
        borderRadius: borderRadius.sm,
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sheetSubmitText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
        letterSpacing: 0.5,
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        gap: 8,
    },
    emptyStateTitle: {
        fontSize: 15,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        marginTop: 6,
    },
    emptyStateSubtitle: {
        fontSize: 12,
        color: colors.linenMuted,
        textAlign: 'center',
        lineHeight: 18,
    },
    emptyCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.sandstone,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: borderRadius.sm,
        marginTop: 10,
    },
    emptyCreateBtnText: {
        fontSize: 12,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
    },
});
