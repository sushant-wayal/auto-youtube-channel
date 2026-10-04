import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Animated,
    ActivityIndicator,
    TextInput,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsApi, commentsApi, CustomArchetype } from '../services/api';
import { colors, spacing, borderRadius, typography } from '../theme';

type CommentMode = 'live' | 'dry_run' | 'paused';

const BUILTIN_ARCHETYPES = [
    {
        id: 'split_comparison',
        label: 'Split Comparison',
        subtitle: 'Before vs After / Old vs New duality',
        icon: 'git-compare-outline' as const,
    },
    {
        id: 'code_terminal_bug',
        label: 'Code Terminal',
        subtitle: 'Dark IDE + Glowing Highlights',
        icon: 'terminal-outline' as const,
    },
    {
        id: 'metric_showdown',
        label: 'Metric Showdown',
        subtitle: '10x vs 1x / Visual Graph Battle',
        icon: 'trending-up-outline' as const,
    },
    {
        id: 'cinematic_focal_hero',
        label: 'Cinematic Hero',
        subtitle: 'Focal Graphic + Depth Backdrop',
        icon: 'sparkles-outline' as const,
    },
];

export default function SettingsScreen() {
    const [voiceoverProvider, setVoiceoverProvider] = useState<'gemini' | 'f5'>('f5');
    const [sceneRenderMethod, setSceneRenderMethod] = useState<'code' | 'ai'>('ai');
    const [commentMode, setCommentMode] = useState<CommentMode>('live');

    // Thumbnail Engine (Ask Studio) Settings
    const [thumbnailPrimaryArchetype, setThumbnailPrimaryArchetype] = useState<string>('split_comparison');
    const [thumbnailVariationsEnabled, setThumbnailVariationsEnabled] = useState<boolean>(true);
    const [thumbnailActiveArchetypes, setThumbnailActiveArchetypes] = useState<string[]>([
        'split_comparison',
        'code_terminal_bug',
        'metric_showdown',
        'cinematic_focal_hero',
    ]);
    const [thumbnailCustomArchetypes, setThumbnailCustomArchetypes] = useState<CustomArchetype[]>([]);
    const [thumbnailSectionExpanded, setThumbnailSectionExpanded] = useState<boolean>(false);

    // Custom Archetype Modal
    const [showAddCustomModal, setShowAddCustomModal] = useState(false);
    const [customLabel, setCustomLabel] = useState('');
    const [customPromptHint, setCustomPromptHint] = useState('');

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    const showToast = (msg: string) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2000),
            Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setToastMessage(null));
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const [settingsRes, commentsRes] = await Promise.all([
                settingsApi.getSettings(),
                commentsApi.getSettings(),
            ]);

            if (settingsRes.ok) {
                if (settingsRes.voiceoverProvider) setVoiceoverProvider(settingsRes.voiceoverProvider);
                if (settingsRes.sceneRenderMethod) setSceneRenderMethod(settingsRes.sceneRenderMethod);
                if (settingsRes.thumbnailPrimaryArchetype) setThumbnailPrimaryArchetype(settingsRes.thumbnailPrimaryArchetype);
                if (typeof settingsRes.thumbnailVariationsEnabled === 'boolean') {
                    setThumbnailVariationsEnabled(settingsRes.thumbnailVariationsEnabled);
                }
                if (Array.isArray(settingsRes.thumbnailActiveArchetypes) && settingsRes.thumbnailActiveArchetypes.length > 0) {
                    setThumbnailActiveArchetypes(settingsRes.thumbnailActiveArchetypes);
                }
                if (Array.isArray(settingsRes.thumbnailCustomArchetypes)) {
                    setThumbnailCustomArchetypes(settingsRes.thumbnailCustomArchetypes);
                }
            }

            if (commentsRes.ok && commentsRes.settings) {
                if (!commentsRes.settings.enabled) {
                    setCommentMode('paused');
                } else if (commentsRes.settings.dryRun) {
                    setCommentMode('dry_run');
                } else {
                    setCommentMode('live');
                }
            }
        } catch {
            // Keep current states
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadSettings();
        setRefreshing(false);
    };

    const handleRevertDefaults = () => {
        setVoiceoverProvider('f5');
        setSceneRenderMethod('code');
        setCommentMode('live');
        setThumbnailPrimaryArchetype('split_comparison');
        setThumbnailVariationsEnabled(true);
        setThumbnailActiveArchetypes([
            'split_comparison',
            'code_terminal_bug',
            'metric_showdown',
            'cinematic_focal_hero',
        ]);
        showToast('Settings reset to defaults');
    };

    const toggleActiveArchetype = (id: string) => {
        if (thumbnailActiveArchetypes.includes(id)) {
            if (thumbnailActiveArchetypes.length <= 1) {
                showToast('At least 1 active archetype is required');
                return;
            }
            const updated = thumbnailActiveArchetypes.filter(a => a !== id);
            setThumbnailActiveArchetypes(updated);
            if (thumbnailPrimaryArchetype === id) {
                setThumbnailPrimaryArchetype(updated[0]);
            }
        } else {
            // Max 4 constraint
            if (thumbnailActiveArchetypes.length >= 4) {
                showToast('Constraint: Maximum 4 active archetypes allowed');
                return;
            }
            setThumbnailActiveArchetypes([...thumbnailActiveArchetypes, id]);
        }
    };

    const selectPrimaryArchetype = (id: string) => {
        setThumbnailPrimaryArchetype(id);
        // Ensure primary is also in active archetypes
        if (!thumbnailActiveArchetypes.includes(id)) {
            if (thumbnailActiveArchetypes.length < 4) {
                setThumbnailActiveArchetypes([...thumbnailActiveArchetypes, id]);
            } else {
                // Replace the last one
                const updated = [...thumbnailActiveArchetypes.slice(0, 3), id];
                setThumbnailActiveArchetypes(updated);
            }
        }
    };

    const handleAddCustomArchetype = () => {
        const trimmed = customLabel.trim();
        if (!trimmed) {
            showToast('Please enter an archetype name');
            return;
        }
        const newId = `custom_${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
        const newCustom: CustomArchetype = {
            id: newId,
            label: trimmed,
            promptHint: customPromptHint.trim() || undefined,
        };

        const updated = [...thumbnailCustomArchetypes, newCustom];
        setThumbnailCustomArchetypes(updated);

        // Auto-activate if less than 4
        if (thumbnailActiveArchetypes.length < 4) {
            setThumbnailActiveArchetypes([...thumbnailActiveArchetypes, newId]);
        }

        setCustomLabel('');
        setCustomPromptHint('');
        setShowAddCustomModal(false);
        showToast(`Added archetype "${trimmed}"`);
    };

    const handleDeleteCustomArchetype = (id: string) => {
        const updatedCustom = thumbnailCustomArchetypes.filter(c => c.id !== id);
        setThumbnailCustomArchetypes(updatedCustom);
        const updatedActive = thumbnailActiveArchetypes.filter(a => a !== id);
        setThumbnailActiveArchetypes(updatedActive.length > 0 ? updatedActive : ['split_comparison']);
        if (thumbnailPrimaryArchetype === id) {
            setThumbnailPrimaryArchetype('split_comparison');
        }
        showToast('Custom archetype removed');
    };

    const handleSaveConfiguration = async () => {
        setSaving(true);
        try {
            const isCommentsEnabled = commentMode !== 'paused';
            const isCommentsDryRun = commentMode === 'dry_run';

            const [settingsRes, commentsRes] = await Promise.all([
                settingsApi.updateSettings({
                    voiceoverProvider,
                    sceneRenderMethod,
                    thumbnailPrimaryArchetype,
                    thumbnailVariationsEnabled,
                    thumbnailActiveArchetypes,
                    thumbnailCustomArchetypes,
                }),
                commentsApi.updateSettings({
                    enabled: isCommentsEnabled,
                    dryRun: isCommentsDryRun,
                }),
            ]);

            if (settingsRes.ok && commentsRes.ok) {
                showToast('Settings saved successfully!');
            } else {
                showToast('Settings applied locally');
            }
        } catch {
            showToast('Settings updated locally');
        } finally {
            setSaving(false);
        }
    };

    // Combine built-in and custom archetypes for display
    const allArchetypes = [
        ...BUILTIN_ARCHETYPES.map(b => ({ ...b, isCustom: false })),
        ...thumbnailCustomArchetypes.map(c => ({
            id: c.id,
            label: c.label,
            subtitle: c.promptHint || 'Custom AI generative design',
            icon: 'brush-outline' as const,
            isCustom: true,
        })),
    ];

    return (
        <View style={styles.screen}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.sandstone}
                    />
                }
            >
                {/* Settings Content Group */}
                <View style={styles.contentGroup}>
                    {/* Sub-Header */}
                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.title}>Pipeline Preferences</Text>
                            <Text style={styles.subtitle}>Generation engine and comment modes</Text>
                        </View>
                        <TouchableOpacity
                            onPress={handleRevertDefaults}
                            style={styles.resetBtn}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="refresh" size={13} color={colors.sandstone} />
                            <Text style={styles.resetBtnText}>Reset</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Setting 1: Voiceover Engine */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="mic-outline" size={16} color={colors.sandstone} />
                            <Text style={styles.cardLabel}>Voiceover Provider</Text>
                        </View>
                        <View style={styles.segmentedRow}>
                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    voiceoverProvider === 'f5' && styles.segmentActive,
                                ]}
                                onPress={() => setVoiceoverProvider('f5')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="hardware-chip-outline"
                                    size={14}
                                    color={voiceoverProvider === 'f5' ? colors.obsidian[950] : colors.bone.muted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        voiceoverProvider === 'f5' && styles.segmentTextActive,
                                    ]}
                                >
                                    F5 TTS (Local)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    voiceoverProvider === 'gemini' && styles.segmentActive,
                                ]}
                                onPress={() => setVoiceoverProvider('gemini')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="sparkles-outline"
                                    size={14}
                                    color={voiceoverProvider === 'gemini' ? colors.obsidian[950] : colors.bone.muted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        voiceoverProvider === 'gemini' && styles.segmentTextActive,
                                    ]}
                                >
                                    Gemini (Cloud)
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Setting 2: Scene Render Method */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="film-outline" size={16} color={colors.sandstone} />
                            <Text style={styles.cardLabel}>Scene Render Method</Text>
                        </View>
                        <View style={styles.segmentedRow}>
                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    sceneRenderMethod === 'code' && styles.segmentActive,
                                ]}
                                onPress={() => setSceneRenderMethod('code')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="code-slash-outline"
                                    size={14}
                                    color={sceneRenderMethod === 'code' ? colors.obsidian[950] : colors.bone.muted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        sceneRenderMethod === 'code' && styles.segmentTextActive,
                                    ]}
                                >
                                    Code (Deterministic)
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    sceneRenderMethod === 'ai' && styles.segmentActive,
                                ]}
                                onPress={() => setSceneRenderMethod('ai')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="color-palette-outline"
                                    size={14}
                                    color={sceneRenderMethod === 'ai' ? colors.obsidian[950] : colors.bone.muted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        sceneRenderMethod === 'ai' && styles.segmentTextActive,
                                    ]}
                                >
                                    AI Generative
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Setting 3: Thumbnail Variations & Archetypes */}
                    <View style={styles.card}>
                        <View style={styles.cardHeaderBetween}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="image-outline" size={16} color={colors.sandstone} />
                                <Text style={styles.cardLabel}>Thumbnail Variations</Text>
                            </View>
                            <View style={styles.miniSegmentedRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.miniSegment,
                                        thumbnailVariationsEnabled && styles.segmentActive,
                                    ]}
                                    onPress={() => setThumbnailVariationsEnabled(true)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.miniSegmentText,
                                            thumbnailVariationsEnabled && styles.segmentTextActive,
                                        ]}
                                    >
                                        ON
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.miniSegment,
                                        !thumbnailVariationsEnabled && styles.segmentActivePaused,
                                    ]}
                                    onPress={() => setThumbnailVariationsEnabled(false)}
                                    activeOpacity={0.8}
                                >
                                    <Text
                                        style={[
                                            styles.miniSegmentText,
                                            !thumbnailVariationsEnabled && styles.segmentTextActiveWhite,
                                        ]}
                                    >
                                        OFF
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Archetypes Expand/Collapse Bar */}
                        <TouchableOpacity
                            style={styles.archetypesToggleRow}
                            onPress={() => setThumbnailSectionExpanded(!thumbnailSectionExpanded)}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.archetypesToggleTitle}>Active Archetypes</Text>
                                <View style={[
                                    styles.countBadge,
                                    thumbnailActiveArchetypes.length === 4 && styles.countBadgeFull,
                                ]}>
                                    <Text style={styles.countBadgeText}>{thumbnailActiveArchetypes.length}/4</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text style={styles.archetypesToggleAction}>
                                    {thumbnailSectionExpanded ? 'Hide' : 'Configure'}
                                </Text>
                                <Ionicons
                                    name={thumbnailSectionExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={14}
                                    color={colors.sandstone}
                                />
                            </View>
                        </TouchableOpacity>

                        {thumbnailSectionExpanded && (
                            <>

                        {/* Sub-setting: Primary Archetype */}
                        <View style={styles.subCard}>
                            <View style={styles.subCardHeader}>
                                <Text style={styles.subCardTitle}>Primary Archetype</Text>
                            </View>
                            <View style={styles.archetypeGrid}>
                                {allArchetypes.map(item => {
                                    const isPrimary = thumbnailPrimaryArchetype === item.id;
                                    return (
                                        <TouchableOpacity
                                            key={`primary_${item.id}`}
                                            style={[
                                                styles.archetypeCard,
                                                isPrimary && styles.archetypeCardSelected,
                                            ]}
                                            onPress={() => selectPrimaryArchetype(item.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.archetypeCardHeader}>
                                                <Ionicons
                                                    name={item.icon}
                                                    size={14}
                                                    color={isPrimary ? colors.sandstone : colors.bone.muted}
                                                />
                                                {isPrimary && (
                                                    <View style={styles.primaryPill}>
                                                        <Text style={styles.primaryPillText}>PRIMARY</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text
                                                style={[
                                                    styles.archetypeTitle,
                                                    isPrimary && styles.archetypeTitleSelected,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {item.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Sub-setting: Active Archetypes (Max 4 Constraint) */}
                        <View style={styles.subCard}>
                            <View style={styles.subCardHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.subCardTitle}>Active Archetypes</Text>
                                    <View style={[
                                        styles.countBadge,
                                        thumbnailActiveArchetypes.length === 4 && styles.countBadgeFull,
                                    ]}>
                                        <Text style={styles.countBadgeText}>
                                            {thumbnailActiveArchetypes.length}/4
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    style={styles.addCustomBtn}
                                    onPress={() => setShowAddCustomModal(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add" size={13} color={colors.sandstone} />
                                    <Text style={styles.addCustomBtnText}>Custom</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.activeArchetypeList}>
                                {allArchetypes.map(item => {
                                    const isActive = thumbnailActiveArchetypes.includes(item.id);
                                    const isPrimary = thumbnailPrimaryArchetype === item.id;
                                    return (
                                        <View
                                            key={`active_${item.id}`}
                                            style={[
                                                styles.archetypeRow,
                                                isActive && styles.archetypeRowActive,
                                            ]}
                                        >
                                            <TouchableOpacity
                                                style={styles.archetypeRowLeft}
                                                onPress={() => toggleActiveArchetype(item.id)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons
                                                    name={isActive ? 'checkbox' : 'square-outline'}
                                                    size={16}
                                                    color={isActive ? colors.sandstone : colors.bone.muted}
                                                />
                                                <Text
                                                    style={[
                                                        styles.archetypeRowName,
                                                        isActive && styles.archetypeRowNameActive,
                                                    ]}
                                                >
                                                    {item.label}
                                                </Text>
                                                {isPrimary && (
                                                    <View style={styles.primaryMiniPill}>
                                                        <Text style={styles.primaryMiniPillText}>PRIMARY</Text>
                                                    </View>
                                                )}
                                                {item.isCustom && (
                                                    <View style={styles.customPill}>
                                                        <Text style={styles.customPillText}>CUSTOM</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>

                                            {item.isCustom && (
                                                <TouchableOpacity
                                                    onPress={() => handleDeleteCustomArchetype(item.id)}
                                                    style={styles.deleteCustomBtn}
                                                    activeOpacity={0.7}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                        </>
                    )}
                    </View>

                    {/* Setting 4: Auto Comment Reply Mode */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="chatbubbles-outline" size={16} color={colors.sandstone} />
                            <Text style={styles.cardLabel}>Auto Comment Reply</Text>
                        </View>
                        <View style={styles.segmentedRow}>
                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    commentMode === 'live' && styles.segmentActiveLive,
                                ]}
                                onPress={() => setCommentMode('live')}
                                activeOpacity={0.8}
                            >
                                <View
                                    style={[
                                        styles.dot,
                                        { backgroundColor: commentMode === 'live' ? colors.obsidian[950] : '#10B981' },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        commentMode === 'live' && styles.segmentTextActive,
                                    ]}
                                >
                                    Live
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    commentMode === 'dry_run' && styles.segmentActive,
                                ]}
                                onPress={() => setCommentMode('dry_run')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="flask-outline"
                                    size={13}
                                    color={commentMode === 'dry_run' ? colors.obsidian[950] : colors.bone.muted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        commentMode === 'dry_run' && styles.segmentTextActive,
                                    ]}
                                >
                                    Dry-Run
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.segment,
                                    commentMode === 'paused' && styles.segmentActivePaused,
                                ]}
                                onPress={() => setCommentMode('paused')}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name="pause-circle-outline"
                                    size={13}
                                    color={commentMode === 'paused' ? colors.bone.DEFAULT : colors.bone.muted}
                                />
                                <Text
                                    style={[
                                        styles.segmentText,
                                        commentMode === 'paused' && styles.segmentTextActiveWhite,
                                    ]}
                                >
                                    Paused
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Bottom Footer Anchor */}
                <View style={styles.bottomFooter}>
                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSaveConfiguration}
                        disabled={saving}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color={colors.obsidian[950]} />
                        ) : (
                            <>
                                <Ionicons name="checkmark-sharp" size={17} color={colors.obsidian[950]} />
                                <Text style={styles.saveBtnText}>Save Settings</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Custom Archetype Modal */}
            <Modal
                visible={showAddCustomModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAddCustomModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="color-palette-outline" size={18} color={colors.sandstone} />
                                <Text style={styles.modalTitle}>Add Custom Archetype</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowAddCustomModal(false)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close" size={20} color={colors.bone.muted} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Archetype Name</Text>
                            <TextInput
                                style={styles.textInput}
                                placeholder="e.g. Blueprint, Matrix"
                                placeholderTextColor={colors.bone.muted}
                                value={customLabel}
                                onChangeText={setCustomLabel}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Visual Prompt (Optional)</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                placeholder="e.g. Dark glowing server racks with 3D isometric blueprints"
                                placeholderTextColor={colors.bone.muted}
                                value={customPromptHint}
                                onChangeText={setCustomPromptHint}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        <View style={styles.modalActionRow}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowAddCustomModal(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalSubmitBtn}
                                onPress={handleAddCustomArchetype}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add" size={16} color={colors.obsidian[950]} />
                                <Text style={styles.modalSubmitText}>Add Archetype</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Toast Feedback */}
            {toastMessage && (
                <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
                    <Ionicons name="checkmark-circle" size={15} color={colors.sandstone} />
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}
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
        flexGrow: 1,
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        paddingBottom: spacing.lg,
    },
    contentGroup: {
        gap: 12,
    },
    bottomFooter: {
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.4,
    },
    subtitle: {
        fontSize: 11,
        color: colors.bone.muted,
        marginTop: 2,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    resetBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.sandstone,
    },
    card: {
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        padding: 12,
        gap: 10,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardHeaderBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.2,
    },
    cardDescription: {
        fontSize: 11,
        color: colors.bone.muted,
        lineHeight: 15,
        marginTop: -4,
    },
    badgeStudio: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        backgroundColor: 'rgba(200, 178, 155, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.3)',
    },
    badgeStudioText: {
        fontSize: 9,
        fontWeight: '700',
        color: colors.sandstone,
    },
    subCard: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.sm,
        padding: 10,
        gap: 8,
    },
    subCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    archetypesToggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.xs,
        paddingHorizontal: 10,
        paddingVertical: 9,
    },
    archetypesToggleTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    archetypesToggleAction: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.sandstone,
    },
    subCardTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    subCardSubtitle: {
        fontSize: 10,
        color: colors.bone.muted,
        marginTop: 1,
    },
    miniSegmentedRow: {
        flexDirection: 'row',
        backgroundColor: colors.obsidian[900],
        borderRadius: borderRadius.xs,
        padding: 2,
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    miniSegment: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.xs - 1,
    },
    miniSegmentText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.bone.muted,
    },
    archetypeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    archetypeCard: {
        width: '48.5%',
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.xs,
        padding: 8,
        gap: 4,
    },
    archetypeCardSelected: {
        borderColor: colors.sandstone,
        backgroundColor: 'rgba(200, 178, 155, 0.08)',
    },
    archetypeCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    primaryPill: {
        backgroundColor: colors.sandstone,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    primaryPillText: {
        fontSize: 7,
        fontWeight: '900',
        color: colors.obsidian[950],
    },
    archetypeTitle: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    archetypeTitleSelected: {
        color: colors.sandstone,
        fontWeight: '800',
    },
    countBadge: {
        backgroundColor: colors.obsidian[900],
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    countBadgeFull: {
        borderColor: colors.sandstone,
        backgroundColor: 'rgba(200, 178, 155, 0.15)',
    },
    countBadgeText: {
        fontSize: 9,
        fontWeight: '700',
        color: colors.sandstone,
    },
    addCustomBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: 'rgba(200, 178, 155, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(200, 178, 155, 0.3)',
    },
    addCustomBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.sandstone,
    },
    activeArchetypeList: {
        gap: 6,
    },
    archetypeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.xs,
        padding: 8,
    },
    archetypeRowActive: {
        borderColor: 'rgba(200, 178, 155, 0.4)',
        backgroundColor: 'rgba(200, 178, 155, 0.04)',
    },
    archetypeRowLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    archetypeRowName: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    archetypeRowNameActive: {
        color: colors.bone.DEFAULT,
        fontWeight: '700',
    },
    primaryMiniPill: {
        backgroundColor: colors.sandstone,
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    primaryMiniPillText: {
        fontSize: 7,
        fontWeight: '900',
        color: colors.obsidian[950],
    },
    customPill: {
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    customPillText: {
        fontSize: 7,
        fontWeight: '800',
        color: '#C084FC',
    },
    archetypeRowSubtitle: {
        fontSize: 9,
        color: colors.bone.muted,
        marginTop: 1,
    },
    deleteCustomBtn: {
        padding: 4,
        marginLeft: 6,
    },
    segmentedRow: {
        flexDirection: 'row',
        backgroundColor: colors.obsidian[950],
        borderRadius: borderRadius.sm,
        padding: 3,
        gap: 4,
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    segment: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: borderRadius.sm - 2,
    },
    segmentActive: {
        backgroundColor: colors.sandstone,
    },
    segmentActiveLive: {
        backgroundColor: '#10B981',
    },
    segmentActivePaused: {
        backgroundColor: colors.obsidian[800],
    },
    segmentText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    segmentTextActive: {
        color: colors.obsidian[950],
        fontWeight: '800',
    },
    segmentTextActiveWhite: {
        color: colors.bone.DEFAULT,
        fontWeight: '800',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    saveBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.sandstone,
        borderRadius: borderRadius.md,
        paddingVertical: 14,
        marginTop: 6,
        shadowColor: colors.sandstone,
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    saveBtnText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.obsidian[950],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.md,
        padding: spacing.md,
        gap: 12,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.bone.DEFAULT,
    },
    modalSubtitle: {
        fontSize: 11,
        color: colors.bone.muted,
        marginTop: -4,
    },
    inputGroup: {
        gap: 4,
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
    },
    textInput: {
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
        borderRadius: borderRadius.xs,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: colors.bone.DEFAULT,
        fontSize: 12,
    },
    textArea: {
        minHeight: 60,
        textAlignVertical: 'top',
    },
    modalActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 4,
    },
    modalCancelBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.obsidian[950],
        borderWidth: 1,
        borderColor: colors.obsidian[800],
    },
    modalCancelText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.bone.muted,
    },
    modalSubmitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.sandstone,
    },
    modalSubmitText: {
        fontSize: 12,
        fontWeight: '800',
        color: colors.obsidian[950],
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
});
