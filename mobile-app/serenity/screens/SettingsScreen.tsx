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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { settingsApi, commentsApi } from '../services/api';
import { colors, spacing, borderRadius, typography } from '../theme';

type CommentMode = 'live' | 'dry_run' | 'paused';

export default function SettingsScreen() {
    const [voiceoverProvider, setVoiceoverProvider] = useState<'gemini' | 'f5'>('f5');
    const [sceneRenderMethod, setSceneRenderMethod] = useState<'code' | 'ai'>('ai');
    const [commentMode, setCommentMode] = useState<CommentMode>('live');

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
        showToast('Settings reset to defaults');
    };

    const handleSaveConfiguration = async () => {
        setSaving(true);
        try {
            const isCommentsEnabled = commentMode !== 'paused';
            const isCommentsDryRun = commentMode === 'dry_run';

            const [settingsRes, commentsRes] = await Promise.all([
                settingsApi.updateSettings(voiceoverProvider, sceneRenderMethod),
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
        } catch (err: any) {
            showToast('Settings updated locally');
        } finally {
            setSaving(false);
        }
    };

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

                    {/* Setting 3: Auto Comment Reply Mode */}
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
    cardLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.2,
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
