import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Linking,
    Image,
    Dimensions,
    Animated,
    Modal,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { pipelineApi, scheduleTimesApi, PipelineStatus, JobResult, ShortResult } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import { colors, spacing, borderRadius, typography, shadows, gradients } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WAVEFORM_HEIGHTS = [8, 14, 20, 12, 24, 18, 10, 16, 22, 14, 20, 12, 18, 24, 16, 10, 14, 8];

const formatAudioTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatIST = (dateStr?: string | null): string => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', {
            timeZone: 'Asia/Kolkata',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }) + ' IST';
    } catch {
        return dateStr;
    }
};

const extractSeries = (title?: string): string => {
    if (!title) return 'Core Track';
    const match = title.match(/\((.*?)\)/);
    return match ? match[1] : 'Flagship Production';
};

const getStatusBorderColor = (jobState?: JobResult) => {
    if (jobState === 'success') return 'rgba(74, 222, 128, 0.4)';
    if (jobState === 'running') return 'rgba(251, 191, 36, 0.4)';
    if (jobState === 'failure') return 'rgba(248, 113, 113, 0.4)';
    return 'rgba(113, 113, 122, 0.3)';
};

const getStatusIcon = (jobState?: JobResult): keyof typeof Ionicons.glyphMap => {
    if (jobState === 'success') return 'checkmark';
    if (jobState === 'running') return 'sync';
    if (jobState === 'failure') return 'close';
    return 'ellipse-outline';
};

const getStatusIconColor = (jobState?: JobResult) => {
    if (jobState === 'success') return colors.success;
    if (jobState === 'running') return colors.running;
    if (jobState === 'failure') return colors.failed;
    return colors.linenMuted;
};

const renderJobBadge = (jobState?: JobResult) => {
    if (jobState === 'success') {
        return (
            <View style={styles.stepBadgeSuccess}>
                <Text style={styles.stepBadgeSuccessText}>Completed</Text>
            </View>
        );
    }
    if (jobState === 'running') {
        return (
            <View style={[styles.stepBadgeSuccess, { backgroundColor: 'rgba(251, 191, 36, 0.15)', borderColor: 'rgba(251, 191, 36, 0.3)' }]}>
                <Text style={[styles.stepBadgeSuccessText, { color: colors.running }]}>Running</Text>
            </View>
        );
    }
    if (jobState === 'failure') {
        return (
            <View style={[styles.stepBadgeSuccess, { backgroundColor: 'rgba(248, 113, 113, 0.15)', borderColor: 'rgba(248, 113, 113, 0.3)' }]}>
                <Text style={[styles.stepBadgeSuccessText, { color: colors.failed }]}>Failed</Text>
            </View>
        );
    }
    return (
        <View style={[styles.stepBadgeSuccess, { backgroundColor: colors.cardElevated, borderColor: colors.borderLight }]}>
            <Text style={[styles.stepBadgeSuccessText, { color: colors.linenMuted }]}>Pending</Text>
        </View>
    );
};

