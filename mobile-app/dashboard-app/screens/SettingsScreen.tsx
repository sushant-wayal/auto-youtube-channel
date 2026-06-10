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
};

function OptionButton({ label, selected, onPress, icon, description }: OptionButtonProps) {
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
                style={[
                    styles.optionButton,
                    selected ? styles.optionButtonActive : styles.optionButtonInactive,
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
                <View style={styles.optionHeader}>
                    <Ionicons
                        name={icon as any}
                        size={18}
                        color={selected ? colors.gradientTo : colors.foregroundMuted}
                    />
                    <Text
                        style={[
                            styles.optionLabel,
                            selected ? styles.optionLabelActive : styles.optionLabelInactive,
                        ]}
                    >
                        {label}
                    </Text>
                </View>
                <Text style={styles.optionDescription}>{description}</Text>
                
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
                    <Text style={styles.headerTitle}>System Settings</Text>
                    <Text style={styles.headerSubtitle}>
                        Configure visual rendering formats and speech models for automated video generations.
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
                                <Ionicons name="mic-outline" size={20} color={colors.primary} style={styles.cardHeaderIcon} />
                                <View>
                                    <Text style={styles.cardTitle}>Voiceover Provider</Text>
                                    <Text style={styles.cardSubtitle}>Select text-to-speech synthesis pipeline</Text>
                                </View>
                            </View>

                            <View style={styles.optionsRow}>
                                <OptionButton
                                    label="F5 TTS"
                                    icon="musical-notes-outline"
                                    description="High-end voice-cloned custom-trained voice with natural expression & prosody."
                                    selected={voiceoverProvider === 'f5'}
                                    onPress={() => handleUpdateVoiceover('f5')}
                                />
                                <OptionButton
                                    label="Gemini"
                                    icon="sparkles-outline"
                                    description="Ultra-fast Google Flash TTS service. Clear, neutral narration preview voice."
                                    selected={voiceoverProvider === 'gemini'}
                                    onPress={() => handleUpdateVoiceover('gemini')}
                                />
                            </View>
                        </View>

                        {/* Setting Box 2: Scene Render Method */}
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="videocam-outline" size={20} color={colors.primary} style={styles.cardHeaderIcon} />
                                <View>
                                    <Text style={styles.cardTitle}>Scene Render Method</Text>
                                    <Text style={styles.cardSubtitle}>Visual composition rendering engine</Text>
                                </View>
                            </View>

                            <View style={styles.optionsRow}>
                                <OptionButton
                                    label="Code Render"
                                    icon="code-slash-outline"
                                    description="Standard HTML/Canvas layout rendering with vector animations, layouts, and typography."
                                    selected={sceneRenderMethod === 'code'}
                                    onPress={() => handleUpdateRender('code')}
                                />
                                <OptionButton
                                    label="AI Render"
                                    icon="film-outline"
                                    description="Advanced diffusion-based dynamic scene image and video generation."
                                    selected={sceneRenderMethod === 'ai'}
                                    onPress={() => handleUpdateRender('ai')}
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
                                <Text style={styles.summaryTitle}>Active Pipeline Pipeline Config</Text>
                            </View>
                            <View style={styles.summaryGrid}>
                                <View style={styles.summaryCell}>
                                    <Text style={styles.summaryLabel}>VOICEOVER MODEL</Text>
                                    <Text style={styles.summaryValue}>
                                        {voiceoverProvider === 'f5' ? 'F5 Custom Voice' : 'Gemini Flash TTS'}
                                    </Text>
                                </View>
                                <View style={styles.summaryDivider} />
                                <View style={styles.summaryCell}>
                                    <Text style={styles.summaryLabel}>RENDER METHOD</Text>
                                    <Text style={styles.summaryValue}>
                                        {sceneRenderMethod === 'code' ? 'Code Canvas Engine' : 'AI Gen Diffusion'}
                                    </Text>
                                </View>
                            </View>
                            {updating && (
                                <View style={styles.updatingOverlay}>
                                    <ActivityIndicator size="small" color={colors.gradientTo} />
                                    <Text style={styles.updatingText}>Writing to Redis cluster...</Text>
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
        marginBottom: spacing.xl,
        marginTop: spacing.sm,
    },
    headerTitle: {
        fontSize: typography.fontSizeXl,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    headerSubtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        lineHeight: 18,
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
        padding: spacing.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    cardHeaderIcon: {
        marginRight: spacing.sm,
    },
    cardTitle: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    cardSubtitle: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        marginTop: 1,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    optionCol: {
        flex: 1,
    },
    optionButton: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        padding: spacing.md,
        minHeight: 140,
        justifyContent: 'flex-start',
        position: 'relative',
        overflow: 'hidden',
    },
    optionButtonActive: {
        backgroundColor: '#131B31',
        borderColor: colors.primary,
    },
    optionButtonInactive: {
        backgroundColor: '#090E1F',
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    optionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        marginBottom: spacing.xs + 2,
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
    optionDescription: {
        fontSize: 11,
        color: colors.foregroundMuted,
        lineHeight: 14,
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
    },
    summaryLabel: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    summaryValue: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.gradientTo,
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
