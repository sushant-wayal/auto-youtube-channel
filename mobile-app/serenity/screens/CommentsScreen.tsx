import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Modal,
    TextInput,
    Alert,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, gradients } from '../theme';
import {
    commentsApi,
    CommentReplySettings,
    ReplyHistoryEntry,
} from '../services/api';

export default function CommentsScreen() {
    const [history, setHistory] = useState<ReplyHistoryEntry[]>([]);
    const [settings, setSettings] = useState<CommentReplySettings>({
        enabled: true,
        dryRun: false,
        maxRepliesPerRun: 5,
        tone: 'friendly',
        replyToQuestionsOnly: false,
        customInstructions: '',
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
    const [isConfigModalVisible, setConfigModalVisible] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // Form state for config modal
    const [formSettings, setFormSettings] = useState<CommentReplySettings>(settings);

    const fetchData = useCallback(async () => {
        const res = await commentsApi.getHistory(40);
        if (res.ok) {
            if (res.history) setHistory(res.history);
            if (res.settings) {
                setSettings(res.settings);
                setFormSettings(res.settings);
            }
            if (res.stats) setStats(res.stats);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

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
                Alert.alert(
                    'Success',
                    `Comments Processed!\nChecked: ${res.result.totalChecked}\nLive Sent: ${res.result.repliesSent}\nSimulated: ${res.result.repliesDryRun}\nSkipped: ${res.result.repliesSkipped}`
                );
                fetchData();
            } else {
                Alert.alert('Error', res.error || 'Failed to process comments');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || String(err));
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
                Alert.alert('Dispatched', 'GitHub Actions workflow triggered successfully!');
            } else {
                Alert.alert('Error', res.error || 'Failed to dispatch workflow');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || String(err));
        } finally {
            setDispatching(false);
        }
    };

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await commentsApi.updateSettings(formSettings);
            if (res.ok && res.settings) {
                setSettings(res.settings);
                setConfigModalVisible(false);
                Alert.alert('Success', 'Comment reply settings updated!');
            } else {
                Alert.alert('Error', res.error || 'Failed to save settings');
            }
        } catch (err: any) {
            Alert.alert('Error', err.message || String(err));
        } finally {
            setSavingSettings(false);
        }
    };

    const formatRelativeTime = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    };

    const renderHeader = () => (
        <View style={styles.headerContainer}>
            {/* Status Banner */}
            <View style={styles.statusRow}>
                <View style={styles.statusLeft}>
                    <Text style={styles.sectionTitle}>Auto Comment Reply</Text>
                    <Text style={styles.sectionSubtitle}>AI engagement powered by Gemini</Text>
                </View>

                {settings.enabled ? (
                    settings.dryRun ? (
                        <View style={[styles.badge, styles.badgeAmber]}>
                            <Ionicons name="flask-outline" size={12} color="#F59E0B" />
                            <Text style={styles.badgeAmberText}>Dry Run</Text>
                        </View>
                    ) : (
                        <View style={[styles.badge, styles.badgeGreen]}>
                            <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                            <Text style={styles.badgeGreenText}>Live Active</Text>
                        </View>
                    )
                ) : (
                    <View style={[styles.badge, styles.badgeGray]}>
                        <Ionicons name="pause-circle-outline" size={12} color="#94A3B8" />
                        <Text style={styles.badgeGrayText}>Paused</Text>
                    </View>
                )}
            </View>

            {/* KPI Stats */}
            <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiNumber}>{stats.totalLiveReplies}</Text>
                    <Text style={styles.kpiLabel}>Live Sent</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiNumber, { color: '#F59E0B' }]}>{stats.totalDryRunReplies}</Text>
                    <Text style={styles.kpiLabel}>Dry Run</Text>
                </View>
                <View style={styles.kpiCard}>
                    <Text style={[styles.kpiNumber, { color: colors.destructive }]}>{stats.totalFailed}</Text>
                    <Text style={styles.kpiLabel}>Failed</Text>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.primaryActionBtn, (processing || loading) && styles.btnDisabled]}
                    onPress={handleProcessNow}
                    disabled={processing || loading}
                >
                    <LinearGradient
                        colors={gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBtnInner}
                    >
                        {processing ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <>
                                <Ionicons name="play" size={15} color="#FFF" />
                                <Text style={styles.primaryActionText}>Process Now</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryActionBtn, (dispatching || loading) && styles.btnDisabled]}
                    onPress={handleDispatchGitHub}
                    disabled={dispatching || loading}
                >
                    {dispatching ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                        <>
                            <Ionicons name="logo-github" size={16} color={colors.foreground} />
                            <Text style={styles.secondaryActionText}>Dispatch</Text>
                        </>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.configBtn}
                    onPress={() => {
                        setFormSettings(settings);
                        setConfigModalVisible(true);
                    }}
                >
                    <Ionicons name="options-outline" size={18} color={colors.foreground} />
                </TouchableOpacity>
            </View>

            <View style={styles.feedHeaderRow}>
                <Text style={styles.feedTitle}>Activity Log ({history.length})</Text>
                <TouchableOpacity onPress={fetchData} disabled={loading}>
                    <Ionicons
                        name="refresh-outline"
                        size={16}
                        color={colors.foregroundMuted}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderCommentCard = ({ item }: { item: ReplyHistoryEntry }) => {
        const isLive = item.status === 'posted';
        const isDryRun = item.status === 'dry_run';

        return (
            <View style={styles.cardShell}>
                <View style={styles.commentHeader}>
                    <View style={styles.authorRow}>
                        <View style={styles.avatarShell}>
                            <Ionicons name="person" size={13} color={colors.primary} />
                        </View>
                        <Text style={styles.authorName} numberOfLines={1}>
                            {item.authorName}
                        </Text>
                    </View>

                    <View style={styles.headerRight}>
                        {isLive && (
                            <View style={[styles.statusPill, styles.pillLive]}>
                                <Text style={styles.pillLiveText}>Live</Text>
                            </View>
                        )}
                        {isDryRun && (
                            <View style={[styles.statusPill, styles.pillDry]}>
                                <Text style={styles.pillDryText}>Simulated</Text>
                            </View>
                        )}
                        {!isLive && !isDryRun && (
                            <View style={[styles.statusPill, styles.pillFailed]}>
                                <Text style={styles.pillFailedText}>Failed</Text>
                            </View>
                        )}
                        <Text style={styles.timestamp}>{formatRelativeTime(item.timestamp)}</Text>
                    </View>
                </View>

                {/* Video Title Tag */}
                <View style={styles.videoBadge}>
                    <Ionicons name="videocam-outline" size={12} color={colors.primary} />
                    <Text style={styles.videoBadgeText} numberOfLines={1}>
                        {item.videoTitle}
                    </Text>
                </View>

                {/* Viewer Comment Box */}
                <View style={styles.commentQuoteBox}>
                    <Text style={styles.commentQuoteText}>
                        &ldquo;{item.commentText}&rdquo;
                    </Text>
                </View>

                {/* AI Reply Box */}
                <View style={styles.replyBox}>
                    <View style={styles.replyMeta}>
                        <View style={styles.replyTagRow}>
                            <Ionicons name="sparkles" size={12} color={colors.primary} />
                            <Text style={styles.replyTagText}>AI Reply ({item.category})</Text>
                        </View>
                        <Text style={styles.sentimentText}>{item.sentiment}</Text>
                    </View>
                    <Text style={styles.replyText}>{item.replyText}</Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {loading && !refreshing ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={history}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCommentCard}
                    ListHeaderComponent={renderHeader}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons
                                name="chatbubble-ellipses-outline"
                                size={44}
                                color={colors.mutedForeground}
                            />
                            <Text style={styles.emptyText}>No comment reply activity yet</Text>
                            <Text style={styles.emptySubtext}>
                                Tap &quot;Process Now&quot; above to scan and reply to viewer comments.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* Settings Modal */}
            <Modal
                visible={isConfigModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setConfigModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Auto Reply Settings</Text>
                            <TouchableOpacity onPress={() => setConfigModalVisible(false)}>
                                <Ionicons name="close" size={22} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                            {/* Enable Switch */}
                            <TouchableOpacity
                                style={styles.toggleRow}
                                onPress={() =>
                                    setFormSettings({ ...formSettings, enabled: !formSettings.enabled })
                                }
                            >
                                <Text style={styles.toggleLabel}>Enable Auto Replies</Text>
                                <Ionicons
                                    name={formSettings.enabled ? 'checkbox' : 'square-outline'}
                                    size={22}
                                    color={formSettings.enabled ? colors.primary : colors.mutedForeground}
                                />
                            </TouchableOpacity>

                            {/* Dry Run Switch */}
                            <TouchableOpacity
                                style={styles.toggleRow}
                                onPress={() =>
                                    setFormSettings({ ...formSettings, dryRun: !formSettings.dryRun })
                                }
                            >
                                <View>
                                    <Text style={styles.toggleLabel}>Dry-Run Mode (Simulate)</Text>
                                    <Text style={styles.helperText}>Logs replies without posting to YouTube</Text>
                                </View>
                                <Ionicons
                                    name={formSettings.dryRun ? 'checkbox' : 'square-outline'}
                                    size={22}
                                    color={formSettings.dryRun ? '#F59E0B' : colors.mutedForeground}
                                />
                            </TouchableOpacity>

                            {/* Questions Only */}
                            <TouchableOpacity
                                style={styles.toggleRow}
                                onPress={() =>
                                    setFormSettings({
                                        ...formSettings,
                                        replyToQuestionsOnly: !formSettings.replyToQuestionsOnly,
                                    })
                                }
                            >
                                <Text style={styles.toggleLabel}>Reply to Questions Only</Text>
                                <Ionicons
                                    name={formSettings.replyToQuestionsOnly ? 'checkbox' : 'square-outline'}
                                    size={22}
                                    color={formSettings.replyToQuestionsOnly ? colors.primary : colors.mutedForeground}
                                />
                            </TouchableOpacity>

                            {/* Tone Selector */}
                            <Text style={styles.inputLabel}>Reply Tone</Text>
                            <View style={styles.toneGrid}>
                                {(['friendly', 'professional', 'technical', 'enthusiastic'] as const).map(
                                    (tone) => (
                                        <TouchableOpacity
                                            key={tone}
                                            style={[
                                                styles.toneButton,
                                                formSettings.tone === tone && styles.toneButtonActive,
                                            ]}
                                            onPress={() => setFormSettings({ ...formSettings, tone })}
                                        >
                                            <Text
                                                style={[
                                                    styles.toneButtonText,
                                                    formSettings.tone === tone && styles.toneButtonTextActive,
                                                ]}
                                            >
                                                {tone.charAt(0).toUpperCase() + tone.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    )
                                )}
                            </View>

                            {/* Max replies per run */}
                            <Text style={styles.inputLabel}>Max Replies Per Run (1 - 20)</Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="number-pad"
                                value={String(formSettings.maxRepliesPerRun || 5)}
                                onChangeText={(t) =>
                                    setFormSettings({
                                        ...formSettings,
                                        maxRepliesPerRun: parseInt(t, 10) || 5,
                                    })
                                }
                            />

                            {/* Persona Instructions */}
                            <Text style={styles.inputLabel}>Custom Persona Instructions</Text>
                            <TextInput
                                style={[styles.textInput, styles.textArea]}
                                multiline
                                numberOfLines={3}
                                placeholder="E.g., Speak as the software engineer founder. If viewers ask about code, mention our open-source repo."
                                placeholderTextColor={colors.mutedForeground}
                                value={formSettings.customInstructions || ''}
                                onChangeText={(t) =>
                                    setFormSettings({ ...formSettings, customInstructions: t })
                                }
                            />
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSaveSettings}
                                disabled={savingSettings}
                            >
                                <LinearGradient
                                    colors={gradients.primary}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.saveBtnInner}
                                >
                                    {savingSettings ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>Save Settings</Text>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: spacing.md,
        paddingBottom: spacing.xxxl,
    },
    headerContainer: {
        marginBottom: spacing.md,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    statusLeft: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    sectionSubtitle: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        marginTop: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
    },
    badgeGreen: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    badgeGreenText: {
        color: '#10B981',
        fontSize: 11,
        fontWeight: '600',
    },
    badgeAmber: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    badgeAmberText: {
        color: '#F59E0B',
        fontSize: 11,
        fontWeight: '600',
    },
    badgeGray: {
        backgroundColor: 'rgba(148, 163, 184, 0.15)',
    },
    badgeGrayText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
    },
    kpiRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        alignItems: 'center',
    },
    kpiNumber: {
        fontSize: typography.fontSizeXl,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    kpiLabel: {
        fontSize: 11,
        color: colors.foregroundMuted,
        marginTop: 2,
    },
    actionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    primaryActionBtn: {
        flex: 2,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    gradientBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
    },
    primaryActionText: {
        color: '#FFF',
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
    },
    secondaryActionBtn: {
        flex: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: borderRadius.sm,
        paddingVertical: 12,
    },
    secondaryActionText: {
        color: colors.foreground,
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
    },
    configBtn: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: borderRadius.sm,
    },
    btnDisabled: {
        opacity: 0.5,
    },
    feedHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    feedTitle: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    cardShell: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    avatarShell: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    authorName: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        flex: 1,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    pillLive: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
    },
    pillLiveText: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: '600',
    },
    pillDry: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
    },
    pillDryText: {
        color: '#F59E0B',
        fontSize: 10,
        fontWeight: '600',
    },
    pillFailed: {
        backgroundColor: 'rgba(244, 63, 94, 0.15)',
    },
    pillFailedText: {
        color: '#F43F5E',
        fontSize: 10,
        fontWeight: '600',
    },
    timestamp: {
        fontSize: 10,
        color: colors.mutedForeground,
    },
    videoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    videoBadgeText: {
        fontSize: 11,
        color: colors.foregroundMuted,
        maxWidth: 240,
    },
    commentQuoteBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.border,
    },
    commentQuoteText: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        fontStyle: 'italic',
    },
    replyBox: {
        backgroundColor: 'rgba(139, 92, 246, 0.08)',
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        gap: 4,
    },
    replyMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    replyTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    replyTagText: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.primary,
    },
    sentimentText: {
        fontSize: 10,
        color: colors.foregroundMuted,
        textTransform: 'capitalize',
    },
    replyText: {
        fontSize: typography.fontSizeXs,
        color: colors.foreground,
        lineHeight: 18,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: spacing.sm,
    },
    emptyText: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    emptySubtext: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        textAlign: 'center',
        maxWidth: 260,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: colors.backgroundSecondary,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        maxHeight: '85%',
        padding: spacing.lg,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    modalBody: {
        marginBottom: spacing.md,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    toggleLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.foreground,
    },
    helperText: {
        fontSize: 11,
        color: colors.foregroundMuted,
        marginTop: 2,
    },
    inputLabel: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        marginTop: spacing.md,
        marginBottom: spacing.sm,
        letterSpacing: 0.5,
    },
    toneGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
        marginBottom: spacing.xs,
    },
    toneButton: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
    },
    toneButtonActive: {
        backgroundColor: 'rgba(139, 92, 246, 0.25)',
        borderColor: colors.primary,
    },
    toneButtonText: {
        fontSize: 12,
        color: colors.foregroundMuted,
    },
    toneButtonTextActive: {
        color: colors.foreground,
        fontWeight: '600',
    },
    textInput: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        color: colors.foreground,
        fontSize: typography.fontSizeSm,
    },
    textArea: {
        height: 70,
        textAlignVertical: 'top',
    },
    modalFooter: {
        paddingTop: spacing.sm,
    },
    saveBtn: {
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
    },
    saveBtnInner: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveBtnText: {
        color: '#FFF',
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightBold,
    },
});