export default function PipelineStatusScreen() {
    const [status, setStatus] = useState<PipelineStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rerunning, setRerunning] = useState(false);

    // Interactive state: all blocks closed by default
    const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
    const [selectedScriptScene, setSelectedScriptScene] = useState(0);
    const [selectedRenderScene, setSelectedRenderScene] = useState(0);
    const [selectedVoScene, setSelectedVoScene] = useState(0);
    const [selectedShortIndex, setSelectedShortIndex] = useState(0);
    const [showMasterModal, setShowMasterModal] = useState(false);

    // Toast notification state
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

    const [longFormScheduleTime, setLongFormScheduleTime] = useState<string>('18:30');

    const fetchPipeline = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [res, schedRes] = await Promise.allSettled([
                pipelineApi.getPipelineStatus(),
                scheduleTimesApi.getScheduleTimes(),
            ]);

            if (res.status === 'fulfilled' && res.value.ok && res.value.status) {
                setStatus(res.value.status);
            } else if (res.status === 'fulfilled' && !res.value.status) {
                setStatus(null);
            }

            if (schedRes.status === 'fulfilled' && schedRes.value.ok && schedRes.value.longFormTime) {
                setLongFormScheduleTime(schedRes.value.longFormTime);
            }
        } catch (err: any) {
            console.error('[Pipeline] Error fetching status:', err);
            setStatus(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchPipeline();
    }, [fetchPipeline]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchPipeline(true);
    }, [fetchPipeline]);

    const handleRerun = async () => {
        setRerunning(true);
        showToast('Re-running failed pipeline jobs...');
        try {
            const res = await pipelineApi.rerunFailedJobs(status?.runId);
            if (res.ok) {
                showToast('Failed jobs re-queued successfully!');
                setTimeout(() => fetchPipeline(true), 2500);
            } else {
                showToast(res.error || 'Failed to trigger rerun');
            }
        } catch (err: any) {
            showToast('Failed to trigger rerun');
        } finally {
            setRerunning(false);
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        await Clipboard.setStringAsync(text);
        showToast(`Copied ${label} to clipboard!`);
    };

    const handleDownload = async (url: string, label: string) => {
        try {
            let downloadUrl = url;
            if (url.includes('cloudinary.com') && url.includes('/upload/')) {
                if (!downloadUrl.includes('fl_attachment')) {
                    downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
                }
            }
            await Linking.openURL(downloadUrl);
            showToast(`Opening ${label} download...`);
        } catch {
            try {
                await Linking.openURL(url);
                showToast(`Opening ${label}...`);
            } catch {
                await Clipboard.setStringAsync(url);
                showToast(`Copied ${label} link to clipboard!`);
            }
        }
    };

    const assembledVideoPlayer = useVideoPlayer(status?.videoUrl || '', player => {
        player.loop = true;
    });

    const reviewModalVideoPlayer = useVideoPlayer(status?.videoUrl || '', player => {
        player.loop = true;
    });

    const activeSceneUrl = (status?.sceneUrls && status.sceneUrls[selectedRenderScene]) || '';
    const sceneVideoPlayer = useVideoPlayer(activeSceneUrl, player => {
        player.loop = true;
    });

    const activeVoAudioUrl = (status?.voiceoverUrls && status.voiceoverUrls[selectedVoScene]) || '';
    const voAudioPlayer = useAudioPlayer(activeVoAudioUrl || null);
    const voAudioStatus = useAudioPlayerStatus(voAudioPlayer);

    const closeMasterModal = useCallback(() => {
        try {
            reviewModalVideoPlayer.pause();
        } catch {}
        setShowMasterModal(false);
    }, [reviewModalVideoPlayer]);

    const toggleStep = useCallback((stepNumber: number) => {
        setExpandedSteps(prev => {
            const nextVal = !prev[stepNumber];
            if (!nextVal) {
                if (stepNumber === 3) {
                    try { sceneVideoPlayer.pause(); } catch {}
                } else if (stepNumber === 4) {
                    try { voAudioPlayer.pause(); } catch {}
                } else if (stepNumber === 5) {
                    try { assembledVideoPlayer.pause(); } catch {}
                }
            }
            return {
                ...prev,
                [stepNumber]: nextVal,
            };
        });
    }, [sceneVideoPlayer, voAudioPlayer, assembledVideoPlayer]);

    useEffect(() => {
        if (!showMasterModal) {
            try {
                reviewModalVideoPlayer.pause();
            } catch {}
        }
    }, [showMasterModal, reviewModalVideoPlayer]);

    useEffect(() => {
        return () => {
            try { assembledVideoPlayer.pause(); } catch {}
            try { reviewModalVideoPlayer.pause(); } catch {}
            try { sceneVideoPlayer.pause(); } catch {}
            try { voAudioPlayer.pause(); } catch {}
        };
    }, [assembledVideoPlayer, reviewModalVideoPlayer, sceneVideoPlayer, voAudioPlayer]);

    if (loading && !status) {
        return (
            <View style={styles.loadingContainer}>
                <SkeletonLoader variant="pipeline" />
            </View>
        );
    }

    if (!status) {
        return (
            <View style={styles.emptyContainer}>
                <Ionicons name="git-network-outline" size={48} color={colors.sandstone} />
                <Text style={styles.emptyTitle}>No Pipeline Status Available</Text>
                <Text style={styles.emptySubtitle}>
                    No active or recent pipeline execution recorded in the system.
                </Text>
                <TouchableOpacity style={styles.emptyRefreshBtn} onPress={() => fetchPipeline(false)}>
                    <Ionicons name="refresh" size={14} color={colors.primaryForeground} />
                    <Text style={styles.emptyRefreshBtnText}>Refresh</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const activeData = status;
    const narrations = activeData.sceneNarrations || [];
    const voUrls = activeData.voiceoverUrls || [];
    const voScenesCount = Math.max(narrations.length, voUrls.length);
    const currentNarration = narrations[selectedScriptScene] ?? narrations[0] ?? '';
    const currentVoNarration = narrations[selectedVoScene] ?? narrations[0] ?? '';
    const currentVoAudioUrl = voUrls[selectedVoScene];

    const shortsList = [...(activeData.shorts || [])].sort((a, b) => (a.shortIndex ?? 0) - (b.shortIndex ?? 0));
    const shortHooks = activeData.shortHooks || [];
    const activeShort = shortsList[selectedShortIndex] || shortsList[0];
    const actualShortIndex = activeShort?.shortIndex ?? selectedShortIndex;
    const activeHook = (shortHooks && shortHooks[actualShortIndex]) || (activeShort ? `Short #${actualShortIndex + 1}` : '');

    const currentVoAudioDuration = voAudioStatus.duration && voAudioStatus.duration > 0 ? voAudioStatus.duration : 0;
    const currentVoAudioTime = voAudioStatus.currentTime ?? 0;
    const isVoAudioPlaying = voAudioStatus.playing;

    const toggleVoAudio = () => {
        if (!activeVoAudioUrl) {
            showToast('No audio file found for this scene');
            return;
        }
        if (isVoAudioPlaying) {
            voAudioPlayer.pause();
        } else {
            voAudioPlayer.play();
        }
    };

    const handleAudioSeek = (progressRatio: number) => {
        if (currentVoAudioDuration > 0 && voAudioPlayer) {
            voAudioPlayer.seekTo(progressRatio * currentVoAudioDuration);
        }
    };

    const jobsRecord = activeData.jobs || ({} as Record<string, JobResult>);
    const completedJobsCount = Object.values(jobsRecord).filter(v => v === 'success').length;
    const runningJobsCount = Object.values(jobsRecord).filter(v => v === 'running').length;
    const failedJobsCount = Object.values(jobsRecord).filter(v => v === 'failure').length;
    const skippedJobsCount = Object.values(jobsRecord).filter(v => v === 'skipped' || v === 'cancelled').length;

    // Re-run is only available when the pipeline has failed and is not fully completed
    const isPipelineFailed = (activeData.overallStatus === 'failure' || failedJobsCount > 0) && completedJobsCount < 8;

    const isLongFormPublished = (): boolean => {
        if (!activeData.youtubeId) return false;
        const now = Date.now();
        if (activeData.scheduledPublishTime) {
            const pubTime = new Date(activeData.scheduledPublishTime).getTime();
            if (!isNaN(pubTime)) return now >= pubTime;
        }
        if (activeData.ranAt) {
            try {
                const runDate = new Date(activeData.ranAt);
                const istOffsetMs = 5.5 * 60 * 60 * 1000;
                const istRun = new Date(runDate.getTime() + istOffsetMs);
                const [hStr, mStr] = (longFormScheduleTime || '18:30').split(':');
                const targetHours = parseInt(hStr, 10) || 18;
                const targetMins = parseInt(mStr, 10) || 30;

                const istScheduled = new Date(istRun);
                istScheduled.setUTCHours(targetHours, targetMins, 0, 0);
                const utcScheduledTimeMs = istScheduled.getTime() - istOffsetMs;
                return now >= utcScheduledTimeMs;
            } catch {}
        }
        return false;
    };
    const isYtPublished = isLongFormPublished();

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.sandstone} />}
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Hero Episode Header ─── */}
                <LinearGradient
                    colors={gradients.hero}
                    style={styles.heroCard}
                >
                    <View style={styles.heroHeaderRow}>
                        <Text style={styles.heroSeriesTag} numberOfLines={1}>
                            {extractSeries(activeData.videoTitle)}
                        </Text>
                        {activeData.ranAt ? (
                            <View style={styles.heroRuntimeBadge}>
                                <Text style={styles.heroRuntimeText}>{formatIST(activeData.ranAt)}</Text>
                            </View>
                        ) : null}
                    </View>

                    <Text style={styles.heroTitle}>
                        {activeData.videoTitle}
                    </Text>

                    <View style={styles.heroStatusRow}>
                        <View style={styles.statusPill}>
                            <View style={styles.statusPillDot} />
                            <Text style={styles.statusPillText}>
                                {activeData.overallStatus === 'success' ? 'Pipeline Succeeded' : activeData.overallStatus === 'running' ? 'Pipeline In Progress' : 'Pipeline Failed'}
                            </Text>
                        </View>
                        <Text style={styles.heroStagesComplete}>
                            {completedJobsCount} of 8 Stages Complete
                        </Text>
                    </View>

                    {(isPipelineFailed || activeData.videoUrl) ? (
                        <View style={styles.heroActionsRow}>
                            {isPipelineFailed ? (
                                <TouchableOpacity
                                    style={styles.heroSecondaryBtn}
                                    onPress={handleRerun}
                                    activeOpacity={0.8}
                                    disabled={rerunning}
                                >
                                    <Ionicons name="refresh" size={15} color={colors.sandstone} />
                                    <Text style={styles.heroSecondaryBtnText}>
                                        {rerunning ? 'Re-running...' : 'Re-run Failed Jobs'}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}

                            {activeData.videoUrl ? (
                                <TouchableOpacity
                                    style={styles.heroPrimaryBtn}
                                    onPress={() => {
                                        setShowMasterModal(true);
                                        try {
                                            reviewModalVideoPlayer.play();
                                        } catch {}
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="play-circle" size={17} color={colors.primaryForeground} />
                                    <Text style={styles.heroPrimaryBtnText}>Review Master</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    ) : null}
                </LinearGradient>

                {/* ─── Pipeline Legend Bar ─── */}
                <View style={styles.legendSection}>
                    <View style={styles.legendHeaderRow}>
                        <Text style={styles.legendTitle}>CONNECTED EXECUTION PIPELINE</Text>
                        <Text style={styles.legendCount}>8 Steps Active</Text>
                    </View>

                    <View style={styles.legendChipsRow}>
                        <View style={[styles.legendChip, { borderColor: 'rgba(74, 222, 128, 0.25)', backgroundColor: 'rgba(74, 222, 128, 0.1)' }]}>
                            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                            <Text
                                style={[styles.legendChipText, { color: colors.success }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                Completed ({completedJobsCount})
                            </Text>
                        </View>
                        <View style={[styles.legendChip, { borderColor: 'rgba(251, 191, 36, 0.25)', backgroundColor: 'rgba(251, 191, 36, 0.1)' }]}>
                            <View style={[styles.legendDot, { backgroundColor: colors.running }]} />
                            <Text
                                style={[styles.legendChipText, { color: colors.running }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                Running ({runningJobsCount})
                            </Text>
                        </View>
                        <View style={[styles.legendChip, { borderColor: 'rgba(248, 113, 113, 0.25)', backgroundColor: 'rgba(248, 113, 113, 0.1)' }]}>
                            <View style={[styles.legendDot, { backgroundColor: colors.failed }]} />
                            <Text
                                style={[styles.legendChipText, { color: colors.failed }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                Failed ({failedJobsCount})
                            </Text>
                        </View>
                        <View style={[styles.legendChip, { borderColor: 'rgba(113, 113, 122, 0.25)', backgroundColor: 'rgba(113, 113, 122, 0.1)' }]}>
                            <View style={[styles.legendDot, { backgroundColor: colors.skipped }]} />
                            <Text
                                style={[styles.legendChipText, { color: colors.skipped }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                Skipped ({skippedJobsCount})
                            </Text>
                        </View>
                    </View>
                </View>

                {/* ─── Connected 8-Step Pipeline Rail Graph ─── */}
                <View style={styles.railGraphContainer}>
                    {/* Continuous Spine Line */}
                    <View style={styles.spineLine} />

                    <View style={styles.stepsList}>
                        {/* ─── STEP 1: Populate Ideas ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.populateIdeas) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.populateIdeas)} size={16} color={getStatusIconColor(activeData.jobs?.populateIdeas)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(1)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>01. Populate Ideas</Text>
                                        <Text style={styles.stepSubtitle}>Topic Ingestion & Queue Dispatch</Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.populateIdeas)}
                                        <Ionicons
                                            name={expandedSteps[1] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[1] ? (
                                    <View style={styles.stepInnerBox}>
                                        <View style={styles.innerBoxMetaRow}>
                                            <Text style={styles.innerBoxMetaMono}>Target Queue: video:ideas</Text>
                                            {activeData.ranAt ? (
                                                <Text style={styles.innerBoxMetaSync}>{formatIST(activeData.ranAt)}</Text>
                                            ) : null}
                                        </View>
                                        {activeData.ideasAdded && activeData.ideasAdded.length > 0 ? (
                                            <View style={{ marginTop: 4 }}>
                                                <Text style={styles.innerBoxParagraph}>
                                                    <Text style={styles.innerBoxHighlight}>Ideas Added to Queue Today ({activeData.ideasAdded.length}):</Text>
                                                </Text>
                                                <View style={{ gap: 6, marginTop: 6 }}>
                                                    {activeData.ideasAdded.map((idea, idx) => (
                                                        <View
                                                            key={idx}
                                                            style={{
                                                                flexDirection: 'row',
                                                                alignItems: 'flex-start',
                                                                backgroundColor: colors.surfaceRecessed,
                                                                borderRadius: 6,
                                                                paddingHorizontal: 8,
                                                                paddingVertical: 6,
                                                                gap: 8,
                                                                borderWidth: 1,
                                                                borderColor: colors.borderHairline,
                                                            }}
                                                        >
                                                            <Text style={[styles.innerBoxMetaMono, { color: colors.sandstone, marginTop: 1 }]}>
                                                                {String(idx + 1).padStart(2, '0')}
                                                            </Text>
                                                            <Text style={{ flex: 1, fontSize: 12, fontWeight: typography.fontWeightMedium, color: colors.linen, lineHeight: 16 }}>
                                                                {idea}
                                                            </Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        ) : (
                                            <Text style={[styles.innerBoxParagraph, { marginTop: 4, color: colors.linenMuted }]}>
                                                <Text style={styles.innerBoxHighlight}>Ideas Added Today: </Text>
                                                None (Queue was already healthy; no new ideas needed to be added today)
                                            </Text>
                                        )}
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 2: Generate Script ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.generateScript) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.generateScript)} size={16} color={getStatusIconColor(activeData.jobs?.generateScript)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(2)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>02. Generate Script</Text>
                                        <Text style={styles.stepSubtitle}>
                                            {narrations.length > 0 ? `${narrations.length} scenes structured` : 'Script generated'}
                                        </Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.generateScript)}
                                        <Ionicons
                                            name={expandedSteps[2] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[2] ? (
                                    <>
                                        {activeData.videoTitle ? (
                                            <View style={[styles.stepInnerBox, { marginTop: 4 }]}>
                                                <Text style={styles.innerBoxParagraph}>
                                                    <Text style={styles.innerBoxHighlight}>Episode Title: </Text>
                                                    {activeData.videoTitle}
                                                </Text>
                                                {activeData.description ? (
                                                    <Text style={[styles.innerBoxParagraph, { marginTop: 4 }]}>
                                                        <Text style={styles.innerBoxHighlight}>Premise: </Text>
                                                        {activeData.description}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ) : null}

                                        {narrations.length > 0 && (
                                            <View style={styles.accordionBody}>
                                                {/* Scene Tabs */}
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
                                                    {narrations.map((_, idx) => (
                                                        <TouchableOpacity
                                                            key={idx}
                                                            style={[styles.sceneTab, selectedScriptScene === idx && styles.sceneTabActive]}
                                                            onPress={() => setSelectedScriptScene(idx)}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Text style={[styles.sceneTabText, selectedScriptScene === idx && styles.sceneTabTextActive]}>
                                                                Scene {idx + 1}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>

                                                {/* Narration Box */}
                                                <View style={styles.stepInnerBox}>
                                                    <View style={styles.innerBoxMetaRow}>
                                                        <Text style={styles.sceneTitleHighlight}>Scene 0{selectedScriptScene + 1}</Text>
                                                        <Text style={styles.innerBoxMetaMono}>
                                                            {currentNarration.split(' ').filter(Boolean).length} words
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.innerBoxParagraph}>{currentNarration}</Text>
                                                </View>
                                            </View>
                                        )}
                                    </>
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 3: Render Scenes ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.renderScenes) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.renderScenes)} size={16} color={getStatusIconColor(activeData.jobs?.renderScenes)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(3)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>03. Render Scenes</Text>
                                        <Text style={styles.stepSubtitle}>
                                            {activeData.sceneUrls && activeData.sceneUrls.length > 0
                                                ? `${activeData.sceneUrls.length} scenes rendered`
                                                : 'Deterministic Code & AI Scene Engine'}
                                        </Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.renderScenes)}
                                        <Ionicons
                                            name={expandedSteps[3] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[3] ? (
                                    activeData.sceneUrls && activeData.sceneUrls.length > 0 ? (
                                        <>
                                            {/* Scene Selector Strip */}
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
                                                {activeData.sceneUrls.map((_, idx) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={[styles.sceneTab, selectedRenderScene === idx && styles.sceneTabActive]}
                                                        onPress={() => setSelectedRenderScene(idx)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.sceneTabText, selectedRenderScene === idx && styles.sceneTabTextActive]}>
                                                            Scene {idx + 1}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>

                                            {/* Video Preview Frame */}
                                            <View style={styles.videoPreviewFrame}>
                                                <VideoView
                                                    player={sceneVideoPlayer}
                                                    style={styles.videoPlayerElement}
                                                    contentFit="contain"
                                                    nativeControls={true}
                                                    allowsFullscreen={true}
                                                />
                                                <View style={styles.videoTopBadge} pointerEvents="none">
                                                    <Ionicons name="film-outline" size={11} color={colors.sandstone} />
                                                    <Text style={styles.videoTopBadgeText}>Scene 0{selectedRenderScene + 1} Preview</Text>
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <View style={styles.stepInnerBox}>
                                            <Text style={styles.innerBoxParagraph}>Scenes assembled into long-form master video.</Text>
                                        </View>
                                    )
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 4: Voiceover Synthesis ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.generateVoiceover) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.generateVoiceover)} size={16} color={getStatusIconColor(activeData.jobs?.generateVoiceover)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(4)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>04. Voiceover Synthesis</Text>
                                        <Text style={styles.stepSubtitle}>
                                            {voScenesCount > 0
                                                ? `${voScenesCount} scene audio tracks synthesized`
                                                : 'Neural Speech Audio Synthesis'}
                                        </Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.generateVoiceover)}
                                        <Ionicons
                                            name={expandedSteps[4] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[4] ? (
                                    voScenesCount > 0 ? (
                                        <>
                                            {/* Scene Selector Strip */}
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
                                                {Array.from({ length: voScenesCount }).map((_, idx) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={[styles.sceneTab, selectedVoScene === idx && styles.sceneTabActive]}
                                                        onPress={() => setSelectedVoScene(idx)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.sceneTabText, selectedVoScene === idx && styles.sceneTabTextActive]}>
                                                            Scene {idx + 1}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>

                                            {/* Selected Scene Voiceover Details */}
                                            <View style={styles.stepInnerBox}>
                                                <View style={styles.innerBoxMetaRow}>
                                                    <Text style={styles.sceneTitleHighlight}>Scene 0{selectedVoScene + 1} • Voiceover Audio</Text>
                                                    <View style={styles.engineBadge}>
                                                        <Text style={styles.engineBadgeText}>
                                                            {currentVoAudioDuration > 0 ? `${Math.round(currentVoAudioDuration)}s • ` : ''}F5 Neural
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* Audio Controls & Interactive Waveform */}
                                                <View style={styles.audioControlsRow}>
                                                    <TouchableOpacity
                                                        style={styles.audioPlayBtn}
                                                        onPress={toggleVoAudio}
                                                        activeOpacity={0.8}
                                                    >
                                                        <Ionicons
                                                            name={isVoAudioPlaying ? 'pause' : 'play'}
                                                            size={14}
                                                            color={colors.primaryForeground}
                                                            style={isVoAudioPlaying ? undefined : { marginLeft: 2 }}
                                                        />
                                                    </TouchableOpacity>

                                                    <View style={styles.waveformBarsContainer}>
                                                        {WAVEFORM_HEIGHTS.map((barHeight, bIdx) => {
                                                            const progress = currentVoAudioDuration > 0 ? currentVoAudioTime / currentVoAudioDuration : 0;
                                                            const activeCount = Math.floor(progress * WAVEFORM_HEIGHTS.length);
                                                            const isActive = bIdx <= activeCount && progress > 0;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={bIdx}
                                                                    activeOpacity={0.7}
                                                                    onPress={() => handleAudioSeek((bIdx + 1) / WAVEFORM_HEIGHTS.length)}
                                                                    style={{ paddingVertical: 4, justifyContent: 'center' }}
                                                                >
                                                                    <View
                                                                        style={[
                                                                            styles.waveformBar,
                                                                            { height: barHeight },
                                                                            isActive ? styles.waveformBarActive : styles.waveformBarInactive,
                                                                        ]}
                                                                    />
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>

                                                    <Text style={styles.audioTimeIndicator}>
                                                        {formatAudioTime(currentVoAudioTime)} / {formatAudioTime(currentVoAudioDuration || (currentVoNarration ? Math.ceil(currentVoNarration.split(' ').filter(Boolean).length / 2.5) : 0))}
                                                    </Text>
                                                </View>

                                                {/* Scene Narration Transcript Box */}
                                                <View style={styles.transcriptBox}>
                                                    <View style={styles.innerBoxMetaRow}>
                                                        <Text style={styles.transcriptLabel}>SCENE NARRATION TRANSCRIPT</Text>
                                                        {currentVoNarration ? (
                                                            <Text style={styles.innerBoxMetaMono}>{currentVoNarration.split(' ').filter(Boolean).length} words</Text>
                                                        ) : null}
                                                    </View>
                                                    {currentVoNarration ? (
                                                        <Text style={styles.transcriptText}>"{currentVoNarration}"</Text>
                                                    ) : (
                                                        <Text style={styles.innerBoxParagraph}>Narration synthesized for this scene.</Text>
                                                    )}
                                                </View>

                                                <View style={styles.cardActionsRow}>
                                                    {currentVoNarration ? (
                                                        <TouchableOpacity
                                                            style={styles.cardActionBtnPrimary}
                                                            onPress={() => copyToClipboard(currentVoNarration, `Scene 0${selectedVoScene + 1} Transcript`)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Ionicons name="copy-outline" size={13} color={colors.sandstone} />
                                                            <Text style={styles.cardActionBtnPrimaryText}>Copy Transcript</Text>
                                                        </TouchableOpacity>
                                                    ) : null}

                                                    {currentVoAudioUrl ? (
                                                        <TouchableOpacity
                                                            style={styles.cardActionBtnSecondary}
                                                            onPress={() => copyToClipboard(currentVoAudioUrl, `Scene 0${selectedVoScene + 1} Audio Link`)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Ionicons name="link-outline" size={13} color={colors.sandstone} />
                                                            <Text style={styles.cardActionBtnSecondaryText}>Copy Audio Link</Text>
                                                        </TouchableOpacity>
                                                    ) : null}
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <View style={styles.stepInnerBox}>
                                            <Text style={styles.innerBoxParagraph}>Audio synthesis complete for episode.</Text>
                                        </View>
                                    )
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 5: Assembled Video ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.assembleLongForm) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.assembleLongForm)} size={16} color={getStatusIconColor(activeData.jobs?.assembleLongForm)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(5)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>05. Assembled Video</Text>
                                        <Text style={styles.stepSubtitle}>Master Long-Form Episode</Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.assembleLongForm)}
                                        <Ionicons
                                            name={expandedSteps[5] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[5] ? (
                                    activeData.videoUrl ? (
                                        <View style={styles.videoPlayerFrame}>
                                            <VideoView
                                                player={assembledVideoPlayer}
                                                style={styles.videoPlayerElement}
                                                contentFit="contain"
                                                nativeControls={true}
                                                allowsFullscreen={true}
                                            />
                                            <View style={styles.videoTopBadge} pointerEvents="none">
                                                <Ionicons name="videocam-outline" size={11} color={colors.sandstone} />
                                                <Text style={styles.videoTopBadgeText} numberOfLines={1}>
                                                    {activeData.videoId}.mp4
                                                </Text>
                                            </View>
                                            <View style={styles.blockTopRightRow}>
                                                <TouchableOpacity
                                                    style={styles.blockTopRightBtn}
                                                    onPress={() => copyToClipboard(activeData.videoUrl!, 'Master Video Link')}
                                                    activeOpacity={0.8}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <Ionicons name="link-outline" size={13} color={colors.sandstone} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.blockTopRightBtn}
                                                    onPress={() => handleDownload(activeData.videoUrl!, 'Master Video')}
                                                    activeOpacity={0.8}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <Ionicons name="download-outline" size={13} color={colors.sandstone} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.stepInnerBox}>
                                            <Text style={styles.innerBoxParagraph}>Master video assembly in progress or not uploaded.</Text>
                                        </View>
                                    )
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 6: Thumbnail ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.generateThumbnail) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.generateThumbnail)} size={16} color={getStatusIconColor(activeData.jobs?.generateThumbnail)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(6)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>06. Generated Thumbnail</Text>
                                        <Text style={styles.stepSubtitle}>Episode Cover Artwork</Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.generateThumbnail)}
                                        <Ionicons
                                            name={expandedSteps[6] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[6] ? (
                                    activeData.thumbnailUrl ? (
                                        <View style={styles.thumbnailContainer}>
                                            <Image source={{ uri: activeData.thumbnailUrl }} style={styles.thumbnailImg} resizeMode="cover" />
                                            <View style={styles.blockTopRightRow}>
                                                <TouchableOpacity
                                                    style={styles.blockTopRightBtn}
                                                    onPress={() => copyToClipboard(activeData.thumbnailUrl!, 'Thumbnail Link')}
                                                    activeOpacity={0.8}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <Ionicons name="link-outline" size={13} color={colors.sandstone} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.blockTopRightBtn}
                                                    onPress={() => handleDownload(activeData.thumbnailUrl!, 'Thumbnail')}
                                                    activeOpacity={0.8}
                                                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                                >
                                                    <Ionicons name="download-outline" size={13} color={colors.sandstone} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.stepInnerBox}>
                                            <Text style={styles.innerBoxParagraph}>Thumbnail generation pending or not available.</Text>
                                        </View>
                                    )
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 7: Upload to YouTube ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.uploadYoutube) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.uploadYoutube)} size={16} color={getStatusIconColor(activeData.jobs?.uploadYoutube)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(7)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>07. Upload to YouTube</Text>
                                        <Text style={styles.stepSubtitle}>YouTube API Publication</Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.uploadYoutube)}
                                        <Ionicons
                                            name={expandedSteps[7] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[7] ? (
                                    activeData.youtubeId ? (
                                        <View style={styles.stepInnerBox}>
                                            <View style={styles.innerBoxMetaRow}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <View style={styles.ytTag}>
                                                        <Text style={styles.ytTagText}>YT</Text>
                                                    </View>
                                                    <Text style={styles.ytLinkText}>
                                                        youtu.be/{activeData.youtubeId}
                                                    </Text>
                                                </View>
                                                <Text style={{ color: isYtPublished ? colors.success : colors.sandstone, fontSize: 10, fontWeight: '600' }}>
                                                    {isYtPublished ? 'Published' : 'Scheduled'}
                                                </Text>
                                            </View>

                                            <View style={styles.cardActionsRow}>
                                                <TouchableOpacity
                                                    style={styles.cardActionBtnPrimary}
                                                    onPress={() => copyToClipboard(`https://youtu.be/${activeData.youtubeId}`, 'YouTube Link')}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="copy-outline" size={13} color={colors.sandstone} />
                                                    <Text style={styles.cardActionBtnPrimaryText}>Copy Video Link</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={styles.cardActionBtnSecondary}
                                                    onPress={() => Linking.openURL(`https://youtu.be/${activeData.youtubeId}`)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="open-outline" size={13} color={colors.linenDim} />
                                                    <Text style={styles.cardActionBtnSecondaryText}>Open on YouTube</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={styles.stepInnerBox}>
                                            <View style={styles.innerBoxMetaRow}>
                                                <Text style={styles.innerBoxMetaMono}>Target Channel: YouTube</Text>
                                                <Text style={{ color: colors.running, fontSize: 10, fontWeight: '600' }}>
                                                    Scheduled
                                                </Text>
                                            </View>
                                            <Text style={[styles.innerBoxParagraph, { marginTop: 4 }]}>
                                                Scheduled for premiere at {longFormScheduleTime || '18:30'} IST once video assembly completes.
                                            </Text>
                                        </View>
                                    )
                                ) : null}
                            </View>
                        </View>

                        {/* ─── STEP 8: Shorts Packaging ─── */}
                        <View style={styles.stepItem}>
                            <View style={[styles.nodePin, { borderColor: getStatusBorderColor(activeData.jobs?.shortsProcessing) }]}>
                                <Ionicons name={getStatusIcon(activeData.jobs?.shortsProcessing)} size={16} color={getStatusIconColor(activeData.jobs?.shortsProcessing)} />
                            </View>
                            <View style={styles.stepCard}>
                                <TouchableOpacity
                                    style={styles.stepHeaderRow}
                                    onPress={() => toggleStep(8)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.stepHeaderLeft}>
                                        <Text style={styles.stepTitleText}>08. Shorts Packaging</Text>
                                        <Text style={styles.stepSubtitle}>
                                            {shortsList.length > 0 ? `${shortsList.length} Shorts Scheduled` : 'Shorts processing'}
                                        </Text>
                                    </View>
                                    <View style={styles.stepHeaderRight}>
                                        {renderJobBadge(activeData.jobs?.shortsProcessing)}
                                        <Ionicons
                                            name={expandedSteps[8] ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={colors.linenMuted}
                                        />
                                    </View>
                                </TouchableOpacity>

                                {expandedSteps[8] ? (
                                    shortsList.length > 0 ? (
                                        <>
                                            {/* Derivative Reel Carousel Tabs */}
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
                                                {shortsList.map((s, idx) => (
                                                    <TouchableOpacity
                                                        key={idx}
                                                        style={[styles.sceneTab, selectedShortIndex === idx && styles.sceneTabActive]}
                                                        onPress={() => setSelectedShortIndex(idx)}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text style={[styles.sceneTabText, selectedShortIndex === idx && styles.sceneTabTextActive]}>
                                                            Short {s.shortIndex !== undefined ? s.shortIndex + 1 : idx + 1}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>

                                            {/* Active Short Detail Card */}
                                            <View style={styles.stepInnerBox}>
                                                <View style={styles.innerBoxMetaRow}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                                        <View style={styles.shortNumBadge}>
                                                            <Text style={styles.shortNumBadgeText}>
                                                                {activeShort?.shortIndex !== undefined ? activeShort.shortIndex + 1 : selectedShortIndex + 1}
                                                            </Text>
                                                        </View>
                                                        <Text style={styles.shortTitleText} numberOfLines={1}>
                                                            {activeHook || `Short #${(activeShort?.shortIndex ?? selectedShortIndex) + 1}`}
                                                        </Text>
                                                    </View>
                                                    {activeShort?.rank ? (
                                                        <Text style={styles.retentionBadgeText}>Rank #{activeShort.rank}</Text>
                                                    ) : null}
                                                </View>

                                                {activeShort?.scheduledPublishTime ? (
                                                    <View style={styles.innerBoxMetaRow}>
                                                        <Text style={styles.innerBoxMetaMono}>
                                                            {new Date(activeShort.scheduledPublishTime).getTime() <= Date.now() ? 'Published' : 'Scheduled'}: {formatIST(activeShort.scheduledPublishTime)}
                                                        </Text>
                                                    </View>
                                                ) : null}

                                                {activeShort?.youtubeId ? (
                                                    <View style={styles.innerBoxMetaRow}>
                                                        <Text style={styles.shortUrlText}>youtu.be/{activeShort.youtubeId}</Text>
                                                    </View>
                                                ) : null}

                                                <View style={styles.cardActionsRow}>
                                                    {activeShort?.youtubeId ? (
                                                        <>
                                                            <TouchableOpacity
                                                                style={styles.cardActionBtnPrimary}
                                                                onPress={() => copyToClipboard(`https://youtu.be/${activeShort.youtubeId}`, 'Short Link')}
                                                                activeOpacity={0.8}
                                                            >
                                                                <Ionicons name="link-outline" size={13} color={colors.sandstone} />
                                                                <Text style={styles.cardActionBtnPrimaryText}>Copy Link</Text>
                                                            </TouchableOpacity>

                                                            <TouchableOpacity
                                                                style={styles.cardActionBtnSecondary}
                                                                onPress={() => Linking.openURL(`https://youtu.be/${activeShort.youtubeId}`)}
                                                                activeOpacity={0.8}
                                                            >
                                                                <Ionicons name="open-outline" size={13} color={colors.linenDim} />
                                                                <Text style={styles.cardActionBtnSecondaryText}>Open Short</Text>
                                                            </TouchableOpacity>
                                                        </>
                                                    ) : activeShort?.videoUrl ? (
                                                        <TouchableOpacity
                                                            style={styles.cardActionBtnPrimary}
                                                            onPress={() => copyToClipboard(activeShort.videoUrl!, 'Short Video Link')}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Ionicons name="link-outline" size={13} color={colors.sandstone} />
                                                            <Text style={styles.cardActionBtnPrimaryText}>Copy Video Link</Text>
                                                        </TouchableOpacity>
                                                    ) : null}
                                                </View>
                                            </View>
                                        </>
                                    ) : (
                                        <View style={styles.stepInnerBox}>
                                            <Text style={styles.innerBoxParagraph}>Shorts not yet processed for this run.</Text>
                                        </View>
                                    )
                                ) : null}
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* ─── Floating Toast Feedback ─── */}
            <Animated.View style={[styles.floatingToast, { opacity: toastOpacity }]} pointerEvents="none">
                <Ionicons name="checkmark-circle" size={16} color={colors.sandstone} />
                <Text style={styles.floatingToastText}>{toastMessage}</Text>
            </Animated.View>

            {/* ─── Master Review Modal ─── */}
            <Modal
                visible={showMasterModal}
                animationType="fade"
                transparent={true}
                onRequestClose={closeMasterModal}
            >
                <View style={styles.modalBackdrop}>
                    {/* Backdrop touchable to dismiss when clicking outside */}
                    <TouchableWithoutFeedback onPress={closeMasterModal}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>

                    <View style={styles.masterModalSheet}>
                        <View style={styles.logsDrawerHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="film-outline" size={16} color={colors.sandstone} />
                                <Text style={styles.logsDrawerTitle}>Master Video Player</Text>
                            </View>
                            <TouchableOpacity
                                onPress={closeMasterModal}
                                style={styles.logsCloseBtn}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <Ionicons name="close" size={18} color={colors.linenDim} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.fullVideoFrame}>
                            <VideoView
                                player={reviewModalVideoPlayer}
                                style={styles.videoPlayerElement}
                                contentFit="contain"
                                nativeControls={true}
                                allowsFullscreen={true}
                            />
                        </View>

                        <Text style={styles.masterModalCaption} numberOfLines={2}>
                            {activeData.videoTitle}
                        </Text>
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
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background,
        padding: spacing.lg,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xxxl * 2,
    },
    heroCard: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        ...shadows.glowSandstone,
    },
    heroHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginBottom: spacing.xs + 2,
    },
    heroSeriesTag: {
        fontSize: 11,
        fontWeight: typography.fontWeightSemibold,
        color: colors.sandstone,
        letterSpacing: 0.8,
        flex: 1,
    },
    heroRuntimeBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    heroRuntimeText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenMuted,
    },
    heroTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        lineHeight: 24,
        marginVertical: spacing.xs,
    },
    heroStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(74, 222, 128, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.3)',
    },
    statusPillDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.success,
    },
    statusPillText: {
        fontSize: 11,
        fontWeight: typography.fontWeightBold,
        color: colors.success,
    },
    heroStagesComplete: {
        fontSize: 11,
        color: colors.linenMuted,
    },
    heroActionsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        paddingTop: spacing.md,
        marginTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    heroSecondaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
    },
    heroSecondaryBtnText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.sandstone,
    },
    heroPrimaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.md,
        backgroundColor: colors.sandstone,
    },
    heroPrimaryBtnText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
    },
    legendSection: {
        marginBottom: spacing.lg,
    },
    legendHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs + 2,
    },
    legendTitle: {
        fontSize: 11,
        fontWeight: typography.fontWeightBold,
        color: colors.linenMuted,
        letterSpacing: 1,
    },
    legendCount: {
        fontSize: 11,
        fontWeight: typography.fontWeightSemibold,
        color: colors.sandstone,
    },
    legendChipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    legendChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    legendDot: {
        width: 4.5,
        height: 4.5,
        borderRadius: 2.25,
    },
    legendChipText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
    },
    railGraphContainer: {
        position: 'relative',
    },
    spineLine: {
        position: 'absolute',
        left: 19,
        top: 24,
        bottom: 24,
        width: 2,
        backgroundColor: 'rgba(74, 222, 128, 0.35)',
        zIndex: 0,
    },
    stepsList: {
        zIndex: 1,
        gap: spacing.md,
    },
    stepItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
    },
    nodePin: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        ...shadows.subtle,
    },
    stepCard: {
        flex: 1,
        borderRadius: borderRadius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    stepHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
    },
    stepHeaderLeft: {
        flex: 1,
        paddingRight: spacing.xs,
    },
    stepHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    stepTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flexWrap: 'wrap',
    },
    stepTitleText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
    },
    stepSubtitle: {
        fontSize: 11,
        color: colors.linenMuted,
        marginTop: 2,
    },
    stepBadgeSuccess: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        backgroundColor: 'rgba(74, 222, 128, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(74, 222, 128, 0.3)',
    },
    stepBadgeSuccessText: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.success,
    },
    stepMonoMeta: {
        fontSize: 10,
        color: colors.linenMuted,
    },
    stepInnerBox: {
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceRecessed,
        padding: spacing.sm + 2,
        gap: spacing.sm,
    },
    innerBoxMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.xs,
    },
    innerBoxMetaMono: {
        fontSize: 10,
        color: colors.linenMuted,
    },
    innerBoxMetaSync: {
        fontSize: 10,
        color: colors.sandstone,
    },
    innerBoxParagraph: {
        fontSize: 11,
        lineHeight: 18,
        color: colors.linenDim,
    },
    innerBoxHighlight: {
        color: colors.sandstoneLight,
        fontWeight: typography.fontWeightMedium,
    },
    tagsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        paddingTop: 2,
    },
    tagBadge: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tagBadgeText: {
        fontSize: 10,
        color: colors.sandstoneLight,
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    accordionBody: {
        gap: spacing.sm,
        paddingTop: spacing.xs,
    },
    tabStrip: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    sceneTab: {
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sceneTabActive: {
        backgroundColor: colors.sandstone,
        borderColor: colors.sandstone,
    },
    sceneTabText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenMuted,
    },
    sceneTabTextActive: {
        color: colors.primaryForeground,
        fontWeight: typography.fontWeightBold,
    },
    sceneTitleHighlight: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        textTransform: 'uppercase',
    },
    videoPreviewFrame: {
        height: 180,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        position: 'relative',
    },
    videoPlayerFrame: {
        height: 200,
        borderRadius: borderRadius.sm,
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        position: 'relative',
    },
    videoPlayerElement: {
        width: '100%',
        height: '100%',
    },
    videoTopBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(12, 10, 7, 0.85)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        zIndex: 10,
    },
    videoTopBadgeText: {
        fontSize: 10,
        color: colors.linenDim,
        fontWeight: typography.fontWeightMedium,
        letterSpacing: 0.3,
    },
    blockTopRightRow: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        zIndex: 10,
    },
    blockTopRightBtn: {
        width: 28,
        height: 28,
        borderRadius: 4,
        backgroundColor: 'rgba(12, 10, 7, 0.85)',
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        alignItems: 'center',
        justifyContent: 'center',
    },
    engineBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    engineBadgeText: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
    },
    audioControlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    audioPlayBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: colors.sandstone,
        alignItems: 'center',
        justifyContent: 'center',
    },
    waveformBarsContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 26,
    },
    waveformBar: {
        width: 3,
        borderRadius: 2,
    },
    waveformBarActive: {
        backgroundColor: colors.sandstone,
    },
    waveformBarInactive: {
        backgroundColor: 'rgba(200, 178, 155, 0.35)',
    },
    audioTimeIndicator: {
        fontSize: 10,
        color: colors.linenMuted,
    },
    transcriptBox: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.xs,
        padding: spacing.sm,
        gap: 4,
    },
    transcriptLabel: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 0.5,
    },
    transcriptText: {
        fontSize: 11,
        color: colors.linenDim,
        lineHeight: 17,
        fontStyle: 'italic',
    },
    cardActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        paddingTop: spacing.xs,
    },
    cardActionBtnSecondary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardActionBtnSecondaryText: {
        fontSize: 11,
        fontWeight: typography.fontWeightMedium,
        color: colors.sandstone,
    },
    cardActionBtnPrimary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        backgroundColor: 'rgba(200, 178, 155, 0.1)',
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
    },
    cardActionBtnPrimaryText: {
        fontSize: 11,
        fontWeight: typography.fontWeightSemibold,
        color: colors.sandstone,
    },
    cardActionBtnGold: {
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.sandstone,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    cardActionBtnGoldText: {
        fontSize: 11,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
    },
    thumbnailContainer: {
        height: 150,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        position: 'relative',
    },
    thumbnailImg: {
        width: '100%',
        height: '100%',
    },
    thumbnailPlaceholder: {
        flex: 1,
        padding: spacing.md,
        justifyContent: 'space-between',
    },
    thumbnailHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    variantBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(12, 10, 7, 0.85)',
        borderWidth: 1,
        borderColor: colors.border,
    },
    variantBadgeText: {
        fontSize: 8,
        color: colors.sandstone,
        fontWeight: typography.fontWeightBold,
    },
    topPerformerBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
    },
    topPerformerBadgeText: {
        fontSize: 8,
        color: colors.success,
        fontWeight: typography.fontWeightBold,
    },
    thumbnailCenterGraphic: {
        alignItems: 'center',
        gap: 4,
    },
    thumbnailTitleBox: {
        backgroundColor: 'rgba(17, 14, 8, 0.9)',
        paddingHorizontal: spacing.md,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
    },
    thumbnailTitleText: {
        fontSize: 14,
        fontWeight: typography.fontWeightBlack,
        color: colors.linen,
    },
    thumbnailSubtitleText: {
        fontSize: 9,
        color: colors.sandstoneLight,
        letterSpacing: 1.2,
    },
    thumbnailFooterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    smallToggleBtn: {
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    smallToggleBtnActive: {
        borderColor: colors.sandstone,
    },
    smallToggleBtnText: {
        fontSize: 10,
        color: colors.sandstone,
        fontWeight: typography.fontWeightMedium,
    },
    ytTag: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    ytTagText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: '#f87171',
    },
    ytLinkText: {
        fontSize: 11,
        color: colors.sandstoneLight,
        fontWeight: typography.fontWeightMedium,
    },
    shortNumBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    shortNumBadgeText: {
        fontSize: 9,
        color: colors.sandstone,
        fontWeight: typography.fontWeightBold,
    },
    shortTitleText: {
        fontSize: 12,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        flex: 1,
    },
    retentionBadgeText: {
        fontSize: 10,
        color: colors.success,
        fontWeight: typography.fontWeightBold,
    },
    captionBox: {
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.xs,
        padding: spacing.sm,
    },
    captionText: {
        fontSize: 11,
        color: colors.linenDim,
        lineHeight: 16,
        fontStyle: 'italic',
    },
    shortUrlText: {
        fontSize: 10,
        color: colors.sandstoneLight,
    },
    floatingToast: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.full,
        backgroundColor: 'rgba(22, 19, 13, 0.97)',
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        ...shadows.glowSandstone,
        zIndex: 99,
    },
    floatingToastText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenDim,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end',
    },
    logsDrawerSheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        maxHeight: '70%',
    },
    logsDrawerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    logsDrawerTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
    },
    logsCloseBtn: {
        padding: 4,
    },
    logsScroll: {
        marginTop: spacing.sm,
    },
    logsScrollContent: {
        gap: 6,
    },
    logLine: {
        fontSize: 11,
        color: colors.linenMuted,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    logLineGreen: {
        fontSize: 11,
        color: colors.success,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    masterModalSheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        maxHeight: '80%',
        gap: spacing.md,
    },
    fullVideoFrame: {
        height: 220,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceRecessed,
        overflow: 'hidden',
    },
    masterModalCaption: {
        fontSize: typography.fontSizeSm,
        color: colors.linenDim,
        fontWeight: typography.fontWeightMedium,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        gap: spacing.md,
    },
    emptyTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        textAlign: 'center',
    },
    emptySubtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.linenMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
    emptyRefreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm + 2,
        borderRadius: borderRadius.md,
        backgroundColor: colors.sandstone,
        marginTop: spacing.sm,
    },
    emptyRefreshBtnText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.primaryForeground,
    },
});
