import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    StyleSheet,
    Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { pipelineApi, PipelineStatus, JobResult } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string): string {
    const ms = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

function jobLabel(key: keyof PipelineStatus['jobs']): string {
    const map: Record<keyof PipelineStatus['jobs'], string> = {
        populateIdeas: 'Populate Ideas',
        generateScript: 'Generate Script',
        renderScenes: 'Render Scenes',
        generateVoiceover: 'Generate Voiceover',
        assembleLongForm: 'Assemble Video',
        generateThumbnail: 'Generate Thumbnail',
        uploadYoutube: 'Upload to YouTube',
        shortsProcessing: 'Shorts Processing',
    };
    return map[key];
}

function jobIcon(key: keyof PipelineStatus['jobs']): React.ComponentProps<typeof Ionicons>['name'] {
    const map: Record<keyof PipelineStatus['jobs'], React.ComponentProps<typeof Ionicons>['name']> = {
        populateIdeas: 'bulb-outline',
        generateScript: 'document-text-outline',
        renderScenes: 'film-outline',
        generateVoiceover: 'mic-outline',
        assembleLongForm: 'construct-outline',
        generateThumbnail: 'image-outline',
        uploadYoutube: 'logo-youtube',
        shortsProcessing: 'play-circle-outline',
    };
    return map[key];
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ result }: { result: JobResult }) {
    const config = {
        success: { bg: '#D1FAE5', text: '#065F46', label: 'success', icon: 'checkmark-circle' as const },
        failure: { bg: '#FEE2E2', text: '#991B1B', label: 'failed', icon: 'close-circle' as const },
        skipped: { bg: '#F3F4F6', text: '#6B7280', label: 'skipped', icon: 'remove-circle' as const },
        cancelled: { bg: '#FEF3C7', text: '#92400E', label: 'cancelled', icon: 'ban' as const },
    };

    if (!result) {
        return (
            <View style={[styles.badge, { backgroundColor: '#F3F4F6' }]}>
                <Text style={[styles.badgeText, { color: '#6B7280' }]}>–</Text>
            </View>
        );
    }

    const c = config[result] ?? config.skipped;
    return (
        <View style={[styles.badge, { backgroundColor: c.bg }]}>
            <Ionicons name={c.icon} size={12} color={c.text} />
            <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
        </View>
    );
}

function JobRow({ jobKey, result }: { jobKey: keyof PipelineStatus['jobs']; result: JobResult }) {
    return (
        <View style={styles.jobRow}>
            <View style={styles.jobLeft}>
                <Ionicons name={jobIcon(jobKey)} size={16} color={colors.foregroundMuted} />
                <Text style={styles.jobLabel}>{jobLabel(jobKey)}</Text>
            </View>
            <StatusBadge result={result} />
        </View>
    );
}

// ─── main screen ──────────────────────────────────────────────────────────────

export default function PipelineStatusScreen() {
    const [status, setStatus] = useState<PipelineStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setError(null);
        const resp = await pipelineApi.getPipelineStatus();
        if (resp.ok) {
            setStatus(resp.status ?? null);
        } else {
            setError(resp.error ?? 'Failed to load pipeline status');
        }
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <LoadingSpinner message="Loading pipeline status…" />
            </View>
        );
    }

    const isSuccess = status?.overallStatus === 'success';
    const youtubeUrl = status?.youtubeId
        ? `https://youtube.com/watch?v=${status.youtubeId}`
        : null;

    const jobKeys = Object.keys(status?.jobs ?? {}) as Array<keyof PipelineStatus['jobs']>;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
            {/* Pipeline load error */}
            {error && !status && (
                <View style={styles.card}>
                    <ErrorMessage message={error} onRetry={load} />
                </View>
            )}

            {/* Empty state — no pipeline runs yet */}
            {!error && !status && (
                <View style={[styles.card, styles.emptyState]}>
                    <Ionicons name="hourglass-outline" size={48} color={colors.foregroundMuted} />
                    <Text style={styles.emptyTitle}>No pipeline runs yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Once a video pipeline completes, the results will appear here.
                    </Text>
                </View>
            )}

            {/* Overall status card */}
            {status && (
                <View style={[styles.card, styles.overallCard, { borderLeftColor: isSuccess ? '#10B981' : '#EF4444' }]}>
                    <View style={styles.overallRow}>
                        <Ionicons
                            name={isSuccess ? 'checkmark-circle' : 'close-circle'}
                            size={32}
                            color={isSuccess ? '#10B981' : '#EF4444'}
                        />
                        <View style={{ marginLeft: spacing.md, flex: 1 }}>
                            <Text style={styles.overallTitle}>
                                {isSuccess ? 'Pipeline Succeeded ✅' : 'Pipeline Failed ❌'}
                            </Text>
                            {status?.videoTitle ? (
                                <Text style={styles.videoTitle} numberOfLines={2}>{status.videoTitle}</Text>
                            ) : null}
                            {status?.ranAt ? (
                                <Text style={styles.overallSubtitle}>
                                    {formatRelativeTime(status.ranAt)} · {new Date(status.ranAt).toLocaleString()}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    {youtubeUrl && (
                        <TouchableOpacity
                            style={styles.youtubeButton}
                            onPress={() => Linking.openURL(youtubeUrl)}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-youtube" size={16} color="#FFFFFF" />
                            <Text style={styles.youtubeButtonText}>Watch on YouTube</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Per-job status */}
            {status && (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Job Details</Text>
                    {jobKeys.map((key) => (
                        <JobRow key={key} jobKey={key} result={status.jobs[key]} />
                    ))}
                </View>
            )}

            {/* Empty state */}
            {!status && !loading && (
                <View style={styles.centered}>
                    <Ionicons name="git-branch-outline" size={48} color={colors.foregroundMuted} />
                    <Text style={styles.emptyText}>No pipeline runs yet.</Text>
                    <Text style={styles.emptySubText}>
                        Results appear here after the GitHub Actions pipeline completes.
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    content: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xxxl,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        ...shadows.md,
    },
    overallCard: {
        borderLeftWidth: 4,
    },
    overallRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    overallTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    overallSubtitle: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        marginTop: 2,
    },
    videoTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        marginTop: 4,
        marginBottom: 2,
    },
    youtubeButton: {
        marginTop: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#EF4444',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    youtubeButtonText: {
        color: '#FFFFFF',
        fontWeight: typography.fontWeightSemibold,
        fontSize: typography.fontSizeSm,
    },
    sectionTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: spacing.md,
    },
    jobRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
    },
    jobLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    jobLabel: {
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        fontWeight: typography.fontWeightMedium,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: typography.fontWeightSemibold,
    },
    emptyText: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        marginTop: spacing.md,
    },
    emptySubText: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        textAlign: 'center',
        marginTop: spacing.sm,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
        gap: spacing.sm,
    },
    emptyTitle: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        marginTop: spacing.sm,
    },
    emptySubtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});
