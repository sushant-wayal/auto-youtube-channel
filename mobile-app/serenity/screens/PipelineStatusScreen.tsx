import React, { useEffect, useState, useCallback, useRef } from 'react';
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
    LayoutAnimation,
    Animated,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { pipelineApi, PipelineStatus, JobResult, ShortResult } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import ErrorMessage from '../components/ErrorMessage';
import { colors, spacing, borderRadius, typography, shadows, gradients } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH - 124;

const triggerLayoutAnim = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

// Jobs list in sequence for active step tracking
const jobKeys = [
    'populateIdeas',
    'generateScript',
    'renderScenes',
    'generateVoiceover',
    'assembleLongForm',
    'generateThumbnail',
    'uploadYoutube',
    'shortsProcessing',
];

// Helper to calculate job state
const getJobState = (key: string, result: JobResult, jobs: Record<string, JobResult>) => {
    if (result === 'success') return 'success';
    if (result === 'failure') return 'failure';
    if (result === 'cancelled') return 'cancelled';
    if (result === 'skipped') return 'skipped';
    if (result === 'running') return 'running';

    // If it hasn't started yet, it remains pending.
    // The pipeline contains parallel steps, so we don't assume sequential order.
    return 'pending';
};

function formatRelativeTime(isoString: string): string {
    const ms = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// ─── AnimatedRotateIcon ───────────────────────────────────────────────────────
function AnimatedRotateIcon({ name, size, color }: { name: any; size: number; color: string }) {
    const rotate = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(rotate, {
                toValue: 1,
                duration: 1200,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const rotation = rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name={name} size={size} color={color} />
        </Animated.View>
    );
}

// ─── PulsingNode ─────────────────────────────────────────────────────────────
function PulsingNode() {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        Animated.loop(
            Animated.parallel([
                Animated.timing(scale, {
                    toValue: 1.6,
                    duration: 1400,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 1400,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    return (
        <View style={styles.pulseContainer}>
            <Animated.View
                style={[
                    styles.pulseRing,
                    {
                        transform: [{ scale }],
                        opacity: opacity,
                    },
                ]}
            />
            <View style={styles.pulseDot} />
        </View>
    );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ state }: { state: 'success' | 'failure' | 'skipped' | 'cancelled' | 'running' | 'pending' }) {
    const config = {
        success: { bg: 'rgba(16, 185, 129, 0.08)', text: colors.successGlow, label: 'success', icon: 'checkmark-circle' as const },
        failure: { bg: 'rgba(244, 63, 94, 0.08)', text: colors.destructive, label: 'failed', icon: 'close-circle' as const },
        skipped: { bg: 'rgba(148, 163, 184, 0.06)', text: colors.foregroundMuted, label: 'skipped', icon: 'remove-circle' as const },
        cancelled: { bg: 'rgba(245, 158, 11, 0.1)', text: '#F59E0B', label: 'cancelled', icon: 'ban' as const },
        running: { bg: 'rgba(139, 92, 246, 0.12)', text: colors.primary, label: 'running', icon: 'sync' as const },
        pending: { bg: 'rgba(148, 163, 184, 0.03)', text: colors.mutedForeground, label: 'queued', icon: 'ellipse-outline' as const },
    };
    const c = config[state] ?? config.pending;

    return (
        <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.text + '22', borderWidth: 1 }]}>
            {state === 'running' ? (
                <AnimatedRotateIcon name={c.icon} size={11} color={c.text} />
            ) : (
                <Ionicons name={c.icon} size={11} color={c.text} />
            )}
            <Text style={[styles.badgeText, { color: c.text }]}>{c.label}</Text>
        </View>
    );
}

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ url, label = 'Copy link' }: { url: string; label?: string }) {
    const [copied, setCopied] = useState(false);
    const scale = useRef(new Animated.Value(1)).current;

    const handle = async () => {
        Animated.sequence([
            Animated.spring(scale, { toValue: 0.9, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();

        await Clipboard.setStringAsync(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TouchableOpacity onPress={handle} activeOpacity={1}>
            <Animated.View style={[styles.actionBtn, copied && styles.actionBtnCopied, { transform: [{ scale }] }]}>
                <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={12}
                    color={copied ? colors.successGlow : colors.foregroundMuted}
                />
                <Text style={[styles.actionBtnText, copied && { color: colors.successGlow }]}>
                    {copied ? 'Copied!' : label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

function OpenButton({ url, label = 'Open' }: { url: string; label?: string }) {
    return (
        <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(url)} activeOpacity={0.75}>
            <Ionicons name="open-outline" size={12} color={colors.foregroundMuted} />
            <Text style={styles.actionBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

function YouTubeButton({ youtubeId, label = 'Watch on YouTube' }: { youtubeId: string; label?: string }) {
    return (
        <TouchableOpacity
            style={styles.youtubeBtn}
            onPress={() => Linking.openURL(`https://youtube.com/watch?v=${youtubeId}`)}
            activeOpacity={0.85}
        >
            <Ionicons name="logo-youtube" size={14} color={colors.primaryForeground} />
            <Text style={styles.youtubeBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
function AudioPlayer({ uri, narration }: { uri: string; narration?: string }) {
    const player = useAudioPlayer(uri);
    const status = useAudioPlayerStatus(player);
    const scale = useRef(new Animated.Value(1)).current;

    const duration = status.duration || 0;
    const currentTime = status.currentTime || 0;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const isMs = duration > 1000;

    const formatTime = (timeValue: number): string => {
        if (isNaN(timeValue) || timeValue <= 0) return '0:00';
        const seconds = isMs ? timeValue / 1000 : timeValue;
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleToggle = () => {
        Animated.sequence([
            Animated.spring(scale, { toValue: 0.85, useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
        ]).start();

        if (status.playing) {
            player.pause();
        } else {
            player.play();
        }
    };

    return (
        <View style={styles.audioPlayerDeck}>
            <View style={styles.audioControls}>
                <TouchableOpacity onPress={handleToggle} activeOpacity={1}>
                    <Animated.View style={{ transform: [{ scale }] }}>
                        <LinearGradient
                            colors={gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.playButtonGradient}
                        >
                            <Ionicons
                                name={status.playing ? 'pause' : 'play'}
                                size={18}
                                color={colors.primaryForeground}
                                style={!status.playing && { marginLeft: 2 }}
                            />
                        </LinearGradient>
                    </Animated.View>
                </TouchableOpacity>

                <View style={styles.audioTrackContainer}>
                    <View style={styles.audioTrackHeader}>
                        <Text style={styles.audioTrackTime}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </Text>
                    </View>
                    <View style={styles.audioTrackLine}>
                        <View style={[styles.audioTrackFill, { width: `${progress}%` }]} />
                        <View style={[styles.audioTrackHandle, { left: `${progress}%` }]} />
                    </View>
                </View>
            </View>

            {narration ? (
                <View style={styles.quoteBox}>
                    <Text style={styles.quoteSymbol}>“</Text>
                    <Text style={styles.audioNarration} numberOfLines={4}>
                        {narration}
                    </Text>
                </View>
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
        <View style={styles.carouselContainer}>
            <View style={styles.carouselHeader}>
                <Text style={styles.carouselCounter}>
                    ITEM {activeIndex + 1} OF {urls.length}
                </Text>
                <View style={styles.dotsRow}>
                    {urls.map((_, i) => (
                        <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
                    ))}
                </View>
            </View>
            <FlatList
                data={urls}
                horizontal
                pagingEnabled={false}
                snapToInterval={CAROUSEL_ITEM_WIDTH + spacing.md}
                snapToAlignment="start"
                decelerationRate="fast"
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing.md }}
                onMomentumScrollEnd={(e) => {
                    const i = Math.round(e.nativeEvent.contentOffset.x / (CAROUSEL_ITEM_WIDTH + spacing.md));
                    setActiveIndex(Math.min(i, urls.length - 1));
                }}
                keyExtractor={(_, i) => String(i)}
                renderItem={({ item, index }) =>
                    type === 'video' ? (
                        <View style={[styles.carouselItem, { width: CAROUSEL_ITEM_WIDTH }]}>
                            <VideoCarouselItem key={item} url={item} />
                        </View>
                    ) : (
                        <View style={[styles.carouselItem, { width: CAROUSEL_ITEM_WIDTH }]}>
                            <AudioPlayer key={item} uri={item} narration={narrations?.[index]} />
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
    state,
    children,
    defaultExpanded = false,
}: {
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    state: 'success' | 'failure' | 'skipped' | 'cancelled' | 'running' | 'pending';
    children?: React.ReactNode;
    defaultExpanded?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const hasContent = !!children;

    const handleToggle = () => {
        triggerLayoutAnim();
        setExpanded(!expanded);
    };

    return (
        <View style={styles.jobSection}>
            {/* Left timeline connection */}
            <View style={styles.timelineNodeContainer}>
                {state === 'running' ? (
                    <PulsingNode />
                ) : (
                    <View
                        style={[
                            styles.timelineDot,
                            state === 'success' && styles.dotSuccess,
                            state === 'failure' && styles.dotFailure,
                            state === 'pending' && styles.dotPending,
                            state === 'skipped' && styles.dotSkipped,
                        ]}
                    >
                        <Ionicons
                            name={
                                state === 'success'
                                    ? 'checkmark'
                                    : state === 'failure'
                                        ? 'close'
                                        : state === 'cancelled'
                                            ? 'ban'
                                            : 'ellipse'
                            }
                            size={10}
                            color={
                                state === 'success' || state === 'failure' ? '#FFFFFF' : colors.foregroundMuted
                            }
                        />
                    </View>
                )}
            </View>

            {/* Accordion Box */}
            <TouchableOpacity
                style={[
                    styles.jobHeader,
                    expanded && styles.jobHeaderExpanded,
                    state === 'running' && styles.jobHeaderRunning,
                ]}
                onPress={() => hasContent && handleToggle()}
                activeOpacity={hasContent ? 0.82 : 1}
            >
                <Ionicons name={icon} size={15} color={colors.foreground} style={{ marginRight: spacing.sm }} />
                <Text
                    style={[styles.jobTitle, state === 'running' && styles.jobTitleRunning]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                >
                    {title}
                </Text>
                <View style={styles.jobHeaderRight}>
                    <StatusBadge state={state} />
                    {hasContent && (
                        <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color={colors.foregroundMuted}
                            style={{ marginLeft: spacing.sm }}
                        />
                    )}
                </View>
            </TouchableOpacity>
            {expanded && hasContent && <View style={styles.jobBody}>{children}</View>}
        </View>
    );
}

// ─── Per-job output components ────────────────────────────────────────────────
function IdeasOutput({ ideas }: { ideas?: string[] }) {
    if (!ideas || ideas.length === 0) {
        return <Text style={styles.outputNote}>Queue was already full — no new ideas were added.</Text>;
    }
    return (
        <View style={styles.ideasOutputContainer}>
            {ideas.map((idea, i) => (
                <View key={i} style={styles.ideaRow}>
                    <LinearGradient
                        colors={gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.ideaBullet}
                    />
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
    const [showRaw, setShowRaw] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyJson = async () => {
        const raw = JSON.stringify(scriptData ?? { title, description, sceneNarrations, shortHooks }, null, 2);
        await Clipboard.setStringAsync(raw);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };


    return (
        <View style={styles.scriptOutputContainer}>
            {title ? <Text style={styles.scriptTitle}>{title}</Text> : null}
            {description ? <Text style={styles.scriptDescription}>{description}</Text> : null}

            {sceneNarrations && sceneNarrations.length > 0 && (
                <View style={styles.sceneDropdownContainer}>
                    <TouchableOpacity
                        style={styles.toggleRow}
                        onPress={() => {
                            triggerLayoutAnim();
                            setShowScenes(!showScenes);
                        }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="film-outline" size={13} color={colors.gradientTo} />
                        <Text style={styles.toggleLabel}>{sceneNarrations.length} Video Scenes</Text>
                        <Ionicons
                            name={showScenes ? 'chevron-up' : 'chevron-down'}
                            size={14}
                            color={colors.foregroundMuted}
                        />
                    </TouchableOpacity>
                    {showScenes && (
                        <View style={styles.scenesList}>
                            {sceneNarrations.map((n, i) => (
                                <View key={i} style={styles.sceneRow}>
                                    <Text style={styles.sceneNum}>SCENE {i + 1}</Text>
                                    <Text style={styles.sceneText}>{n}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            )}

            {shortHooks && shortHooks.length > 0 && (
                <View style={styles.hooksContainer}>
                    <Text style={styles.subSectionLabel}>Short Hooks ({shortHooks.length})</Text>
                    {shortHooks.map((hook, i) => (
                        <View key={i} style={styles.hookRow}>
                            <Text style={styles.hookNum}>#{i + 1}</Text>
                            <Text style={styles.hookText}>{hook}</Text>
                        </View>
                    ))}
                </View>
            )}


            {/* Expander for JSON */}
            <View style={styles.jsonTerminalContainer}>
                <TouchableOpacity
                    style={styles.jsonTerminalHeader}
                    onPress={() => {
                        triggerLayoutAnim();
                        setShowRaw(!showRaw);
                    }}
                    activeOpacity={0.8}
                >
                    <View style={styles.terminalDotRow}>
                        <View style={[styles.terminalDot, { backgroundColor: '#EF4444' }]} />
                        <View style={[styles.terminalDot, { backgroundColor: '#F59E0B' }]} />
                        <View style={[styles.terminalDot, { backgroundColor: '#10B981' }]} />
                    </View>
                    <Text style={styles.terminalTitle}>script_data.json</Text>
                    <Ionicons
                        name={showRaw ? 'chevron-up' : 'code-slash-outline'}
                        size={13}
                        color={colors.foregroundMuted}
                    />
                </TouchableOpacity>

                {showRaw && (
                    <View style={styles.terminalContent}>
                        <TouchableOpacity style={styles.copyJsonBtn} onPress={handleCopyJson} activeOpacity={0.75}>
                            <Ionicons name={copied ? 'checkmark' : 'copy'} size={12} color={colors.foreground} />
                            <Text style={styles.copyJsonBtnText}>{copied ? 'Copied' : 'Copy Code'}</Text>
                        </TouchableOpacity>
                        <ScrollView style={styles.terminalScroll} nestedScrollEnabled={true}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <Text style={styles.terminalText}>
                                    {JSON.stringify(
                                        scriptData ?? { title, description, sceneNarrations, shortHooks },
                                        null,
                                        4
                                    )}
                                </Text>
                            </ScrollView>
                        </ScrollView>
                    </View>
                )}
            </View>
        </View>
    );
}

function ThumbnailOutput({ url }: { url: string }) {
    return (
        <View style={styles.mediaContainer}>
            <View style={styles.imageBezel}>
                <Image source={{ uri: url }} style={styles.thumbnailImage} resizeMode="cover" />
            </View>
            <View style={styles.mediaActions}>
                <CopyButton url={url} />
                <OpenButton url={url} label="Open image" />
            </View>
        </View>
    );
}

function VideoPlayerView({ url, style }: { url: string; style: object }) {
    const player = useVideoPlayer(url, (p) => {
        p.loop = false;
    });

    return <VideoView player={player} style={style} nativeControls contentFit="contain" />;
}

function VideoCarouselItem({ url }: { url: string }) {
    return (
        <View style={styles.videoPlayerFrame}>
            <VideoPlayerView url={url} style={styles.videoPlayer} />
            <View style={styles.frameMediaActions}>
                <CopyButton url={url} />
                <OpenButton url={url} />
            </View>
        </View>
    );
}

function AssembledVideoOutput({ url }: { url: string }) {
    return (
        <View style={styles.mediaContainer}>
            <View style={styles.videoPlayerFrame}>
                <VideoPlayerView key={url} url={url} style={styles.assembledVideo} />
            </View>
            <View style={styles.mediaActions}>
                <CopyButton url={url} />
                <OpenButton url={url} label="Open video" />
            </View>
        </View>
    );
}

function ShortsOutput({
    shorts,
    shortHooks,
    shortCaptions,
}: {
    shorts?: ShortResult[];
    shortHooks?: string[];
    shortCaptions?: string[];
}) {
    if (!shorts || shorts.length === 0) {
        return <Text style={styles.outputNote}>No shorts data available yet.</Text>;
    }
    return (
        <View style={styles.shortsList}>
            {[...shorts]
                .sort((a, b) => a.shortIndex - b.shortIndex)
                .map((s) => (
                    <View key={s.shortIndex} style={styles.shortRow}>
                        <View style={styles.shortInfo}>
                            <Text style={styles.shortLabel}>Short #{s.shortIndex + 1}</Text>
                            {shortHooks?.[s.shortIndex] ? (
                                <Text style={styles.shortHook} numberOfLines={2}>
                                    {shortHooks[s.shortIndex]}
                                </Text>
                            ) : null}
                            {shortCaptions?.[s.shortIndex] ? (
                                <View style={styles.shortCaption}>
                                    <Text style={styles.shortCaptionText} numberOfLines={4}>
                                        {shortCaptions[s.shortIndex]}
                                    </Text>
                                    <CopyButton url={shortCaptions[s.shortIndex]} label="Copy caption" />
                                </View>
                            ) : null}
                        </View>
                        <View style={styles.shortActions}>
                            <YouTubeButton youtubeId={s.youtubeId} label="YouTube" />
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
            triggerLayoutAnim();
            setStatus(resp.status ?? null);
        } else {
            setError(resp.error ?? 'Failed to load pipeline status');
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchStatus = async () => {
            await load();
            if (isMounted) {
                setLoading(false);
            }
        };

        // If pipeline is finished, stop polling to save resources.
        if (status?.overallStatus === 'success' || status?.overallStatus === 'failure') {
            return;
        }

        // Fetch immediately
        fetchStatus();

        // Poll every 10 seconds
        const intervalId = setInterval(() => {
            fetchStatus();
        }, 10000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [load, status?.overallStatus]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    if (loading) {
        return <SkeletonLoader variant="pipeline" />;
    }

    const isSuccess = status?.overallStatus === 'success';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
        >
            {/* Error banner */}
            {error && !status && (
                <View style={styles.card}>
                    <ErrorMessage message={error} />
                    <TouchableOpacity style={styles.retryBtn} onPress={load} activeOpacity={0.8}>
                        <Ionicons name="refresh" size={14} color={colors.foreground} />
                        <Text style={styles.retryBtnText}>Retry connection</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Empty state */}
            {!error && !status && (
                <View style={[styles.card, styles.emptyState]}>
                    <View style={styles.emptyIconShell}>
                        <Ionicons name="git-pull-request" size={32} color={colors.foregroundMuted} />
                    </View>
                    <Text style={styles.emptyTitle}>No Runs Detected</Text>
                    <Text style={styles.emptySubtitle}>
                        When the automated backend channel scheduler triggers a video generation cycle, results appear
                        here in real-time.
                    </Text>
                </View>
            )}

            {/* Overall status dashboard glass card */}
            {status && (
                <LinearGradient
                    colors={isSuccess ? ['#05241C', '#0E1729'] : ['#2D1318', '#0E1729']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.card,
                        styles.overallCard,
                        { borderLeftColor: isSuccess ? colors.successGlow : colors.destructive },
                    ]}
                >
                    <View style={styles.overallRow}>
                        <View style={[styles.statusBigIcon, { backgroundColor: isSuccess ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }]}>
                            <Ionicons
                                name={isSuccess ? 'checkmark-circle' : 'alert-circle'}
                                size={26}
                                color={isSuccess ? colors.successGlow : colors.destructive}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.overallTitle}>
                                {isSuccess ? 'Pipeline Succeeded' : 'Pipeline Failed'}
                            </Text>
                            {status.videoTitle ? (
                                <Text style={styles.videoTitleText} numberOfLines={2}>
                                    {status.videoTitle}
                                </Text>
                            ) : null}
                            {status.ranAt ? (
                                <Text style={styles.overallSubtitle}>
                                    {formatRelativeTime(status.ranAt)} · {new Date(status.ranAt).toLocaleString()}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                    {status.youtubeId ? (
                        <View style={styles.overallYoutubeRow}>
                            <YouTubeButton youtubeId={status.youtubeId} />
                        </View>
                    ) : null}
                </LinearGradient>
            )}

            {/* Timeline track wrapper */}
            {status && (
                <View style={[styles.card, { paddingVertical: spacing.xl }]}>
                    <Text style={styles.sectionTitle}>Pipeline Flow Checkpoints</Text>

                    <View style={styles.pipelineTimeline}>
                        {/* Connecting background vertical track */}
                        <View style={styles.pipelineLine} />

                        {/* Step 1 */}
                        <JobSection
                            title="Populate Ideas"
                            icon="bulb-outline"
                            state={getJobState('populateIdeas', status.jobs.populateIdeas, status.jobs)}
                        >
                            <IdeasOutput ideas={status.ideasAdded} />
                        </JobSection>

                        {/* Step 2 */}
                        <JobSection
                            title="Generate Script"
                            icon="document-text-outline"
                            state={getJobState('generateScript', status.jobs.generateScript, status.jobs)}
                        >
                            <ScriptOutput
                                title={status.videoTitle}
                                description={status.description ?? undefined}
                                sceneNarrations={status.sceneNarrations}
                                shortHooks={status.shortHooks}
                                scriptData={status.scriptData}
                            />
                        </JobSection>

                        {/* Step 3 */}
                        <JobSection
                            title="Render Scenes"
                            icon="film-outline"
                            state={getJobState('renderScenes', status.jobs.renderScenes, status.jobs)}
                        >
                            {status.sceneUrls && status.sceneUrls.length > 0 ? (
                                <MediaCarousel urls={status.sceneUrls} type="video" narrations={status.sceneNarrations} />
                            ) : (
                                <Text style={styles.outputNote}>No scene renders uploaded yet.</Text>
                            )}
                        </JobSection>

                        {/* Step 4 */}
                        <JobSection
                            title="Generate Voiceover"
                            icon="mic-outline"
                            state={getJobState('generateVoiceover', status.jobs.generateVoiceover, status.jobs)}
                        >
                            {status.voiceoverUrls && status.voiceoverUrls.length > 0 ? (
                                <MediaCarousel
                                    urls={status.voiceoverUrls}
                                    type="audio"
                                    narrations={status.sceneNarrations}
                                />
                            ) : (
                                <Text style={styles.outputNote}>No narrations processed.</Text>
                            )}
                        </JobSection>

                        {/* Step 5 */}
                        <JobSection
                            title="Assemble Long-Form"
                            icon="construct-outline"
                            state={getJobState('assembleLongForm', status.jobs.assembleLongForm, status.jobs)}
                        >
                            {status.videoUrl ? (
                                <AssembledVideoOutput url={status.videoUrl} />
                            ) : (
                                <Text style={styles.outputNote}>No final render file.</Text>
                            )}
                        </JobSection>

                        {/* Step 6 */}
                        <JobSection
                            title="Generate Thumbnail"
                            icon="image-outline"
                            state={getJobState('generateThumbnail', status.jobs.generateThumbnail, status.jobs)}
                        >
                            {status.thumbnailUrl ? (
                                <ThumbnailOutput url={status.thumbnailUrl} />
                            ) : (
                                <Text style={styles.outputNote}>No generated thumbnail URL.</Text>
                            )}
                        </JobSection>

                        {/* Step 7 */}
                        <JobSection
                            title="Upload to YouTube"
                            icon="logo-youtube"
                            state={getJobState('uploadYoutube', status.jobs.uploadYoutube, status.jobs)}
                        >
                            {status.youtubeId ? (
                                <View style={styles.mediaActions}>
                                    <YouTubeButton youtubeId={status.youtubeId} label="Watch Youtube Video" />
                                </View>
                            ) : (
                                <Text style={styles.outputNote}>No YouTube asset created.</Text>
                            )}
                        </JobSection>

                        {/* Step 8 */}
                        <JobSection
                            title="Shorts Processing"
                            icon="play-circle-outline"
                            state={getJobState('shortsProcessing', status.jobs.shortsProcessing, status.jobs)}
                        >
                            <ShortsOutput
                                shorts={status.shorts}
                                shortHooks={status.shortHooks}
                                shortCaptions={status.shortCaptions}
                            />
                        </JobSection>
                    </View>
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
        backgroundColor: colors.backgroundSecondary,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.md,
    },
    overallCard: {
        borderLeftWidth: 4,
        ...shadows.sm,
    },
    overallRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    statusBigIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
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
    videoTitleText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        marginTop: 2,
    },
    overallYoutubeRow: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'flex-start',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: spacing.xxxl,
        gap: spacing.sm,
    },
    emptyIconShell: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    emptyTitle: {
        fontSize: typography.fontSizeMd + 1,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        marginTop: spacing.sm,
    },
    emptySubtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        textAlign: 'center',
        lineHeight: 21,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginBottom: spacing.xl,
    },

    // timeline track
    pipelineTimeline: {
        position: 'relative',
    },
    pipelineLine: {
        position: 'absolute',
        top: 20,
        bottom: 20,
        left: 12,
        width: 2,
        backgroundColor: colors.border,
    },
    timelineNodeContainer: {
        position: 'absolute',
        left: 0,
        top: 10,
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    timelineDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.secondary,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dotSuccess: {
        backgroundColor: colors.success,
        borderColor: colors.success,
    },
    dotFailure: {
        backgroundColor: colors.destructive,
        borderColor: colors.destructive,
    },
    dotPending: {
        backgroundColor: colors.backgroundSecondary,
        borderColor: colors.border,
    },
    dotSkipped: {
        backgroundColor: '#1E293B',
        borderColor: colors.border,
    },

    // pulsing indicator
    pulseContainer: {
        width: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: 'rgba(139, 92, 246, 0.4)',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    pulseDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 5,
        elevation: 4,
    },

    // accordion layout
    jobSection: {
        position: 'relative',
        paddingLeft: 30,
        marginBottom: spacing.xs,
    },
    jobHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    jobHeaderExpanded: {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    jobHeaderRunning: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(139, 92, 246, 0.04)',
    },
    jobHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
    },
    jobTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        flex: 1,
        marginRight: spacing.md,
    },
    jobTitleRunning: {
        color: colors.foreground,
    },
    jobBody: {
        padding: spacing.md,
        backgroundColor: '#070C18',
        borderBottomLeftRadius: borderRadius.md,
        borderBottomRightRadius: borderRadius.md,
        borderWidth: 1,
        borderTopWidth: 0,
        borderColor: colors.border,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 999,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },

    // buttons
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionBtnCopied: {
        borderColor: 'rgba(16, 185, 129, 0.3)',
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    actionBtnText: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        fontWeight: typography.fontWeightSemibold,
    },
    mediaActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        flexWrap: 'wrap',
    },
    frameMediaActions: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        flexWrap: 'wrap',
    },
    youtubeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs + 2,
        backgroundColor: '#EF4444',
        borderRadius: borderRadius.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderWidth: 1,
        borderColor: '#DC2626',
    },
    youtubeBtnText: {
        color: colors.primaryForeground,
        fontWeight: typography.fontWeightBold,
        fontSize: typography.fontSizeXs,
    },

    // media players & structures
    carouselContainer: {
        marginTop: spacing.xs,
    },
    carouselHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    carouselCounter: {
        fontSize: 9,
        color: colors.foregroundMuted,
        fontWeight: typography.fontWeightBold,
        letterSpacing: 0.5,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: colors.border,
    },
    dotActive: {
        backgroundColor: colors.primary,
        width: 8,
    },
    carouselItem: {
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    videoPlayerFrame: {
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        backgroundColor: '#020306',
    },
    videoPlayer: {
        width: '100%',
        height: 190,
    },
    assembledVideo: {
        width: '100%',
        height: 200,
    },
    mediaContainer: {
        gap: spacing.sm,
    },
    imageBezel: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
    },
    thumbnailImage: {
        width: '100%',
        height: 180,
        backgroundColor: '#020306',
    },

    // custom audio deck
    audioPlayerDeck: {
        gap: spacing.md,
        backgroundColor: '#050914',
        padding: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.03)',
    },
    audioControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    playButtonGradient: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.sm,
    },
    audioTrackContainer: {
        flex: 1,
        gap: 6,
    },
    audioTrackHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    audioTrackTime: {
        fontSize: 10,
        color: colors.foregroundMuted,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    audioTrackLabel: {
        fontSize: 10,
        color: colors.foregroundMuted,
        fontWeight: typography.fontWeightSemibold,
        textTransform: 'uppercase',
    },
    audioTrackLine: {
        height: 4,
        backgroundColor: colors.border,
        borderRadius: 2,
        position: 'relative',
    },
    audioTrackFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '0%',
        backgroundColor: colors.gradientTo,
        borderRadius: 2,
    },
    audioTrackHandle: {
        position: 'absolute',
        left: '0%',
        top: -3,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.foreground,
        borderWidth: 2,
        borderColor: colors.gradientTo,
    },
    quoteBox: {
        position: 'relative',
        backgroundColor: 'rgba(255,255,255,0.02)',
        padding: spacing.md,
        paddingLeft: spacing.lg,
        borderRadius: borderRadius.sm,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
    },
    quoteSymbol: {
        position: 'absolute',
        left: 6,
        top: -4,
        fontSize: 28,
        fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
        color: 'rgba(139, 92, 246, 0.15)',
    },
    audioNarration: {
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 20,
        fontStyle: 'italic',
    },

    // ideas
    ideasOutputContainer: {
        gap: spacing.sm,
    },
    ideaRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    ideaBullet: {
        width: 5,
        height: 12,
        borderRadius: 3,
        marginTop: 5,
    },
    ideaText: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 21,
    },

    // script
    scriptOutputContainer: {
        gap: spacing.md,
    },
    scriptTitle: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    scriptDescription: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        lineHeight: 20,
    },
    sceneDropdownContainer: {
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
    },
    toggleLabel: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        fontWeight: typography.fontWeightSemibold,
    },
    scenesList: {
        padding: spacing.md,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.05)',
        backgroundColor: '#050914',
    },
    sceneRow: {
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.sm,
        padding: spacing.md,
        gap: spacing.xs,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sceneNum: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.gradientTo,
        letterSpacing: 0.5,
    },
    sceneText: {
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 18,
    },
    subSectionLabel: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    hooksContainer: {
        gap: spacing.sm,
    },
    hookRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        alignItems: 'flex-start',
    },
    hookNum: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightBold,
        color: colors.primary,
        width: 18,
        marginTop: 1,
    },
    hookText: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 18,
    },

    // JSON terminal
    jsonTerminalContainer: {
        backgroundColor: '#020306',
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    jsonTerminalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        backgroundColor: '#090F1C',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.03)',
    },
    terminalDotRow: {
        flexDirection: 'row',
        gap: 5,
        marginRight: spacing.md,
    },
    terminalDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    terminalTitle: {
        flex: 1,
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: colors.foregroundMuted,
    },
    terminalContent: {
        position: 'relative',
        padding: spacing.md,
    },
    copyJsonBtn: {
        position: 'absolute',
        right: spacing.md,
        top: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        zIndex: 10,
        backgroundColor: '#1E293B',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
    },
    copyJsonBtnText: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: '#FFFFFF',
    },
    terminalScroll: {
        maxHeight: 180,
    },
    terminalText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 11,
        color: '#34D399',
    },
    captionsContainer: {
        gap: spacing.sm,
        marginTop: spacing.lg,
    },
    captionsHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    instagramIcon: {
        width: 30,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: 'rgba(244, 114, 182, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(244, 114, 182, 0.22)',
    },
    captionsHeadingText: {
        gap: 2,
    },
    captionsHint: {
        fontSize: 10,
        color: colors.foregroundMuted,
    },
    captionCard: {
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.sm,
        backgroundColor: 'rgba(139, 92, 246, 0.07)',
        borderWidth: 1,
        borderColor: 'rgba(167, 139, 250, 0.16)',
    },
    captionCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    captionNumber: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        letterSpacing: 1.1,
        color: '#C4B5FD',
    },
    captionText: {
        fontSize: typography.fontSizeSm,
        lineHeight: 21,
        color: colors.secondaryForeground,
    },

    // shorts
    shortsList: {
        gap: spacing.xs,
    },
    shortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.03)',
        gap: spacing.md,
    },
    shortInfo: {
        flex: 1,
        gap: 3,
    },
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
    shortCaption: {
        gap: spacing.sm,
        marginTop: spacing.sm,
        padding: spacing.sm,
        borderRadius: 10,
        backgroundColor: 'rgba(244, 114, 182, 0.06)',
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(244, 114, 182, 0.55)',
        alignItems: 'flex-start',
    },
    shortCaptionText: {
        fontSize: typography.fontSizeXs,
        lineHeight: 17,
        color: colors.secondaryForeground,
    },
    shortActions: {
        gap: spacing.xs,
        alignItems: 'flex-end',
    },
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
        paddingVertical: spacing.sm,
        backgroundColor: colors.secondary,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    retryBtnText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
});
