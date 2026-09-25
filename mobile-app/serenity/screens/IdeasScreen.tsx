import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    RefreshControl,
    Modal,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ideasApi, seriesApi, SeriesState } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import CustomAlert, { CustomAlertConfig } from '../components/CustomAlert';
import { colors, spacing, borderRadius, typography } from '../theme';

interface ParsedIdea {
    title: string;
    series: string;
    description: string;
    learningGoal?: string;
    episodeId?: string;
    isSeries: boolean;
    raw: string;
    originalIndex: number;
    originalObj?: any;
}

const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const parseIdea = (raw: any, index: number): ParsedIdea => {
    if (!raw) {
        return {
            title: 'Untitled Production Idea',
            series: 'STANDALONE RELEASE',
            description: 'No detailed objective specified.',
            isSeries: false,
            raw: '',
            originalIndex: index,
        };
    }

    let parsedObj: any = null;

    if (typeof raw === 'object') {
        parsedObj = raw;
    } else if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                parsedObj = JSON.parse(trimmed);
            } catch {}
        }
    }

    if (parsedObj && typeof parsedObj === 'object') {
        const title = (
            parsedObj.topic ||
            parsedObj.title ||
            parsedObj.seriesContext?.topic ||
            ''
        ).trim();

        const isSeries = Boolean(parsedObj.isSeries || parsedObj.seriesContext);

        const seriesTitle = (
            parsedObj.seriesContext?.seriesTitle ||
            parsedObj.seriesTitle ||
            (isSeries ? 'Series Track' : 'Standalone Release')
        ).trim();

        const description = (
            parsedObj.seriesContext?.learningObjective ||
            parsedObj.description ||
            parsedObj.seriesContext?.learningGoal ||
            parsedObj.learningGoal ||
            (title ? `Exploration of ${title}` : '')
        ).trim();

        const learningGoal = parsedObj.seriesContext?.learningGoal || parsedObj.learningGoal;
        const episodeId = parsedObj.seriesContext?.episodeId || parsedObj.episodeId;

        return {
            title: title || 'Untitled Production Idea',
            series: seriesTitle.toUpperCase(),
            description: description || 'No detailed objective provided.',
            learningGoal: learningGoal ? String(learningGoal).trim() : undefined,
            episodeId: episodeId ? String(episodeId).trim() : undefined,
            isSeries,
            raw: typeof raw === 'string' ? raw : JSON.stringify(raw),
            originalIndex: index,
            originalObj: parsedObj,
        };
    }

    const str = String(raw).trim();
    if (str.includes(':')) {
        const firstColon = str.indexOf(':');
        const seriesPart = str.slice(0, firstColon).trim();
        const titlePart = str.slice(firstColon + 1).trim();
        return {
            title: titlePart || seriesPart,
            series: seriesPart.toUpperCase(),
            description: `Production exploration of ${titlePart || seriesPart}.`,
            isSeries: true,
            raw: str,
            originalIndex: index,
        };
    }

    return {
        title: str,
        series: 'STANDALONE RELEASE',
        description: `Production exploration of ${str}.`,
        isSeries: false,
        raw: str,
        originalIndex: index,
    };
};

