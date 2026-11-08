import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Linking,
    SafeAreaView,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { colors, spacing, borderRadius, typography } from '../theme';
import { STORAGE_KEYS, GENRE_PRESETS } from '../config';
import { setApiBaseUrl, testServerConnection, settingsApi, youtubeAuthApi } from '../services/api';

interface OnboardingScreenProps {
    onComplete: () => void;
    initialUrl?: string;
}

export default function OnboardingScreen({ onComplete, initialUrl }: OnboardingScreenProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1: Server URL
    const [serverUrl, setServerUrl] = useState(initialUrl || '');
    const [isTestingServer, setIsTestingServer] = useState(false);
    const [serverVerified, setServerVerified] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);

    // Step 2: YouTube Auth
    const [ytChecking, setYtChecking] = useState(false);
    const [ytStatus, setYtStatus] = useState<{
        connected: boolean;
        channelTitle?: string;
        channelHandle?: string;
    } | null>(null);

    // Step 3: Genre
    const [selectedGenre, setSelectedGenre] = useState('tech');
    const [customGenrePrompt, setCustomGenrePrompt] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Test Server Connection
    const handleTestServer = async () => {
        const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
        if (!cleanUrl) {
            setServerError('Please enter a valid URL');
            return;
        }

        const formattedUrl = cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')
            ? cleanUrl
            : `https://${cleanUrl}`;

        setServerUrl(formattedUrl);
        setIsTestingServer(true);
        setServerError(null);

        const result = await testServerConnection(formattedUrl);
        setIsTestingServer(false);

        if (result.ok) {
            setServerVerified(true);
            await setApiBaseUrl(formattedUrl);
            // Pre-check YouTube status
            checkYouTubeStatus(formattedUrl);
        } else {
            setServerVerified(false);
            setServerError(result.error || 'Could not connect to this server. Ensure Vercel or your backend is running.');
        }
    };

    // Check YouTube Status
    const checkYouTubeStatus = async (urlOverride?: string) => {
        setYtChecking(true);
        try {
            const status = await youtubeAuthApi.getStatus();
            if (status.ok && status.connected) {
                setYtStatus({
                    connected: true,
                    channelTitle: status.channel?.title || 'YouTube Channel',
                    channelHandle: status.channel?.handle || '',
                });
            } else {
                setYtStatus({ connected: false });
            }
        } catch {
            setYtStatus({ connected: false });
        } finally {
            setYtChecking(false);
        }
    };

    // Open Google OAuth
    const handleOpenYouTubeAuth = () => {
        const targetUrl = `${serverUrl.trim().replace(/\/+$/, '')}/api/auth/youtube/start`;
        Linking.openURL(targetUrl);
    };

    // Finish Setup
    const handleFinishSetup = async () => {
        setIsSaving(true);
        try {
            await setApiBaseUrl(serverUrl.trim().replace(/\/+$/, ''));
            await AsyncStorage.setItem(STORAGE_KEYS.CHANNEL_GENRE, selectedGenre);
            if (customGenrePrompt) {
                await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_GENRE_PROMPT, customGenrePrompt);
            }
            await AsyncStorage.setItem(STORAGE_KEYS.SETUP_COMPLETED, 'true');

            // Push genre setting to backend
            try {
                await settingsApi.updateSettings({
                    channelGenre: selectedGenre,
                    channelGenrePrompt: customGenrePrompt || undefined,
                } as any);
            } catch (err) {
                console.warn('Could not sync genre to backend on setup:', err);
            }

            onComplete();
        } catch (e) {
            console.error('Setup completion error:', e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoBadge}>
                        <Ionicons name="sparkles" size={16} color={colors.sandstone} />
                        <Text style={styles.logoText}>Channel Pilot BYOK</Text>
                    </View>
                    <Text style={styles.title}>
                        {step === 1 && 'Connect Your Server'}
                        {step === 2 && 'Connect YouTube'}
                        {step === 3 && 'Choose Your Niche'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {step === 1 && 'Point this app to your Next.js / Vercel backend.'}
                        {step === 2 && 'Authorize your channel so the bot can upload videos.'}
                        {step === 3 && 'Tailor scriptwriting and visual animation to your audience.'}
                    </Text>

                    {/* Progress Indicator */}
                    <View style={styles.stepIndicator}>
                        {[1, 2, 3].map((s) => (
                            <View
                                key={s}
                                style={[
                                    styles.stepBar,
                                    s <= step ? styles.stepBarActive : styles.stepBarInactive,
                                ]}
                            />
                        ))}
                    </View>
                </View>

                <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* STEP 1: Server URL */}
                    {step === 1 && (
                        <View style={styles.stepContainer}>
                            <Text style={styles.label}>Backend Server URL</Text>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="globe-outline" size={20} color={colors.linenMuted} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="https://my-channel.vercel.app"
                                    placeholderTextColor={colors.linenWhisper}
                                    value={serverUrl}
                                    onChangeText={(text) => {
                                        setServerUrl(text);
                                        setServerVerified(false);
                                        setServerError(null);
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.testButton, isTestingServer && styles.buttonDisabled]}
                                onPress={handleTestServer}
                                disabled={isTestingServer || !serverUrl.trim()}
                            >
                                {isTestingServer ? (
                                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                                ) : (
                                    <>
                                        <Ionicons name="flash-outline" size={18} color={colors.primaryForeground} />
                                        <Text style={styles.testButtonText}>Test Connection</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Status Feedback */}
                            {serverVerified && (
                                <View style={styles.successCard}>
                                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.successTitle}>Connected Successfully</Text>
                                        <Text style={styles.successSubtitle}>Backend responded 200 OK</Text>
                                    </View>
                                </View>
                            )}

                            {serverError && (
                                <View style={styles.errorCard}>
                                    <Ionicons name="alert-circle" size={20} color="#ef4444" />
                                    <Text style={styles.errorText}>{serverError}</Text>
                                </View>
                            )}

                            <View style={styles.infoBox}>
                                <Ionicons name="shield-checkmark-outline" size={18} color={colors.sandstone} />
                                <Text style={styles.infoText}>
                                    Your URL is stored locally on this phone only. No shared servers, zero data leakage.
                                </Text>
                            </View>

                            {serverVerified && (
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    onPress={() => setStep(2)}
                                >
                                    <Text style={styles.primaryButtonText}>Continue to YouTube Setup</Text>
                                    <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* STEP 2: YouTube Authorization */}
                    {step === 2 && (
                        <View style={styles.stepContainer}>
                            <View style={styles.ytCard}>
                                <View style={styles.ytHeader}>
                                    <Ionicons name="logo-youtube" size={32} color="#ef4444" />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.ytCardTitle}>
                                            {ytStatus?.connected ? ytStatus.channelTitle : 'YouTube Not Connected'}
                                        </Text>
                                        <Text style={styles.ytCardSubtitle}>
                                            {ytStatus?.connected
                                                ? (ytStatus.channelHandle || 'Channel Authorized & Ready')
                                                : 'Requires YouTube Data API v3 permissions'}
                                        </Text>
                                    </View>
                                    {ytStatus?.connected && (
                                        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                                    )}
                                </View>

                                <TouchableOpacity
                                    style={styles.ytAuthButton}
                                    onPress={handleOpenYouTubeAuth}
                                >
                                    <Ionicons name="open-outline" size={18} color="#fff" />
                                    <Text style={styles.ytAuthButtonText}>
                                        {ytStatus?.connected ? 'Re-authorize Account' : 'Authorize Channel via Browser'}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.refreshStatusBtn}
                                    onPress={() => checkYouTubeStatus()}
                                    disabled={ytChecking}
                                >
                                    {ytChecking ? (
                                        <ActivityIndicator size="small" color={colors.linenMuted} />
                                    ) : (
                                        <>
                                            <Ionicons name="refresh-outline" size={16} color={colors.linenMuted} />
                                            <Text style={styles.refreshStatusText}>Check Connection Status</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.infoBox}>
                                <Ionicons name="information-circle-outline" size={18} color={colors.sandstone} />
                                <Text style={styles.infoText}>
                                    Authorizing gives you a <Text style={{ color: colors.sandstone, fontWeight: '700' }}>YT_REFRESH_TOKEN</Text> on screen to paste into your GitHub Secrets.
                                </Text>
                            </View>

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => setStep(1)}
                                >
                                    <Ionicons name="arrow-back" size={18} color={colors.linen} />
                                    <Text style={styles.secondaryButtonText}>Back</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.primaryButton, { flex: 1, marginLeft: 12 }]}
                                    onPress={() => setStep(3)}
                                >
                                    <Text style={styles.primaryButtonText}>
                                        {ytStatus?.connected ? 'Next: Choose Niche' : 'Skip & Continue'}
                                    </Text>
                                    <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* STEP 3: Content Genre Selection */}
                    {step === 3 && (
                        <View style={styles.stepContainer}>
                            <Text style={styles.label}>Select Channel Content Genre</Text>

                            <View style={styles.genreList}>
                                {GENRE_PRESETS.map((genre) => {
                                    const isSelected = selectedGenre === genre.id;
                                    return (
                                        <TouchableOpacity
                                            key={genre.id}
                                            style={[styles.genreCard, isSelected && styles.genreCardSelected]}
                                            onPress={() => setSelectedGenre(genre.id)}
                                        >
                                            <View style={[styles.genreIconBox, isSelected && styles.genreIconBoxSelected]}>
                                                <Ionicons
                                                    name={genre.icon as any}
                                                    size={22}
                                                    color={isSelected ? colors.sandstone : colors.linenMuted}
                                                />
                                            </View>
                                            <View style={{ flex: 1, marginLeft: 14 }}>
                                                <Text style={[styles.genreLabel, isSelected && styles.genreLabelSelected]}>
                                                    {genre.label}
                                                </Text>
                                                <Text style={styles.genreDescription}>{genre.description}</Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={20} color={colors.sandstone} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {selectedGenre === 'custom' && (
                                <View style={{ marginTop: 12, marginBottom: 16 }}>
                                    <Text style={styles.label}>Custom Channel Strategy Prompt</Text>
                                    <TextInput
                                        style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                                        placeholder="e.g. You are a storyteller creating fast-paced automotive engineering analysis..."
                                        placeholderTextColor={colors.linenWhisper}
                                        value={customGenrePrompt}
                                        onChangeText={setCustomGenrePrompt}
                                        multiline
                                    />
                                </View>
                            )}

                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.secondaryButton}
                                    onPress={() => setStep(2)}
                                >
                                    <Ionicons name="arrow-back" size={18} color={colors.linen} />
                                    <Text style={styles.secondaryButtonText}>Back</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.primaryButton, { flex: 1, marginLeft: 12 }, isSaving && styles.buttonDisabled]}
                                    onPress={handleFinishSetup}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator size="small" color={colors.primaryForeground} />
                                    ) : (
                                        <>
                                            <Text style={styles.primaryButtonText}>Launch Dashboard</Text>
                                            <Ionicons name="rocket-outline" size={18} color={colors.primaryForeground} />
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === 'android' ? 40 : spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    logoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        backgroundColor: colors.sandstoneTint,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        marginBottom: 12,
    },
    logoText: {
        color: colors.sandstone,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    title: {
        color: colors.linen,
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 6,
    },
    subtitle: {
        color: colors.linenMuted,
        fontSize: 14,
        lineHeight: 20,
    },
    stepIndicator: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 18,
    },
    stepBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    stepBarActive: {
        backgroundColor: colors.sandstone,
    },
    stepBarInactive: {
        backgroundColor: colors.border,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
    },
    stepContainer: {
        gap: 14,
    },
    label: {
        color: colors.linenDim,
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    input: {
        flex: 1,
        color: colors.linen,
        fontSize: 15,
        paddingVertical: 12,
    },
    testButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.sandstone,
        paddingVertical: 12,
        borderRadius: borderRadius.md,
    },
    testButtonText: {
        color: colors.primaryForeground,
        fontWeight: '700',
        fontSize: 14,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    successCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(74, 222, 128, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.3)',
        padding: 14,
        borderRadius: borderRadius.md,
    },
    successTitle: {
        color: colors.success,
        fontSize: 14,
        fontWeight: '600',
    },
    successSubtitle: {
        color: colors.linenMuted,
        fontSize: 12,
    },
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        padding: 14,
        borderRadius: borderRadius.md,
    },
    errorText: {
        flex: 1,
        color: '#f87171',
        fontSize: 13,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        borderRadius: borderRadius.md,
        marginVertical: 4,
    },
    infoText: {
        flex: 1,
        color: colors.linenMuted,
        fontSize: 12,
        lineHeight: 18,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: colors.sandstone,
        paddingVertical: 14,
        borderRadius: borderRadius.md,
        marginTop: 8,
    },
    primaryButtonText: {
        color: colors.primaryForeground,
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: borderRadius.md,
        marginTop: 8,
    },
    secondaryButtonText: {
        color: colors.linen,
        fontSize: 14,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    ytCard: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: 18,
    },
    ytHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    ytCardTitle: {
        color: colors.linen,
        fontSize: 16,
        fontWeight: '700',
    },
    ytCardSubtitle: {
        color: colors.linenMuted,
        fontSize: 13,
        marginTop: 2,
    },
    ytAuthButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#ef4444',
        paddingVertical: 12,
        borderRadius: borderRadius.md,
        marginBottom: 10,
    },
    ytAuthButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    refreshStatusBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    refreshStatusText: {
        color: colors.linenMuted,
        fontSize: 13,
    },
    genreList: {
        gap: 10,
    },
    genreCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: 14,
    },
    genreCardSelected: {
        borderColor: colors.sandstone,
        backgroundColor: colors.sandstoneTint,
    },
    genreIconBox: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.cardElevated,
        alignItems: 'center',
        justifyContent: 'center',
    },
    genreIconBoxSelected: {
        backgroundColor: 'rgba(200, 178, 155, 0.2)',
    },
    genreLabel: {
        color: colors.linen,
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    genreLabelSelected: {
        color: colors.sandstone,
    },
    genreDescription: {
        color: colors.linenMuted,
        fontSize: 12,
        lineHeight: 16,
    },
});

