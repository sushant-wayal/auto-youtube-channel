import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    FlatList,
    RefreshControl,
    TouchableOpacity,
    StyleSheet,
    Linking,
    Image,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { pipelineApi, PipelineStatus, JobResult, ShortResult } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH - spacing.lg * 2 - spacing.lg * 2;

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

// ─── StatusBadge ──────────────────────────────────────────────────────────────

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

// ─── CopyButton ───────────────────────────────────────────────────────────────

function CopyButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        await Clipboard.setStringAsync(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <TouchableOpacity style={styles.actionBtn} onPress={handle} activeOpacity={0.7}>
            <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={13}
                color={copied ? colors.success : colors.foregroundMuted}
            />
            <Text style={[styles.actionBtnText, copied && { color: colors.success }]}>
                {copied ? 'Copied!' : 'Copy link'}
            </Text>
        </TouchableOpacity>
    );
}

function OpenButton({ url, label = 'Open' }: { url: string; label?: string }) {
    return (
        <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(url)} activeOpacity={0.7}>
            <Ionicons name="open-outline" size={13} color={colors.foregroundMuted} />
            <Text style={styles.actionBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

function YouTubeButton({ youtubeId, label = 'Watch on YouTube' }: { youtubeId: string; label?: string }) {
    return (
        <TouchableOpacity
            style={styles.youtubeBtn}
            onPress={() => Linking.openURL(`https://youtube.com/watch?v=${youtubeId}`)}
            activeOpacity={0.8}
        >
            <Ionicons name="logo-youtube" size={15} color="#fff" />
            <Text style={styles.youtubeBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────

function AudioPlayer({ uri, narration }: { uri: string; narration?: string }) {
    const player = useAudioPlayer(uri);
    const status = useAudioPlayerStatus(player);

    const handleToggle = () => {
        if (status.playing) {
            player.pause();
        } else {
            player.play();
        }
    };

    return (
        <View style={styles.audioPlayer}>
            <TouchableOpacity onPress={handleToggle} activeOpacity={0.8}>
                <Ionicons
                    name={status.playing ? 'pause-circle' : 'play-circle'}
                    size={44}
                    color={colors.primary}
                />
            </TouchableOpacity>
            {narration ? (
                <Text style={styles.audioNarration} numberOfLines={4}>{narration}</Text>
            ) : null}
        </View>
    );
}

// ─── MediaCarousel ────────────────────────────────────────────────────────────

function MediaCarousel({
    urls,
    type,
    narrations,
}: {
    urls: string[];
    type: 'video' | 'audio';
    narrations?: string[];
}) {
    const [activeIndex, setActiveIndex] = useState(0);
    if (!urls || urls.length === 0) return null;

    return (
        <View>
            <View style={styles.carouselHeader}>
                <Text style={styles.carouselCounter}>{activeIndex + 1} / {urls.length}</Text>
                <View style={styles.dotsRow}>
                    {urls.map((_, i) => (
                        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                    ))}
                </View>
            </View>
            <FlatList
                data={urls}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={CAROUSEL_ITEM_WIDTH + spacing.md}
                decelerationRate="fast"
                contentContainerStyle={{ gap: spacing.md }}
                onMomentumScrollEnd={(e) => {
                    const i = Math.round(
                        e.nativeEvent.contentOffset.x / (CAROUSEL_ITEM_WIDTH + spacing.md)
                    );
                    setActiveIndex(Math.min(i, urls.length - 1));
                }}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index }) =>
                    type === 'video' ? (
                        <VideoCarouselItem key={item} url={item} />
                    ) : (
                        <View style={[styles.carouselItem, { width: CAROUSEL_ITEM_WIDTH }]}>
                            <AudioPlayer uri={item} narration={narrations?.[index]} />
                            <View style={styles.mediaActions}>
                                <CopyButton url={item} />
                                <OpenButton url={item} label="Open audio" />
                            </View>
                        </View>
                    )
                }
            />
        </View>
    );
}

// ─── JobSection (accordion) ───────────────────────────────────────────────────

function JobSection({
    title,
    icon,
    result,
    children,
    defaultExpanded = false,
}: {
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    result: JobResult;
    children?: React.ReactNode;
    defaultExpanded?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const hasContent = !!children;

    return (
        <View style={styles.jobSection}>
            <TouchableOpacity
                style={styles.jobHeader}
                onPress={() => hasContent && setExpanded(v => !v)}
                activeOpacity={hasContent ? 0.7 : 1}
            >
                <View style={styles.jobHeaderLeft}>
                    <Ionicons name={icon} size={17} color={colors.foreground} />
                    <Text style={styles.jobTitle}>{title}</Text>
                </View>
                <View style={styles.jobHeaderRight}>
                    <StatusBadge result={result} />
                    {hasContent && (
                        <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={15}
                            color={colors.foregroundMuted}
                            style={{ marginLeft: spacing.sm }}
                        />
                    )}
                </View>
            </TouchableOpacity>
            {expanded && hasContent && (
                <View style={styles.jobBody}>{children}</View>
            )}
        </View>
    );
}

// ─── Per-job output components ────────────────────────────────────────────────

function IdeasOutput({ ideas }: { ideas?: string[] }) {
    if (!ideas || ideas.length === 0) {
        return <Text style={styles.outputNote}>Queue was already full — no new ideas were added.</Text>;
    }
    return (
        <View style={{ gap: spacing.sm }}>
            {ideas.map((idea, i) => (
                <View key={i} style={styles.ideaRow}>
                    <View style={styles.ideaBullet} />
                    <Text style={styles.ideaText}>{idea}</Text>
                </View>
            ))}
        </View>
    );
}

function ScriptOutput({
    title,
    description,
    sceneNarrations,
    shortHooks,
    scriptData,
}: {
    title?: string;
    description?: string;
    sceneNarrations?: string[];
    shortHooks?: string[];
    scriptData?: unknown;
}) {
    const [showScenes, setShowScenes] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyJson = async () => {
        const raw = JSON.stringify(scriptData ?? { title, description, sceneNarrations, shortHooks }, null, 2);
        await Clipboard.setStringAsync(raw);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <View style={{ gap: spacing.md }}>
            <TouchableOpacity style={styles.copyJsonBtn} onPress={handleCopyJson} activeOpacity={0.7}>
                <Ionicons
                    name={copied ? 'checkmark' : 'code-slash-outline'}
                    size={13}
                    color={copied ? colors.success : colors.foregroundMuted}
                />
                <Text style={[styles.copyJsonBtnText, copied && { color: colors.success }]}>
                    {copied ? 'Copied!' : 'Copy raw JSON'}
                </Text>
            </TouchableOpacity>
            {title ? <Text style={styles.scriptTitle}>{title}</Text> : null}
            {description ? (
                <Text style={styles.scriptDescription} numberOfLines={4}>{description}</Text>
            ) : null}

            {sceneNarrations && sceneNarrations.length > 0 && (
                <View>
                    <TouchableOpacity
                        style={styles.toggleRow}
                        onPress={() => setShowScenes(v => !v)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="film-outline" size={14} color={colors.foregroundMuted} />
                        <Text style={styles.toggleLabel}>{sceneNarrations.length} scenes</Text>
                        <Ionicons
                            name={showScenes ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color={colors.foregroundMuted}
                        />
                    </TouchableOpacity>
                    {showScenes && (
                        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                            {sceneNarrations.map((n, i) => (
                                <View key={i} style={styles.sceneRow}>
                                    <Text style={styles.sceneNum}>Scene {i + 1}</Text>
                                    <Text style={styles.sceneText}>{n}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {shortHooks && shortHooks.length > 0 && (
                <View style={{ gap: spacing.sm }}>
                    <Text style={styles.subSectionLabel}>Short hooks ({shortHooks.length})</Text>
                    {shortHooks.map((hook, i) => (
                        <View key={i} style={styles.hookRow}>
                            <Text style={styles.hookNum}>#{i + 1}</Text>
                            <Text style={styles.hookText}>{hook}</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

function ThumbnailOutput({ url }: { url: string }) {
    return (
        <View style={{ gap: spacing.sm }}>
            <Image source={{ uri: url }} style={styles.thumbnailImage} resizeMode="cover" />
            <View style={styles.mediaActions}>
                <CopyButton url={url} />
                <OpenButton url={url} label="Open image" />
            </View>
        </View>
    );
}

function VideoPlayerView({ url, style }: { url: string; style: object }) {
    const player = useVideoPlayer(url, p => { p.loop = false; });
    return (
        <VideoView
            player={player}
            style={style}
            nativeControls
            contentFit="contain"
        />
    );
}

function VideoCarouselItem({ url }: { url: string }) {
    return (
        <View style={[styles.carouselItem, { width: CAROUSEL_ITEM_WIDTH }]}>
            <VideoPlayerView url={url} style={styles.videoPlayer} />
            <View style={styles.mediaActions}>
                <CopyButton url={url} />
                <OpenButton url={url} />
            </View>
        </View>
    );
}

function AssembledVideoOutput({ url }: { url: string }) {
    return (
        <View style={{ gap: spacing.sm }}>
            <VideoPlayerView url={url} style={styles.assembledVideo} />
            <View style={styles.mediaActions}>
                <CopyButton url={url} />
                <OpenButton url={url} label="Open video" />
            </View>
        </View>
    );
}

function ShortsOutput({ shorts, shortHooks }: { shorts?: ShortResult[]; shortHooks?: string[] }) {
    if (!shorts || shorts.length === 0) {
        return <Text style={styles.outputNote}>No shorts data available yet.</Text>;
    }
    return (
        <View style={{ gap: 2 }}>
            {[...shorts]
                .sort((a, b) => a.shortIndex - b.shortIndex)
                .map((s) => (
                    <View key={s.shortIndex} style={styles.shortRow}>
                        <View style={styles.shortInfo}>
                            <Text style={styles.shortLabel}>Short {s.shortIndex + 1}</Text>
                            {shortHooks?.[s.shortIndex] ? (
                                <Text style={styles.shortHook} numberOfLines={2}>
                                    {shortHooks[s.shortIndex]}
                                </Text>
                            ) : null}
                            {s.reelCaption ? (
                                <Text style={styles.reelCaption} numberOfLines={3}>
                                    {s.reelCaption}
                                </Text>
                            ) : null}
                        </View>
                        <View style={styles.shortActions}>
                            <YouTubeButton youtubeId={s.youtubeId} label="YouTube" />
                            {s.instagramPermalink ? (
                                <TouchableOpacity
                                    style={styles.instagramButton}
                                    onPress={() => Linking.openURL(s.instagramPermalink!)}
                                >
                                    <Text style={styles.instagramButtonText}>Instagram</Text>
                                </TouchableOpacity>
                            ) : null}
                            {s.videoUrl ? <CopyButton url={s.videoUrl} /> : null}
                        </View>
                    </View>
                ))}
        </View>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

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
                <LoadingSpinner />
            </View>
        );
    }

    const isSuccess = status?.overallStatus === 'success';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
            {/* Error */}
            {error && !status && (
                <View style={styles.card}>
                    <ErrorMessage message={error} />
                    <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.7}>
                        <Ionicons name="refresh" size={14} color={colors.foreground} />
                        <Text style={styles.retryBtnText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Empty state */}
            {!error && !status && (
                <View style={[styles.card, styles.emptyState]}>
                    <Ionicons name="hourglass-outline" size={48} color={colors.foregroundMuted} />
                    <Text style={styles.emptyTitle}>No pipeline runs yet</Text>
                    <Text style={styles.emptySubtitle}>
                        Once a video pipeline completes, results will appear here.
                    </Text>
                </View>
            )}

            {/* ── Overall status card ── */}
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
                            {status.videoTitle ? (
                                <Text style={styles.videoTitleText} numberOfLines={2}>{status.videoTitle}</Text>
                            ) : null}
                            {status.ranAt ? (
                                <Text style={styles.overallSubtitle}>
                                    {formatRelativeTime(status.ranAt)} · {new Date(status.ranAt).toLocaleString()}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                    {status.youtubeId ? <YouTubeButton youtubeId={status.youtubeId} /> : null}
                </View>
            )}

            {/* ── Per-job accordion sections ── */}
            {status && (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Pipeline Jobs</Text>

                    {/* 1 */}
                    <JobSection title="Populate Ideas" icon="bulb-outline" result={status.jobs.populateIdeas}>
                        <IdeasOutput ideas={status.ideasAdded} />
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 2 */}
                    <JobSection title="Generate Script" icon="document-text-outline" result={status.jobs.generateScript}>
                        <ScriptOutput
                            title={status.videoTitle}
                            description={status.description ?? undefined}
                            sceneNarrations={status.sceneNarrations}
                            shortHooks={status.shortHooks}
                            scriptData={status.scriptData}
                        />
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 3 */}
                    <JobSection title="Render Scenes" icon="film-outline" result={status.jobs.renderScenes}>
                        {status.sceneUrls && status.sceneUrls.length > 0 ? (
                            <MediaCarousel urls={status.sceneUrls} type="video" narrations={status.sceneNarrations} />
                        ) : (
                            <Text style={styles.outputNote}>No scene videos available.</Text>
                        )}
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 4 */}
                    <JobSection title="Generate Voiceover" icon="mic-outline" result={status.jobs.generateVoiceover}>
                        {status.voiceoverUrls && status.voiceoverUrls.length > 0 ? (
                            <MediaCarousel urls={status.voiceoverUrls} type="audio" narrations={status.sceneNarrations} />
                        ) : (
                            <Text style={styles.outputNote}>No voiceover audio available.</Text>
                        )}
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 5 */}
                    <JobSection title="Assemble Video" icon="construct-outline" result={status.jobs.assembleLongForm}>
                        {status.videoUrl ? (
                            <AssembledVideoOutput url={status.videoUrl} />
                        ) : (
                            <Text style={styles.outputNote}>No assembled video URL.</Text>
                        )}
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 6 */}
                    <JobSection title="Generate Thumbnail" icon="image-outline" result={status.jobs.generateThumbnail}>
                        {status.thumbnailUrl ? (
                            <ThumbnailOutput url={status.thumbnailUrl} />
                        ) : (
                            <Text style={styles.outputNote}>No thumbnail URL.</Text>
                        )}
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 7 */}
                    <JobSection title="Upload to YouTube" icon="logo-youtube" result={status.jobs.uploadYoutube}>
                        {status.youtubeId ? (
                            <View style={styles.mediaActions}>
                                <YouTubeButton youtubeId={status.youtubeId} />
                            </View>
                        ) : (
                            <Text style={styles.outputNote}>No YouTube ID available.</Text>
                        )}
                    </JobSection>
                    <View style={styles.divider} />

                    {/* 8 */}
                    <JobSection title="Shorts Processing" icon="play-circle-outline" result={status.jobs.shortsProcessing}>
                        <ShortsOutput shorts={status.shorts} shortHooks={status.shortHooks} />
                    </JobSection>
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
        paddingBottom: spacing.xxxl,
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
    overallCard: { borderLeftWidth: 4 },
    overallRow: { flexDirection: 'row', alignItems: 'flex-start' },
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
    videoTitleText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        marginTop: 4,
        marginBottom: 2,
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
    sectionTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: spacing.md,
    },
    jobSection: { paddingVertical: spacing.xs },
    jobHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
    },
    jobHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
    },
    jobHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    jobTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.foreground,
    },
    jobBody: { paddingBottom: spacing.sm, paddingTop: spacing.xs },
    divider: {
        height: 1,
        backgroundColor: colors.borderLight,
        marginVertical: 2,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3,
        borderRadius: 999,
    },
    badgeText: { fontSize: 11, fontWeight: typography.fontWeightSemibold },

    // buttons
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.sm,
    },
    actionBtnText: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        fontWeight: typography.fontWeightMedium,
    },
    mediaActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        flexWrap: 'wrap',
    },
    youtubeBtn: {
        marginTop: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: '#EF4444',
        borderRadius: borderRadius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        alignSelf: 'flex-start',
    },
    youtubeBtnText: {
        color: '#fff',
        fontWeight: typography.fontWeightSemibold,
        fontSize: typography.fontSizeSm,
    },

    // carousel
    carouselHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    carouselCounter: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        fontWeight: typography.fontWeightMedium,
    },
    dotsRow: { flexDirection: 'row', gap: 4 },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
    dotActive: { backgroundColor: colors.primary },
    carouselItem: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        overflow: 'hidden',
    },
    videoPlayer: {
        width: '100%',
        height: 200,
        backgroundColor: '#000',
        borderRadius: borderRadius.sm,
    },
    assembledVideo: {
        width: '100%',
        height: 220,
        backgroundColor: '#000',
        borderRadius: borderRadius.md,
    },
    thumbnailImage: {
        width: '100%',
        height: 180,
        borderRadius: borderRadius.md,
        backgroundColor: colors.backgroundSecondary,
    },

    // audio
    audioPlayer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm,
    },
    audioNarration: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 20,
    },

    // ideas
    ideaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
    ideaBullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
        marginTop: 6,
    },
    ideaText: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 20,
    },

    // script
    scriptTitle: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    copyJsonBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing.xs,
        paddingVertical: 5,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    copyJsonBtnText: {
        fontSize: 12,
        color: colors.foregroundMuted,
        fontWeight: '500',
    },
    scriptDescription: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        lineHeight: 20,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.xs,
    },
    toggleLabel: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        fontWeight: typography.fontWeightMedium,
    },
    sceneRow: {
        backgroundColor: colors.backgroundSecondary,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        gap: 2,
    },
    sceneNum: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
    },
    sceneText: {
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 18,
    },
    subSectionLabel: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    hookRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    hookNum: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        width: 20,
        marginTop: 2,
    },
    hookText: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 18,
    },

    // shorts
    shortRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderLight,
        gap: spacing.md,
    },
    shortInfo: { flex: 1, gap: 2 },
    shortLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    shortHook: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        lineHeight: 16,
    },
    reelCaption: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        marginTop: spacing.xs,
        fontStyle: 'italic',
        lineHeight: 14,
    },
    instagramButton: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: '#E1306C',
        borderRadius: borderRadius.sm,
    },
    instagramButtonText: {
        color: '#fff',
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightSemibold,
    },
    shortActions: { gap: spacing.xs, alignItems: 'flex-end' },
    outputNote: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        fontStyle: 'italic',
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginTop: spacing.sm,
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.sm,
    },
    retryBtnText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.foreground,
    },
});
