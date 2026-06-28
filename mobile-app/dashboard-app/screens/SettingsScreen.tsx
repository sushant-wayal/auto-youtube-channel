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
    Platform,
    LayoutAnimation,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { settingsApi } from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import { colors, spacing, borderRadius, typography, shadows, gradients } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnim = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

type OptionButtonProps = {
    label: string;
    selected: boolean;
    onPress: () => void;
    icon: string;
    description: string;
    badge: string;
    disabled?: boolean;
};

function OptionButton({ label, selected, onPress, icon, description, badge, disabled }: OptionButtonProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.95,
            useNativeDriver: true,
            tension: 220,
            friction: 12,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 220,
            friction: 12,
        }).start();
    };

    return (
        <Animated.View style={[styles.optionCol, { transform: [{ scale }] }]}>
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                disabled={disabled}
                style={[
                    styles.optionButton,
                    selected ? styles.optionButtonActive : styles.optionButtonInactive,
                    disabled && styles.optionButtonDisabled,
                ]}
            >
                {selected && (
                    <LinearGradient
                        colors={['rgba(139, 92, 246, 0.18)', 'rgba(6, 182, 212, 0.08)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.sm - 1 }]}
                    />
                )}
                <View style={styles.optionContent}>
                    <View style={[styles.optionIcon, selected && styles.optionIconActive]}>
                        <Ionicons
                            name={icon as any}
                            size={20}
                            color={selected ? colors.gradientTo : colors.foregroundMuted}
                        />
                    </View>
                    <View style={styles.optionText}>
                        <View style={styles.optionHeader}>
                            <Text
                                style={[
                                    styles.optionLabel,
                                    selected ? styles.optionLabelActive : styles.optionLabelInactive,
                                ]}
                            >
                                {label}
                            </Text>
                            <View style={[styles.optionBadge, selected && styles.optionBadgeActive]}>
                                <Text style={[styles.optionBadgeText, selected && styles.optionBadgeTextActive]}>
                                    {badge}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.optionDescription}>{description}</Text>
                    </View>
                </View>

                {selected && (
                    <View style={styles.checkIndicator}>
                        <LinearGradient
                            colors={[colors.gradientFrom, colors.gradientTo]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[styles.checkIndicatorGrad, { borderRadius: 8 }]}
                        >
                            <Ionicons name="checkmark" size={10} color="#fff" />
                        </LinearGradient>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function SettingsScreen() {
    const [voiceoverProvider, setVoiceoverProvider] = useState<'gemini' | 'f5'>('f5');
    const [sceneRenderMethod, setSceneRenderMethod] = useState<'code' | 'ai'>('code');
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        if (successMsg) {
            Animated.sequence([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.delay(2000),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                })
            ]).start(() => {
                setSuccessMsg(null);
            });
        }
    }, [successMsg, fadeAnim]);

    const loadSettings = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await settingsApi.getSettings();
            if (response.ok && response.voiceoverProvider && response.sceneRenderMethod) {
                triggerLayoutAnim();
                setVoiceoverProvider(response.voiceoverProvider);
                setSceneRenderMethod(response.sceneRenderMethod);
            } else {
                setError(response.error || 'Failed to load settings');
            }
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        setError(null);
        try {
            const response = await settingsApi.getSettings();
            if (response.ok && response.voiceoverProvider && response.sceneRenderMethod) {
                triggerLayoutAnim();
                setVoiceoverProvider(response.voiceoverProvider);
                setSceneRenderMethod(response.sceneRenderMethod);
                showToast('Settings refreshed');
            } else {
                setError(response.error || 'Failed to refresh settings');
            }
        } catch (err: any) {
            setError(err.message || String(err));
        } finally {
            setRefreshing(false);
        }
    };

    const showToast = (msg: string) => {
        setSuccessMsg(msg);
    };

    const handleUpdateVoiceover = async (provider: 'gemini' | 'f5') => {
        if (updating || provider === voiceoverProvider) return;
        setUpdating(true);
        setError(null);
        const originalVal = voiceoverProvider;
        
        // Optimistic UI update
        triggerLayoutAnim();
        setVoiceoverProvider(provider);

        try {
            const response = await settingsApi.updateSettings(provider, sceneRenderMethod);
            if (response.ok && response.voiceoverProvider) {
                setVoiceoverProvider(response.voiceoverProvider);
                showToast(`Voiceover provider set to ${provider.toUpperCase()}`);
            } else {
                triggerLayoutAnim();
                setVoiceoverProvider(originalVal); // Revert
                setError(response.error || 'Failed to update setting');
            }
        } catch (err: any) {
            triggerLayoutAnim();
            setVoiceoverProvider(originalVal); // Revert
            setError(err.message || String(err));
        } finally {
            setUpdating(false);
        }
    };

    const handleUpdateRender = async (method: 'code' | 'ai') => {
        if (updating || method === sceneRenderMethod) return;
        setUpdating(true);
        setError(null);
        const originalVal = sceneRenderMethod;

        // Optimistic UI update
        triggerLayoutAnim();
        setSceneRenderMethod(method);

        try {
            const response = await settingsApi.updateSettings(voiceoverProvider, method);
            if (response.ok && response.sceneRenderMethod) {
                setSceneRenderMethod(response.sceneRenderMethod);
                showToast(`Scene render method set to ${method.toUpperCase()}`);
            } else {
                triggerLayoutAnim();
                setSceneRenderMethod(originalVal); // Revert
                setError(response.error || 'Failed to update setting');
            }
        } catch (err: any) {
            triggerLayoutAnim();
            setSceneRenderMethod(originalVal); // Revert
            setError(err.message || String(err));
        } finally {
            setUpdating(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Success Toast */}
            {successMsg && (
                <Animated.View style={[styles.toastContainer, { opacity: fadeAnim }]}>
                    <LinearGradient
                        colors={gradients.success}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.toastGradient}
                    >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                        <Text style={styles.toastText}>{successMsg}</Text>
                    </LinearGradient>
                </Animated.View>
            )}

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                        progressBackgroundColor={colors.backgroundSecondary}
                    />
                }
            >
                {/* Header section */}
                <View style={styles.header}>
                    <View style={styles.eyebrow}>
                        <Ionicons name="options-outline" size={13} color={colors.gradientTo} />
                        <Text style={styles.eyebrowText}>PIPELINE CONFIGURATION</Text>
                    </View>
                    <Text style={styles.headerTitle}>System Settings</Text>
                    <Text style={styles.headerSubtitle}>
                        Choose how Serenity generates scene voiceovers and renders visuals for every video.
                    </Text>
                </View>

                {error && <ErrorMessage message={error} />}

                {loading && !refreshing ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>Fetching system configuration...</Text>
                    </View>
                ) : (
                    <View style={styles.content}>
                        {/* Setting Box 1: Voiceover Provider */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderIcon}>
                                    <Ionicons name="mic-outline" size={20} color={colors.gradientTo} />
                                </View>
                                <View style={styles.cardHeaderText}>
                                    <Text style={styles.cardTitle}>Voiceover Provider</Text>
                                    <Text style={styles.cardSubtitle}>Choose the text-to-speech engine used for scene narration.</Text>
                                </View>
                            </View>

                            <View style={styles.optionsList}>
                                <OptionButton
                                    label="F5 TTS"
                                    icon="musical-notes-outline"
                                    badge="LOCAL"
                                    description="Runs the F5-TTS engine locally to generate the voiceover for each scene."
                                    selected={voiceoverProvider === 'f5'}
                                    onPress={() => handleUpdateVoiceover('f5')}
                                    disabled={updating}
                                />
                                <OptionButton
                                    label="Gemini TTS"
                                    icon="sparkles-outline"
                                    badge="CLOUD API"
                                    description="Uses the Gemini TTS API to generate each scene voiceover instead of generating it locally."
                                    selected={voiceoverProvider === 'gemini'}
                                    onPress={() => handleUpdateVoiceover('gemini')}
                                    disabled={updating}
                                />
                            </View>
                        </View>

                        {/* Setting Box 2: Scene Render Method */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <View style={styles.cardHeaderIcon}>
                                    <Ionicons name="videocam-outline" size={20} color={colors.gradientTo} />
                                </View>
                                <View style={styles.cardHeaderText}>
                                    <Text style={styles.cardTitle}>Scene Render Method</Text>
                                    <Text style={styles.cardSubtitle}>Choose how scene HTML is produced from Gemini output.</Text>
                                </View>
                            </View>

                            <View style={styles.optionsList}>
                                <OptionButton
                                    label="Code Render"
                                    icon="code-slash-outline"
                                    badge="DETERMINISTIC"
                                    description="Gemini returns a JSON scene configuration, then the pipeline deterministically converts it into HTML."
                                    selected={sceneRenderMethod === 'code'}
                                    onPress={() => handleUpdateRender('code')}
                                    disabled={updating}
                                />
                                <OptionButton
                                    label="AI Render"
                                    icon="film-outline"
                                    badge="AI-GENERATED"
                                    description="Gemini generates the scene HTML directly, making the result flexible but non-deterministic."
                                    selected={sceneRenderMethod === 'ai'}
                                    onPress={() => handleUpdateRender('ai')}
                                    disabled={updating}
                                />
                            </View>
                        </View>

                        {/* Dashboard config summary */}
                        <LinearGradient
                            colors={gradients.card}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.summaryCard}
                        >
                            <View style={styles.summaryHeader}>
                                <Ionicons name="shield-checkmark-outline" size={18} color={colors.gradientTo} />
                                <Text style={styles.summaryTitle}>Active Pipeline</Text>
                            </View>
                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryCell}>
                                    <Text style={styles.summaryLabel}>VOICEOVER</Text>
                                    <Text style={styles.summaryValue}>
                                        {voiceoverProvider === 'f5' ? 'F5 TTS · Local' : 'Gemini TTS · Cloud'}
                                    </Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryCell}>
                                    <Text style={styles.summaryLabel}>SCENE RENDERING</Text>
                                    <Text style={styles.summaryValue}>
                                        {sceneRenderMethod === 'code' ? 'Code · Deterministic' : 'AI · Direct HTML'}
                                    </Text>
                                </View>
                            </View>
                            {updating && (
                                <View style={styles.updatingOverlay}>
                                    <ActivityIndicator size="small" color={colors.gradientTo} />
                                    <Text style={styles.updatingText}>Saving pipeline settings...</Text>
                                </View>
                            )}
                        </LinearGradient>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxl * 2,
    },
    header: {
        marginBottom: spacing.xxl,
        marginTop: spacing.md,
    },
    eyebrow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    eyebrowText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.gradientTo,
        letterSpacing: 1.4,
    },
    headerTitle: {
        fontSize: typography.fontSizeXxl,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        letterSpacing: 0.2,
        marginBottom: spacing.sm,
    },
    headerSubtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        lineHeight: 20,
        maxWidth: 520,
    },
    loadingContainer: {
        paddingVertical: 100,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
    },
    loadingText: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
    },
    content: {
        gap: spacing.lg,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: spacing.lg,
        ...shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    cardHeaderIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(6, 182, 212, 0.09)',
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.16)',
        marginRight: spacing.md,
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    cardSubtitle: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        lineHeight: 17,
        marginTop: 2,
    },
    optionsList: {
        gap: spacing.sm,
    },
    optionCol: {
        width: '100%',
    },
    optionButton: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        padding: spacing.md,
        minHeight: 94,
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    optionButtonActive: {
        backgroundColor: '#131B31',
        borderColor: colors.primary,
    },
    optionButtonInactive: {
        backgroundColor: '#090E1F',
        borderColor: 'rgba(255, 255, 255, 0.07)',
    },
    optionButtonDisabled: {
        opacity: 0.65,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingRight: spacing.lg,
    },
    optionIcon: {
        width: 38,
        height: 38,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(148, 163, 184, 0.07)',
        marginRight: spacing.md,
    },
    optionIconActive: {
        backgroundColor: 'rgba(6, 182, 212, 0.10)',
    },
    optionText: {
        flex: 1,
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    optionLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        letterSpacing: 0.2,
    },
    optionLabelActive: {
        color: colors.foreground,
    },
    optionLabelInactive: {
        color: colors.foregroundMuted,
    },
    optionBadge: {
        borderRadius: 6,
        backgroundColor: 'rgba(148, 163, 184, 0.08)',
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    optionBadgeActive: {
        backgroundColor: 'rgba(6, 182, 212, 0.12)',
    },
    optionBadgeText: {
        fontSize: 8,
        fontWeight: typography.fontWeightBold,
        color: colors.mutedForeground,
        letterSpacing: 0.7,
    },
    optionBadgeTextActive: {
        color: colors.gradientTo,
    },
    optionDescription: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        lineHeight: 17,
    },
    checkIndicator: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: 16,
        height: 16,
        borderRadius: 8,
        overflow: 'hidden',
    },
    checkIndicatorGrad: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryCard: {
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.18)',
        padding: spacing.md,
        position: 'relative',
        overflow: 'hidden',
    },
    summaryHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    summaryTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        letterSpacing: 0.5,
    },
    summaryGrid: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryCell: {
        flex: 1,
        minWidth: 0,
    },
    summaryLabel: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    summaryValue: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightMedium,
        color: colors.gradientTo,
        lineHeight: 17,
    },
    summaryDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: spacing.md,
    },
    updatingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: colors.background,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: borderRadius.md,
    },
    updatingText: {
        fontSize: typography.fontSizeXs,
        color: colors.gradientTo,
        fontWeight: typography.fontWeightMedium,
    },
    toastContainer: {
        position: 'absolute',
        top: spacing.md,
        left: spacing.md,
        right: spacing.md,
        zIndex: 9999,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    toastGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.sm,
    },
    toastText: {
        color: '#fff',
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
    },
});