export default function IdeasScreen() {
    const [ideas, setIdeas] = useState<string[]>([]);
    const [seriesList, setSeriesList] = useState<SeriesState[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState<'all' | 'series' | 'standalone'>('all');

    // Add Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [selectedSeries, setSelectedSeries] = useState('None (Standalone Idea)');
    const [showSeriesDropdown, setShowSeriesDropdown] = useState(false);
    const [addPosition, setAddPosition] = useState<'bottom' | 'top'>('bottom');
    const [adding, setAdding] = useState(false);

    // Edit Modal State
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editSeries, setEditSeries] = useState('None (Standalone Idea)');
    const [showEditSeriesDropdown, setShowEditSeriesDropdown] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    // Concept Options Modal State
    const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);

    // Alert & Toast State
    const [alertConfig, setAlertConfig] = useState<CustomAlertConfig>({
        visible: false,
        title: '',
        message: '',
    });
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

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [ideasRes, seriesRes] = await Promise.all([
                ideasApi.getIdeas(),
                seriesApi.getSeries().catch(() => ({ ok: false })),
            ]);

            if (ideasRes.ok && ideasRes.ideas) {
                setIdeas(ideasRes.ideas);
            } else {
                setIdeas([]);
            }

            if (seriesRes && 'series' in seriesRes && seriesRes.series) {
                const s = Array.isArray(seriesRes.series) ? seriesRes.series : [seriesRes.series];
                setSeriesList(s);
            }
        } catch (err) {
            console.error('[Ideas] Error loading ideas:', err);
            setIdeas([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadData(true);
    }, [loadData]);

    const handleMoveIdea = async (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= ideas.length || toIndex >= ideas.length) {
            return;
        }
        try {
            const next = [...ideas];
            const [item] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, item);
            setIdeas(next);

            const destLabel = toIndex === 0 ? '#1 (Next in Pipeline)' : `Position #${toIndex + 1}`;
            showToast(`Moved to ${destLabel}`);

            await ideasApi.moveIdea(fromIndex, toIndex);
        } catch {
            showToast('Could not sync reorder to cloud');
        }
    };

    const handlePromoteToTop = (fromIndex: number) => {
        handleMoveIdea(fromIndex, 0);
    };

    const handleDelete = (index: number) => {
        setAlertConfig({
            visible: true,
            title: 'Delete Concept',
            message: 'Remove this concept from the production queue?',
            type: 'danger',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIdeas(prev => prev.filter((_, i) => i !== index));
                            showToast('Concept removed');
                            await ideasApi.removeIdea(index);
                        } catch {
                            showToast('Could not delete from cloud');
                        }
                    },
                },
            ],
        });
    };

    const handleClearQueue = () => {
        if (ideas.length === 0) return;
        setAlertConfig({
            visible: true,
            title: 'Clear Entire Queue',
            message: 'This will permanently remove all queued video concepts. Are you sure?',
            type: 'danger',
            buttons: [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIdeas([]);
                            showToast('Queue cleared');
                            await ideasApi.clearIdeas();
                        } catch {
                            showToast('Could not clear queue');
                        }
                    },
                },
            ],
        });
    };

    const openEditModal = (index: number, rawPayload: string) => {
        const parsed = parseIdea(rawPayload, index);
        setEditingIndex(index);
        setEditTitle(parsed.title);
        setEditDescription(parsed.description || '');

        let matchingSeries = 'None (Standalone Idea)';
        if (parsed.isSeries && parsed.series) {
            const match = seriesList.find(
                s => s.title.toUpperCase() === parsed.series.toUpperCase()
            );
            if (match) matchingSeries = match.title;
        }
        setEditSeries(matchingSeries);
        setShowEditSeriesDropdown(false);
    };

    const handleSaveEdit = async () => {
        if (editingIndex === null || !editTitle.trim()) return;

        setSavingEdit(true);
        const selectedSeriesObj = seriesList.find(s => s.title === editSeries);
        let updatedPayload: string;

        if (selectedSeriesObj) {
            updatedPayload = JSON.stringify({
                topic: editTitle.trim(),
                isSeries: true,
                seriesContext: {
                    seriesId: selectedSeriesObj.id || selectedSeriesObj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    seriesTitle: selectedSeriesObj.title,
                    learningGoal: selectedSeriesObj.learningGoal || '',
                    episodeId: generateUUID(),
                    topic: editTitle.trim(),
                    learningObjective: editDescription.trim() || editTitle.trim(),
                },
            });
        } else if (editDescription.trim()) {
            updatedPayload = JSON.stringify({
                topic: editTitle.trim(),
                isSeries: false,
                description: editDescription.trim(),
            });
        } else {
            updatedPayload = editTitle.trim();
        }

        try {
            setIdeas(prev => {
                const next = [...prev];
                next[editingIndex] = updatedPayload;
                return next;
            });
            showToast('Concept updated');
            setEditingIndex(null);
            await ideasApi.editIdea(editingIndex, updatedPayload);
        } catch {
            showToast('Error syncing edit');
            setEditingIndex(null);
        } finally {
            setSavingEdit(false);
        }
    };

    const handleAddIdea = async (position: 'bottom' | 'top' = addPosition) => {
        if (!newTitle.trim()) return;

        setAdding(true);
        const selectedSeriesObj = seriesList.find(s => s.title === selectedSeries);
        let payload: string;

        if (selectedSeriesObj) {
            payload = JSON.stringify({
                topic: newTitle.trim(),
                isSeries: true,
                seriesContext: {
                    seriesId: selectedSeriesObj.id || selectedSeriesObj.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    seriesTitle: selectedSeriesObj.title,
                    learningGoal: selectedSeriesObj.learningGoal || '',
                    episodeId: generateUUID(),
                    topic: newTitle.trim(),
                    learningObjective: newDescription.trim() || newTitle.trim(),
                },
            });
        } else if (newDescription.trim()) {
            payload = JSON.stringify({
                topic: newTitle.trim(),
                isSeries: false,
                description: newDescription.trim(),
            });
        } else {
            payload = newTitle.trim();
        }

        try {
            if (position === 'top') {
                setIdeas(prev => [payload, ...prev]);
                showToast('Concept prioritized at #1');
            } else {
                setIdeas(prev => [...prev, payload]);
                showToast(ideas.length === 0 ? 'Concept queued at #1' : `Concept added to queue (#${ideas.length + 1})`);
            }
            setShowAddModal(false);
            setNewTitle('');
            setNewDescription('');
            setSelectedSeries('None (Standalone Idea)');
            setAddPosition('bottom');
            await ideasApi.addIdea(payload, position);
        } catch {
            showToast('Could not add to cloud');
        } finally {
            setAdding(false);
        }
    };

    // Parse all ideas
    const parsedIdeas = ideas.map((raw, idx) => parseIdea(raw, idx));
    const seriesCount = parsedIdeas.filter(i => i.isSeries).length;
    const standaloneCount = parsedIdeas.filter(i => !i.isSeries).length;

    const filteredIdeas = parsedIdeas.filter(item => {
        if (activeFilter === 'series') return item.isSeries;
        if (activeFilter === 'standalone') return !item.isSeries;
        return true;
    });

    const spotlightIdea = parsedIdeas.length > 0 ? parsedIdeas[0] : null;
    const subsequentQueue = activeFilter === 'all'
        ? parsedIdeas.slice(1)
        : filteredIdeas.filter(i => i.originalIndex !== 0);

    if (loading && !refreshing) {
        return (
            <View style={styles.screen}>
                <SkeletonLoader variant="ideas" />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.sandstone}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Clean Header & Ingest Action ─── */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.headerTitle}>Editorial Queue</Text>
                        <Text style={styles.headerSubtitle}>
                            {ideas.length} {ideas.length === 1 ? 'concept' : 'concepts'} ready for production
                        </Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.addBtn}
                            onPress={() => setShowAddModal(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={16} color={colors.obsidian[950]} />
                            <Text style={styles.addBtnText}>New Concept</Text>
                        </TouchableOpacity>

                        {ideas.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearBtn}
                                onPress={handleClearQueue}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="trash-outline" size={14} color={colors.bone.muted} />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* ─── Empty State (When no ideas exist) ─── */}
                {ideas.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconBox}>
                            <Ionicons name="sparkles" size={28} color={colors.sandstone} />
                        </View>
                        <Text style={styles.emptyTitle}>Your Production Queue is Empty</Text>
                        <Text style={styles.emptySubtitle}>
                            Drop your next video concepts here. Serenity will autonomously script, voice, and render them when scheduled.
                        </Text>
                        <TouchableOpacity
                            style={styles.emptyCta}
                            onPress={() => setShowAddModal(true)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="add" size={16} color={colors.obsidian[950]} />
                            <Text style={styles.emptyCtaText}>Add First Concept</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* ─── Spotlight Card: Next in Pipeline (Idea #1) ─── */}
                        {spotlightIdea && (activeFilter === 'all' || (activeFilter === 'series' && spotlightIdea.isSeries) || (activeFilter === 'standalone' && !spotlightIdea.isSeries)) && (
                            <View style={styles.spotlightCard}>
                                <View style={styles.spotlightTopRow}>
                                    <View style={styles.spotlightBadge}>
                                        <View style={styles.pulseDot} />
                                        <Text style={styles.spotlightBadgeText}>NEXT IN PIPELINE</Text>
                                    </View>
                                    <View style={styles.spotlightActions}>
                                        <TouchableOpacity
                                            style={styles.spotlightIconBtn}
                                            onPress={() => openEditModal(0, spotlightIdea.raw)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="pencil-outline" size={14} color={colors.sandstone} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.spotlightIconBtn}
                                            onPress={() => setSelectedActionIndex(0)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="ellipsis-horizontal" size={15} color={colors.bone.muted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <Text style={styles.spotlightTitle}>{spotlightIdea.title}</Text>

                                <View style={styles.spotlightMetaRow}>
                                    <View style={[styles.trackBadge, spotlightIdea.isSeries ? styles.trackSeries : styles.trackStandalone]}>
                                        <Ionicons
                                            name={spotlightIdea.isSeries ? 'layers-outline' : 'disc-outline'}
                                            size={11}
                                            color={spotlightIdea.isSeries ? colors.sandstone : colors.bone.muted}
                                        />
                                        <Text
                                            style={[styles.trackBadgeText, spotlightIdea.isSeries ? styles.trackSeriesText : styles.trackStandaloneText]}
                                            numberOfLines={1}
                                            ellipsizeMode="tail"
                                        >
                                            {spotlightIdea.series}
                                        </Text>
                                    </View>

                                    <View style={styles.readyBadge}>
                                        <Ionicons name="checkmark-circle-outline" size={12} color="#10B981" />
                                        <Text style={styles.readyBadgeText}>Ready for Scripting</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* ─── Filter Tabs Segment ─── */}
                        <View style={styles.filterRow}>
                            <TouchableOpacity
                                style={[styles.filterTab, activeFilter === 'all' && styles.filterTabActive]}
                                onPress={() => setActiveFilter('all')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.filterTabText, activeFilter === 'all' && styles.filterTabTextActive]}>
                                    All ({ideas.length})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.filterTab, activeFilter === 'series' && styles.filterTabActive]}
                                onPress={() => setActiveFilter('series')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.filterTabText, activeFilter === 'series' && styles.filterTabTextActive]}>
                                    Series ({seriesCount})
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.filterTab, activeFilter === 'standalone' && styles.filterTabActive]}
                                onPress={() => setActiveFilter('standalone')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.filterTabText, activeFilter === 'standalone' && styles.filterTabTextActive]}>
                                    Standalone ({standaloneCount})
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* ─── Subsequent Queue Cards (#02, #03...) ─── */}
                        <View style={styles.queueSection}>
                            <View style={styles.queueSectionHeader}>
                                <Text style={styles.queueSectionTitle}>UPCOMING QUEUE</Text>
                                <Text style={styles.queueSectionCount}>{subsequentQueue.length} queued</Text>
                            </View>

                            {subsequentQueue.length === 0 ? (
                                <View style={styles.singleItemNote}>
                                    <Ionicons name="information-circle-outline" size={14} color={colors.sandstone} />
                                    <Text style={styles.singleItemNoteText}>
                                        {activeFilter === 'all'
                                            ? 'Only 1 idea queued. Add more concepts so the pipeline continuous flow never halts.'
                                            : `No other upcoming concepts match the "${activeFilter.toUpperCase()}" filter.`}
                                    </Text>
                                </View>
                            ) : (
                                subsequentQueue.map((item) => {
                                    const rankNum = item.originalIndex + 1;
                                    const rankStr = rankNum < 10 ? `#0${rankNum}` : `#${rankNum}`;

                                    return (
                                        <TouchableOpacity
                                            key={item.originalIndex}
                                            style={styles.queueCard}
                                            onPress={() => setSelectedActionIndex(item.originalIndex)}
                                            activeOpacity={0.75}
                                        >
                                            <View style={styles.queueCardTop}>
                                                <View style={styles.rankPill}>
                                                    <Text style={styles.rankPillText}>{rankStr}</Text>
                                                </View>

                                                <View style={styles.queueCardBody}>
                                                    <Text style={styles.queueCardTitle} numberOfLines={2}>
                                                        {item.title}
                                                    </Text>

                                                    <View style={styles.queueCardMetaRow}>
                                                        <View style={[styles.miniTrackBadge, item.isSeries ? styles.trackSeries : styles.trackStandalone]}>
                                                            <Text
                                                                style={[styles.miniTrackText, item.isSeries ? styles.trackSeriesText : styles.trackStandaloneText]}
                                                                numberOfLines={1}
                                                                ellipsizeMode="tail"
                                                            >
                                                                {item.series}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>

                                                <TouchableOpacity
                                                    style={styles.cardMenuBtn}
                                                    onPress={() => setSelectedActionIndex(item.originalIndex)}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="ellipsis-horizontal" size={16} color={colors.bone.muted} />
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            {/* ─── Floating Toast Feedback ─── */}
            <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]} pointerEvents="none">
                <Ionicons name="checkmark-circle" size={15} color={colors.sandstone} />
                <Text style={styles.toastText}>{toastMessage}</Text>
            </Animated.View>

            {/* ─── Add Concept Bottom Sheet ─── */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalBackdrop}
                >
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetTitle}>New Video Concept</Text>
                                <Text style={styles.sheetSubtitle}>Queue for autonomous pipeline generation</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowAddModal(false)}
                                style={styles.sheetCloseBtn}
                            >
                                <Ionicons name="close" size={18} color={colors.bone.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
                        >
                            <View>
                                <Text style={styles.fieldLabel}>VIDEO TITLE / CORE HOOK</Text>
                                <TextInput
                                    style={styles.inputArea}
                                    placeholder="e.g. Why Rust GUIs are Winning Desktop Performance..."
                                    placeholderTextColor={colors.bone.muted}
                                    value={newTitle}
                                    onChangeText={setNewTitle}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <View>
                                <Text style={styles.fieldLabel}>PLAYLIST / SERIES TRACK</Text>
                                <TouchableOpacity
                                    style={styles.dropdownTrigger}
                                    onPress={() => setShowSeriesDropdown(!showSeriesDropdown)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.dropdownValueRow}>
                                        <Ionicons
                                            name={selectedSeries === 'None (Standalone Idea)' ? 'disc-outline' : 'layers-outline'}
                                            size={15}
                                            color={colors.sandstone}
                                        />
                                        <Text style={styles.dropdownValueText} numberOfLines={1}>
                                            {selectedSeries}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name={showSeriesDropdown ? 'chevron-up' : 'chevron-down'}
                                        size={16}
                                        color={colors.sandstone}
                                    />
                                </TouchableOpacity>

                                {showSeriesDropdown && (
                                    <View style={styles.dropdownBox}>
                                        <TouchableOpacity
                                            style={[styles.dropdownItem, selectedSeries === 'None (Standalone Idea)' && styles.dropdownItemActive]}
                                            onPress={() => {
                                                setSelectedSeries('None (Standalone Idea)');
                                                setShowSeriesDropdown(false);
                                            }}
                                        >
                                            <Text style={[styles.dropdownItemText, selectedSeries === 'None (Standalone Idea)' && styles.dropdownItemTextActive]}>
                                                None (Standalone Idea)
                                            </Text>
                                        </TouchableOpacity>
                                        {seriesList.map((s, idx) => (
                                            <TouchableOpacity
                                                key={s.id || idx}
                                                style={[styles.dropdownItem, selectedSeries === s.title && styles.dropdownItemActive]}
                                                onPress={() => {
                                                    setSelectedSeries(s.title);
                                                    setShowSeriesDropdown(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownItemText, selectedSeries === s.title && styles.dropdownItemTextActive]}>
                                                    {s.title}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View>
                                <Text style={styles.fieldLabel}>OPTIONAL THESIS / OBJECTIVE</Text>
                                <TextInput
                                    style={[styles.inputArea, { minHeight: 60 }]}
                                    placeholder="Optional technical notes or focus boundaries for the AI script..."
                                    placeholderTextColor={colors.bone.muted}
                                    value={newDescription}
                                    onChangeText={setNewDescription}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <View>
                                <Text style={styles.fieldLabel}>QUEUE PLACEMENT</Text>
                                <View style={styles.placementTabs}>
                                    <TouchableOpacity
                                        style={[
                                            styles.placementTab,
                                            addPosition === 'bottom' && styles.placementTabActive,
                                        ]}
                                        onPress={() => setAddPosition('bottom')}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name="list-outline"
                                            size={16}
                                            color={addPosition === 'bottom' ? colors.obsidian[950] : colors.bone.muted}
                                        />
                                        <View style={styles.placementTextCol}>
                                            <Text
                                                style={[
                                                    styles.placementTabTitle,
                                                    addPosition === 'bottom' && styles.placementTabTitleActive,
                                                ]}
                                            >
                                                End of Queue
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.placementTabSub,
                                                    addPosition === 'bottom' && styles.placementTabSubActive,
                                                ]}
                                            >
                                                {ideas.length > 0 ? `Position #${ideas.length + 1}` : 'First in queue'}
                                            </Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[
                                            styles.placementTab,
                                            addPosition === 'top' && styles.placementTabActive,
                                        ]}
                                        onPress={() => setAddPosition('top')}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons
                                            name="flash"
                                            size={15}
                                            color={addPosition === 'top' ? colors.obsidian[950] : colors.sandstone}
                                        />
                                        <View style={styles.placementTextCol}>
                                            <Text
                                                style={[
                                                    styles.placementTabTitle,
                                                    addPosition === 'top' && styles.placementTabTitleActive,
                                                ]}
                                            >
                                                Priority #1
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.placementTabSub,
                                                    addPosition === 'top' && styles.placementTabSubActive,
                                                ]}
                                            >
                                                Next in pipeline
                                            </Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.sheetSubmitBtn}
                                onPress={() => handleAddIdea(addPosition)}
                                disabled={adding || !newTitle.trim()}
                                activeOpacity={0.85}
                            >
                                <Ionicons
                                    name={addPosition === 'top' ? 'flash' : 'add-circle-outline'}
                                    size={16}
                                    color={colors.obsidian[950]}
                                />
                                <Text style={styles.sheetSubmitText}>
                                    {addPosition === 'top'
                                        ? 'Queue Concept at #1 (Next)'
                                        : `Add Concept to Queue (${ideas.length > 0 ? '#' + (ideas.length + 1) : '#1'})`}
                                </Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ─── Edit Concept Modal ─── */}
            <Modal
                visible={editingIndex !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setEditingIndex(null)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.modalBackdrop}
                >
                    <View style={styles.bottomSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetTitle}>Edit Concept</Text>
                                <Text style={styles.sheetSubtitle}>Update production parameters</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setEditingIndex(null)}
                                style={styles.sheetCloseBtn}
                            >
                                <Ionicons name="close" size={18} color={colors.bone.muted} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
                        >
                            <View>
                                <Text style={styles.fieldLabel}>VIDEO TITLE</Text>
                                <TextInput
                                    style={styles.inputArea}
                                    value={editTitle}
                                    onChangeText={setEditTitle}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <View>
                                <Text style={styles.fieldLabel}>PLAYLIST / SERIES TRACK</Text>
                                <TouchableOpacity
                                    style={styles.dropdownTrigger}
                                    onPress={() => setShowEditSeriesDropdown(!showEditSeriesDropdown)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.dropdownValueRow}>
                                        <Ionicons
                                            name={editSeries === 'None (Standalone Idea)' ? 'disc-outline' : 'layers-outline'}
                                            size={15}
                                            color={colors.sandstone}
                                        />
                                        <Text style={styles.dropdownValueText} numberOfLines={1}>
                                            {editSeries}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name={showEditSeriesDropdown ? 'chevron-up' : 'chevron-down'}
                                        size={16}
                                        color={colors.sandstone}
                                    />
                                </TouchableOpacity>

                                {showEditSeriesDropdown && (
                                    <View style={styles.dropdownBox}>
                                        <TouchableOpacity
                                            style={[styles.dropdownItem, editSeries === 'None (Standalone Idea)' && styles.dropdownItemActive]}
                                            onPress={() => {
                                                setEditSeries('None (Standalone Idea)');
                                                setShowEditSeriesDropdown(false);
                                            }}
                                        >
                                            <Text style={[styles.dropdownItemText, editSeries === 'None (Standalone Idea)' && styles.dropdownItemTextActive]}>
                                                None (Standalone Idea)
                                            </Text>
                                        </TouchableOpacity>
                                        {seriesList.map((s, idx) => (
                                            <TouchableOpacity
                                                key={s.id || idx}
                                                style={[styles.dropdownItem, editSeries === s.title && styles.dropdownItemActive]}
                                                onPress={() => {
                                                    setEditSeries(s.title);
                                                    setShowEditSeriesDropdown(false);
                                                }}
                                            >
                                                <Text style={[styles.dropdownItemText, editSeries === s.title && styles.dropdownItemTextActive]}>
                                                    {s.title}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>

                            <View>
                                <Text style={styles.fieldLabel}>THESIS / OBJECTIVE</Text>
                                <TextInput
                                    style={[styles.inputArea, { minHeight: 60 }]}
                                    value={editDescription}
                                    onChangeText={setEditDescription}
                                    multiline
                                    numberOfLines={2}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.sheetSubmitBtn}
                                onPress={handleSaveEdit}
                                disabled={savingEdit || !editTitle.trim()}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="checkmark" size={17} color={colors.obsidian[950]} />
                                <Text style={styles.sheetSubmitText}>Save Changes</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ─── Concept Options Bottom Sheet ─── */}
            <Modal
                visible={selectedActionIndex !== null}
                animationType="slide"
                transparent
                onRequestClose={() => setSelectedActionIndex(null)}
            >
                <TouchableOpacity
                    style={styles.modalBackdrop}
                    activeOpacity={1}
                    onPress={() => setSelectedActionIndex(null)}
                >
                    <View style={styles.bottomSheet} onStartShouldSetResponder={() => true}>
                        <View style={styles.sheetHandle} />

                        {selectedActionIndex !== null && ideas[selectedActionIndex] && (() => {
                            const currentIdea = parseIdea(ideas[selectedActionIndex], selectedActionIndex);
                            const currentRankNum = selectedActionIndex + 1;
                            const currentRankStr = currentRankNum < 10 ? `#0${currentRankNum}` : `#${currentRankNum}`;

                            return (
                                <View style={{ gap: 14 }}>
                                    {/* Header */}
                                    <View style={styles.sheetHeader}>
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={styles.sheetTitle}>Concept Options</Text>
                                            <Text style={styles.sheetSubtitle}>
                                                {selectedActionIndex === 0 ? 'Next in Pipeline' : `Position ${currentRankStr} in Queue`}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => setSelectedActionIndex(null)}
                                            style={styles.sheetCloseBtn}
                                        >
                                            <Ionicons name="close" size={18} color={colors.bone.muted} />
                                        </TouchableOpacity>
                                    </View>

                                    {/* Preview Box */}
                                    <View style={styles.conceptPreviewBox}>
                                        <Text style={styles.conceptPreviewTitle}>
                                            {currentIdea.title}
                                        </Text>
                                        <View style={styles.conceptPreviewMetaRow}>
                                            <View style={styles.rankPill}>
                                                <Text style={styles.rankPillText}>{currentRankStr}</Text>
                                            </View>
                                            <View style={[styles.previewTrackBadge, currentIdea.isSeries ? styles.trackSeries : styles.trackStandalone]}>
                                                <Ionicons
                                                    name={currentIdea.isSeries ? 'layers-outline' : 'disc-outline'}
                                                    size={10}
                                                    color={currentIdea.isSeries ? colors.sandstone : colors.bone.muted}
                                                />
                                                <Text
                                                    style={[styles.previewTrackText, currentIdea.isSeries ? styles.trackSeriesText : styles.trackStandaloneText]}
                                                    numberOfLines={1}
                                                    ellipsizeMode="tail"
                                                >
                                                    {currentIdea.series}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Reorder Controls (Only if queue has > 1 items) */}
                                    {ideas.length > 1 && (
                                        <View style={{ gap: 8 }}>
                                            <Text style={styles.fieldLabel}>REORDER QUEUE POSITION</Text>

                                            {/* Stepper Buttons */}
                                            <View style={styles.reorderStepRow}>
                                                <TouchableOpacity
                                                    style={[
                                                        styles.reorderStepBtn,
                                                        selectedActionIndex === 0 && styles.reorderStepBtnDisabled,
                                                    ]}
                                                    disabled={selectedActionIndex === 0}
                                                    onPress={() => {
                                                        const target = selectedActionIndex - 1;
                                                        handleMoveIdea(selectedActionIndex, target);
                                                        setSelectedActionIndex(target);
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons
                                                        name="arrow-up"
                                                        size={15}
                                                        color={selectedActionIndex === 0 ? colors.obsidian[700] : colors.sandstone}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.reorderStepBtnText,
                                                            selectedActionIndex === 0 && styles.reorderStepBtnTextDisabled,
                                                        ]}
                                                    >
                                                        Move Up 1 Spot
                                                    </Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[
                                                        styles.reorderStepBtn,
                                                        selectedActionIndex === ideas.length - 1 && styles.reorderStepBtnDisabled,
                                                    ]}
                                                    disabled={selectedActionIndex === ideas.length - 1}
                                                    onPress={() => {
                                                        const target = selectedActionIndex + 1;
                                                        handleMoveIdea(selectedActionIndex, target);
                                                        setSelectedActionIndex(target);
                                                    }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons
                                                        name="arrow-down"
                                                        size={15}
                                                        color={selectedActionIndex === ideas.length - 1 ? colors.obsidian[700] : colors.sandstone}
                                                    />
                                                    <Text
                                                        style={[
                                                            styles.reorderStepBtnText,
                                                            selectedActionIndex === ideas.length - 1 && styles.reorderStepBtnTextDisabled,
                                                        ]}
                                                    >
                                                        Move Down 1 Spot
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>

                                            {/* Direct Jump Horizontal Chips */}
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                contentContainerStyle={styles.positionGrid}
                                            >
                                                {ideas.map((_, targetIdx) => {
                                                    const isCurrent = targetIdx === selectedActionIndex;
                                                    const label = targetIdx === 0 ? '#01 (Next)' : `#${targetIdx + 1 < 10 ? '0' : ''}${targetIdx + 1}`;

                                                    return (
                                                        <TouchableOpacity
                                                            key={targetIdx}
                                                            style={[
                                                                styles.positionChip,
                                                                isCurrent && styles.positionChipCurrent,
                                                            ]}
                                                            onPress={() => {
                                                                if (!isCurrent) {
                                                                    handleMoveIdea(selectedActionIndex, targetIdx);
                                                                    setSelectedActionIndex(targetIdx);
                                                                }
                                                            }}
                                                            disabled={isCurrent}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.positionChipText,
                                                                    isCurrent && styles.positionChipTextCurrent,
                                                                ]}
                                                            >
                                                                {label}
                                                            </Text>
                                                            {isCurrent && (
                                                                <Text style={styles.positionChipSub}>Current</Text>
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* Action Buttons: Fast-Track, Edit, Remove */}
                                    <View style={styles.conceptActionsList}>
                                        {selectedActionIndex !== 0 && (
                                            <TouchableOpacity
                                                style={styles.actionRowBtn}
                                                onPress={() => {
                                                    const idx = selectedActionIndex;
                                                    handleMoveIdea(idx, 0);
                                                    setSelectedActionIndex(0);
                                                }}
                                                activeOpacity={0.75}
                                            >
                                                <View style={[styles.actionRowIconBox, { backgroundColor: 'rgba(200, 178, 155, 0.15)' }]}>
                                                    <Ionicons name="flash" size={16} color={colors.sandstone} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.actionRowTitle}>Fast-Track to #1</Text>
                                                    <Text style={styles.actionRowSub}>Set as immediate next video to produce</Text>
                                                </View>
                                                <Ionicons name="chevron-forward" size={14} color={colors.bone.muted} />
                                            </TouchableOpacity>
                                        )}

                                        <TouchableOpacity
                                            style={styles.actionRowBtn}
                                            onPress={() => {
                                                const idx = selectedActionIndex;
                                                const raw = ideas[idx];
                                                setSelectedActionIndex(null);
                                                openEditModal(idx, raw);
                                            }}
                                            activeOpacity={0.75}
                                        >
                                            <View style={[styles.actionRowIconBox, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}>
                                                <Ionicons name="pencil-outline" size={16} color={colors.bone.DEFAULT} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.actionRowTitle}>Edit Concept</Text>
                                                <Text style={styles.actionRowSub}>Modify title, series assignment, or notes</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color={colors.bone.muted} />
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.actionRowBtn, styles.actionRowBtnDanger]}
                                            onPress={() => {
                                                const idx = selectedActionIndex;
                                                setSelectedActionIndex(null);
                                                handleDelete(idx);
                                            }}
                                            activeOpacity={0.75}
                                        >
                                            <View style={[styles.actionRowIconBox, { backgroundColor: 'rgba(244, 63, 94, 0.12)' }]}>
                                                <Ionicons name="trash-outline" size={16} color={colors.failed} />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.actionRowTitle, { color: colors.failed }]}>Remove from Queue</Text>
                                                <Text style={styles.actionRowSub}>Delete concept from production queue</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color={colors.failed} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Custom Alert Dialog */}
            <CustomAlert
                visible={alertConfig.visible}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                buttons={alertConfig.buttons}
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
        paddingBottom: 110,
        gap: 14,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.4,
    },
    headerSubtitle: {
        fontSize: 11,
        color: colors.bone.muted,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.sandstone,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
    },
    addBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    clearBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.obsidian[900],
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        gap: 10,
        marginTop: 10,
    },
    emptyIconBox: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(200, 178, 155, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: 12,
        color: colors.bone.muted,
        textAlign: 'center',
        lineHeight: 18,
    },
    emptyCta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.sandstone,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        marginTop: 8,
    },
    emptyCtaText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    spotlightCard: {
        backgroundColor: colors.obsidian[900],
        borderWidth: 1.5,
        borderColor: 'rgba(200, 178, 155, 0.38)',
        borderRadius: 14,
        padding: 16,
        gap: 11,
        shadowColor: colors.sandstone,
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
    },
    spotlightTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    spotlightBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(200, 178, 155, 0.15)',
        paddingHorizontal: 9,
        paddingVertical: 3.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.35)',
    },
    pulseDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.sandstone,
    },
    spotlightBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.sandstone,
        letterSpacing: 0.5,
    },
    spotlightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    spotlightIconBtn: {
        width: 28,
        height: 28,
        borderRadius: 6,
        backgroundColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    spotlightTitle: {
        fontSize: 16.5,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        lineHeight: 23,
        letterSpacing: -0.2,
    },
    spotlightMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        rowGap: 8,
        flexWrap: 'wrap',
        marginTop: 2,
    },
    trackBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8.5,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        maxWidth: '75%',
        flexShrink: 1,
        alignSelf: 'flex-start',
    },
    trackSeries: {
        backgroundColor: 'rgba(200, 178, 155, 0.1)',
        borderColor: 'rgba(200, 178, 155, 0.25)',
    },
    trackStandalone: {
        backgroundColor: colors.obsidian[800],
        borderColor: colors.obsidian[700],
    },
    trackBadgeText: {
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.2,
        flexShrink: 1,
    },
    trackSeriesText: {
        color: colors.sandstone,
    },
    trackStandaloneText: {
        color: colors.bone.muted,
    },
    readyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4.5,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        alignSelf: 'flex-start',
        flexShrink: 0,
    },
    readyBadgeText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#10B981',
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
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
    queueSection: {
        gap: 10,
    },
    queueSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingHorizontal: 2,
    },
    queueSectionTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.bone.muted,
        letterSpacing: 1,
    },
    queueSectionCount: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    singleItemNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.obsidian[900],
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    singleItemNoteText: {
        fontSize: 11,
        color: colors.bone.muted,
        flex: 1,
        lineHeight: 16,
    },
    queueCard: {
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    queueCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 10,
    },
    rankPill: {
        backgroundColor: colors.obsidian[800],
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
    },
    rankPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.sandstone,
    },
    queueCardBody: {
        flex: 1,
        gap: 5,
    },
    queueCardTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
        lineHeight: 18,
    },
    queueCardMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    miniTrackBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1,
        alignSelf: 'flex-start',
        maxWidth: '100%',
    },
    miniTrackText: {
        fontSize: 8.5,
        fontWeight: '700',
        flexShrink: 1,
    },
    cardMenuBtn: {
        width: 30,
        height: 30,
        borderRadius: 7,
        backgroundColor: colors.obsidian[800],
        alignItems: 'center',
        justifyContent: 'center',
    },
    toastContainer: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.4)',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 6,
    },
    toastText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: colors.obsidian[900],
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.obsidian[700],
        padding: spacing.lg,
        maxHeight: '85%',
        gap: 12,
    },
    sheetHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.obsidian[700],
        alignSelf: 'center',
        marginBottom: 4,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.3,
    },
    sheetSubtitle: {
        fontSize: 11,
        color: colors.bone.muted,
        marginTop: 2,
    },
    sheetCloseBtn: {
        padding: 4,
    },
    fieldLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: colors.sandstone,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    inputArea: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        padding: 10,
        color: colors.bone.DEFAULT,
        fontSize: 12,
        minHeight: 50,
        textAlignVertical: 'top',
    },
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    dropdownValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    dropdownValueText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.bone.DEFAULT,
    },
    dropdownBox: {
        marginTop: 6,
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    dropdownItem: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.obsidian[850],
    },
    dropdownItemActive: {
        backgroundColor: 'rgba(200, 178, 155, 0.1)',
    },
    dropdownItemText: {
        fontSize: 11.5,
        color: colors.bone.muted,
    },
    dropdownItemTextActive: {
        color: colors.sandstone,
        fontWeight: '700',
    },
    placementTabs: {
        flexDirection: 'row',
        gap: 10,
    },
    placementTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    placementTabActive: {
        backgroundColor: colors.sandstone,
        borderColor: colors.sandstone,
    },
    placementTextCol: {
        flex: 1,
    },
    placementTabTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    placementTabTitleActive: {
        color: colors.obsidian[950],
        fontWeight: '800',
    },
    placementTabSub: {
        fontSize: 10,
        color: colors.bone.muted,
        marginTop: 1,
    },
    placementTabSubActive: {
        color: 'rgba(10, 10, 11, 0.75)',
        fontWeight: '600',
    },
    sheetSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.sandstone,
        borderRadius: borderRadius.md,
        paddingVertical: 14,
        marginTop: 8,
    },
    sheetSubmitText: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    conceptPreviewBox: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        padding: 12,
        borderRadius: borderRadius.md,
        gap: 8,
        overflow: 'hidden',
    },
    conceptPreviewTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
        lineHeight: 20,
    },
    conceptPreviewMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        rowGap: 6,
    },
    previewTrackBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        maxWidth: '78%',
        flexShrink: 1,
        alignSelf: 'flex-start',
    },
    previewTrackText: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.2,
        flexShrink: 1,
    },
    reorderStepRow: {
        flexDirection: 'row',
        gap: 10,
    },
    reorderStepBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        paddingVertical: 11,
    },
    reorderStepBtnDisabled: {
        opacity: 0.35,
    },
    reorderStepBtnText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    reorderStepBtnTextDisabled: {
        color: colors.bone.muted,
    },
    positionGrid: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 4,
    },
    positionChip: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        paddingHorizontal: 14,
        paddingVertical: 9,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 70,
    },
    positionChipCurrent: {
        backgroundColor: 'rgba(200, 178, 155, 0.15)',
        borderColor: colors.sandstone,
    },
    positionChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    positionChipTextCurrent: {
        color: colors.sandstone,
        fontWeight: '800',
    },
    positionChipSub: {
        fontSize: 9,
        color: colors.sandstone,
        fontWeight: '600',
        marginTop: 2,
    },
    conceptActionsList: {
        flexDirection: 'column',
        gap: 8,
        marginTop: 4,
    },
    actionRowBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        paddingHorizontal: 12,
        paddingVertical: 11,
        borderRadius: borderRadius.md,
    },
    actionRowBtnDanger: {
        borderColor: 'rgba(244, 63, 94, 0.25)',
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
    },
    actionRowIconBox: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionRowTitle: {
        fontSize: 12.5,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    actionRowSub: {
        fontSize: 10,
        color: colors.bone.muted,
        marginTop: 1,
    },
});
