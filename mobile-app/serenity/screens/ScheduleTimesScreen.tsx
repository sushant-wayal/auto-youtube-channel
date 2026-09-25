import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Modal,
    Animated,
    LayoutAnimation,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scheduleTimesApi, pipelineApi, PipelineStatus, RetentionStat } from '../services/api';
import SkeletonLoader from '../components/SkeletonLoader';
import { colors, spacing, borderRadius, typography } from '../theme';

const triggerLayoutAnim = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

interface SlotMetadata {
    rank: number;
    title: string;
    windowLabel: string;
}

const DEFAULT_SLOT_META: SlotMetadata[] = [
    { rank: 1, title: 'Evening Prime', windowLabel: 'Peak Reach' },
    { rank: 2, title: 'Dinner Window', windowLabel: 'High Traffic' },
    { rank: 3, title: 'Early Evening', windowLabel: 'Sustained' },
    { rank: 4, title: 'Lunch Window', windowLabel: 'Midday' },
    { rank: 5, title: 'Night Window', windowLabel: 'Late Watch' },
];

const PRESETS = ['13:30', '18:30', '18:45', '19:45', '20:45', '21:45'];

export default function ScheduleTimesScreen() {
    const [shortsTimes, setShortsTimes] = useState<string[]>([]);
    const [longFormTime, setLongFormTime] = useState('');
    const [originalShortsTimes, setOriginalShortsTimes] = useState<string[]>([]);
    const [originalLongFormTime, setOriginalLongFormTime] = useState('');

    const [viewMode, setViewMode] = useState<'ranked' | 'timeline'>('ranked');
    const [pipelineData, setPipelineData] = useState<PipelineStatus | null>(null);
    const [retentionStats, setRetentionStats] = useState<Record<string, RetentionStat>>({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Toast state
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const toastOpacity = useRef(new Animated.Value(0)).current;

    // Time picker sheet state
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerTitle, setPickerTitle] = useState('');
    const [pickerTarget, setPickerTarget] = useState<'longform' | number>('longform');
    const [pickerHour, setPickerHour] = useState(18);
    const [pickerMinute, setPickerMinute] = useState(30);

    const hasChanges =
        longFormTime !== originalLongFormTime ||
        JSON.stringify(shortsTimes) !== JSON.stringify(originalShortsTimes);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.delay(2400),
            Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => setToastMessage(null));
    };

    useEffect(() => {
        loadScheduleTimes();
    }, []);

    const loadScheduleTimes = async () => {
        setLoading(true);
        setError(null);
        try {
            const [schedRes, pipeRes] = await Promise.all([
                scheduleTimesApi.getScheduleTimes(),
                pipelineApi.getPipelineStatus().catch(() => null),
            ]);

            if (schedRes.ok && schedRes.shortsTimes && schedRes.longFormTime) {
                triggerLayoutAnim();
                setShortsTimes(schedRes.shortsTimes);
                setLongFormTime(schedRes.longFormTime);
                setOriginalShortsTimes(schedRes.shortsTimes);
                setOriginalLongFormTime(schedRes.longFormTime);
                if (schedRes.retentionStats) {
                    setRetentionStats(schedRes.retentionStats);
                }
            } else if (schedRes.error) {
                setError(schedRes.error);
            }

            if (pipeRes && pipeRes.ok && pipeRes.status) {
                setPipelineData(pipeRes.status);
            }
        } catch (err: any) {
            setError(String(err.message || err));
        } finally {
            setLoading(false);
        }
    };

    const formatToISTTime = (timeStr?: string): string | null => {
        if (!timeStr) return null;
        if (timeStr.includes('T')) {
            try {
                const d = new Date(timeStr);
                return d.toLocaleTimeString('en-GB', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                });
            } catch {
                return null;
            }
        }
        return timeStr.slice(0, 5);
    };

    const getScheduledShortForSlot = (slotTime: string, slotRank: number): string | null => {
        if (!pipelineData?.shorts || pipelineData.shorts.length === 0) return null;

        // Verify the pipeline run occurred recently (within last 24 hours)
        if (pipelineData.ranAt) {
            const runTime = new Date(pipelineData.ranAt).getTime();
            const diffHours = (Date.now() - runTime) / (1000 * 60 * 60);
            if (diffHours < 0 || diffHours > 24) return null;
        }

        // Match by scheduled publish time converted to IST or by slot rank
        const match = pipelineData.shorts.find((s) => {
            if (s.scheduledPublishTime) {
                const istTime = formatToISTTime(s.scheduledPublishTime);
                if (istTime === slotTime) return true;
            }
            if (s.rank !== undefined && s.rank === slotRank) return true;
            return false;
        });

        if (!match) return null;

        return (
            (pipelineData.shortHooks && pipelineData.shortHooks[match.shortIndex]) ||
            `Short #${match.shortIndex + 1}`
        );
    };

    const getTodayLongForm = (): string | null => {
        if (!pipelineData?.videoTitle) return null;
        if (pipelineData.ranAt) {
            const runTime = new Date(pipelineData.ranAt).getTime();
            const diffHours = (Date.now() - runTime) / (1000 * 60 * 60);
            if (diffHours < 0 || diffHours > 24) return null;
        }
        return pipelineData.videoTitle;
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadScheduleTimes();
        setRefreshing(false);
    };

    const openTimePicker = (title: string, currentTime: string, target: 'longform' | number) => {
        setPickerTitle(title);
        setPickerTarget(target);
        const [h, m] = currentTime.split(':').map(Number);
        setPickerHour(isNaN(h) ? 18 : h);
        setPickerMinute(isNaN(m) ? 30 : m);
        setPickerVisible(true);
    };

    const handleApplyPreset = (preset: string) => {
        const [h, m] = preset.split(':').map(Number);
        setPickerHour(h);
        setPickerMinute(m);
    };

    const handleConfirmPicker = () => {
        const formatted = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
        if (pickerTarget === 'longform') {
            setLongFormTime(formatted);
            showToast(`Long-form set to ${formatted} IST`);
        } else if (typeof pickerTarget === 'number') {
            const updated = [...shortsTimes];
            updated[pickerTarget] = formatted;
            setShortsTimes(updated);
            showToast(`Slot updated to ${formatted} IST`);
        }
        setPickerVisible(false);
    };

    const handleResetToOptimal = () => {
        triggerLayoutAnim();
        const optimalShorts = ['20:45', '19:45', '18:45', '13:30', '21:45'];
        const optimalLong = '18:30';
        setShortsTimes(optimalShorts);
        setLongFormTime(optimalLong);
        showToast('Times reset to AI optimal distribution');
    };

    const handleSaveCadence = async () => {
        setSaving(true);
        try {
            const res = await scheduleTimesApi.updateAllScheduleTimes(shortsTimes, longFormTime);
            if (res.ok) {
                setOriginalShortsTimes(shortsTimes);
                setOriginalLongFormTime(longFormTime);
                showToast('Schedule synchronized to cloud');
            } else {
                showToast(res.error || 'Failed to update schedule');
            }
        } catch (err: any) {
            showToast(err.message || 'Error saving schedule');
        } finally {
            setSaving(false);
        }
    };

    // Prepare slots data for rendering
    const slotsData = shortsTimes.map((time, idx) => {
        const meta = DEFAULT_SLOT_META[idx] || {
            rank: idx + 1,
            title: `Slot ${idx + 1}`,
            windowLabel: 'Standard',
        };
        return {
            ...meta,
            index: idx,
            time,
        };
    });

    const displaySlots = [...slotsData].sort((a, b) => {
        if (viewMode === 'ranked') {
            return a.rank - b.rank;
        }
        const [ah, am] = a.time.split(':').map(Number);
        const [bh, bm] = b.time.split(':').map(Number);
        return (ah * 60 + am) - (bh * 60 + bm);
    });

    if (loading && !refreshing && shortsTimes.length === 0) {
        return (
            <View style={styles.screen}>
                <SkeletonLoader variant="schedule" />
            </View>
        );
    }

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
                {/* Clean Header */}
                <View style={styles.header}>
                    <View style={styles.headerTitleRow}>
                        <Text style={styles.pageTitle}>Publishing Schedule</Text>
                        <View style={styles.timezoneBadge}>
                            <Ionicons name="time-outline" size={11} color={colors.sandstone} />
                            <Text style={styles.timezoneText}>IST (UTC+5:30)</Text>
                        </View>
                    </View>
                    <Text style={styles.pageSubtitle}>Daily automated video release windows</Text>
                </View>


                {/* Long-Form Premiere Card */}
                <View style={styles.pillarCard}>
                    <View style={styles.pillarHeader}>
                        <View style={styles.pillarTag}>
                            <Ionicons name="videocam-outline" size={12} color={colors.sandstone} />
                            <Text style={styles.pillarTagText}>LONG-FORM VIDEO</Text>
                        </View>
                        <Text style={styles.pillarSlotHint}>Daily Episode</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.pillarTimeBox}
                        activeOpacity={0.8}
                        onPress={() => openTimePicker('Long-Form Premiere', longFormTime, 'longform')}
                    >
                        <View style={styles.pillarTimeInfo}>
                            <View style={styles.clockIconBox}>
                                <Ionicons name="time-outline" size={18} color={colors.sandstone} />
                            </View>
                            <View style={styles.pillarTimeTextCol}>
                                <View style={styles.timeWithZoneRow}>
                                    <Text style={styles.pillarTimeText}>{longFormTime}</Text>
                                    <Text style={styles.timeZoneText}>IST</Text>
                                </View>
                                <Text style={styles.pillarTimeCaption} numberOfLines={1}>
                                    Prime desktop broadcast window
                                </Text>
                                {getTodayLongForm() ? (
                                    <View style={styles.pillarLinkedRow}>
                                        <View style={styles.emeraldDot} />
                                        <Text style={styles.slotLinkedLabel}>Today: </Text>
                                        <Text style={styles.pillarLinkedTitle} numberOfLines={1} ellipsizeMode="tail">
                                            {getTodayLongForm()}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        </View>

                        <View style={styles.editPill}>
                            <Ionicons name="create-outline" size={12} color={colors.obsidian[950]} />
                            <Text style={styles.editPillText}>Edit</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Shorts Releases Section */}
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionTitleRow}>
                        <Text style={styles.sectionTitle}>Shorts Schedule</Text>
                        <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{shortsTimes.length} SLOTS</Text>
                        </View>
                    </View>

                    <View style={styles.segmentedToggle}>
                        <TouchableOpacity
                            style={[styles.segmentBtn, viewMode === 'ranked' && styles.segmentBtnActive]}
                            onPress={() => {
                                setViewMode('ranked');
                                showToast('Sorted by priority');
                            }}
                        >
                            <Text style={[styles.segmentText, viewMode === 'ranked' && styles.segmentTextActive]}>
                                Priority
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.segmentBtn, viewMode === 'timeline' && styles.segmentBtnActive]}
                            onPress={() => {
                                setViewMode('timeline');
                                showToast('Sorted chronologically');
                            }}
                        >
                            <Text style={[styles.segmentText, viewMode === 'timeline' && styles.segmentTextActive]}>
                                Timeline
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Shorts Slots List */}
                <View style={styles.slotsList}>
                    {displaySlots.map((slot, sIdx) => {
                        const isTopPriority = slot.rank === 1 && viewMode === 'ranked';
                        const displayIndex = viewMode === 'timeline'
                            ? (sIdx + 1 < 10 ? `0${sIdx + 1}` : `${sIdx + 1}`)
                            : (slot.rank < 10 ? `0${slot.rank}` : `${slot.rank}`);
                        const linkedShortTitle = getScheduledShortForSlot(slot.time, slot.rank);
                        const retentionStat = retentionStats[slot.time];

                        return (
                            <View
                                key={`slot-${slot.index}`}
                                style={[styles.slotCard, isTopPriority && styles.slotCardTopPriority]}
                            >
                                <View style={styles.slotLeft}>
                                    <View style={[styles.slotIndexBadge, isTopPriority && styles.slotIndexBadgeGold]}>
                                        <Text style={[styles.slotIndexText, isTopPriority && styles.slotIndexTextGold]}>
                                            {displayIndex}
                                        </Text>
                                    </View>
                                    <View style={styles.slotDetails}>
                                        <View style={styles.slotTitleRow}>
                                            <Text style={styles.slotTitle}>{slot.title}</Text>
                                            <Text style={styles.slotWindowHint}>· {slot.windowLabel}</Text>
                                        </View>
                                        <View style={styles.slotTimeRow}>
                                            <Text style={styles.slotTimeText}>{slot.time}</Text>
                                            <Text style={styles.slotTimeIst}>IST</Text>
                                            {retentionStat && retentionStat.estimatedRetention > 0 ? (
                                                <View style={styles.retentionPill}>
                                                    <Ionicons name="trending-up" size={10} color={colors.sandstone} />
                                                    <Text style={styles.retentionPillText}>
                                                        ~{Math.round(retentionStat.estimatedRetention)}% Ret
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={styles.noHistoryPill}>
                                                    <Text style={styles.noHistoryPillText}>No History</Text>
                                                </View>
                                            )}
                                        </View>
                                        {linkedShortTitle ? (
                                            <View style={styles.slotLinkedRow}>
                                                <View style={styles.emeraldDot} />
                                                <Text style={styles.slotLinkedLabel}>Today: </Text>
                                                <Text style={styles.slotLinkedTitle} numberOfLines={1} ellipsizeMode="tail">
                                                    {linkedShortTitle}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.slotEditBtn}
                                    activeOpacity={0.8}
                                    onPress={() => openTimePicker(`Shorts Slot · ${slot.title}`, slot.time, slot.index)}
                                >
                                    <Ionicons name="create-outline" size={11} color={colors.sandstone} />
                                    <Text style={styles.slotEditBtnText}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Bottom Dock Action Bar */}
            <View style={styles.bottomDock}>
                <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={handleResetToOptimal}
                    disabled={saving}
                    activeOpacity={0.8}
                >
                    <Ionicons name="refresh-outline" size={13} color={colors.linenMuted} />
                    <Text style={styles.resetBtnText}>Reset Optimal</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.saveBtn, !hasChanges && styles.saveBtnMuted]}
                    onPress={handleSaveCadence}
                    disabled={saving || !hasChanges}
                    activeOpacity={0.85}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color={colors.obsidian[950]} />
                    ) : (
                        <>
                            <Ionicons
                                name={hasChanges ? "checkmark-done" : "checkmark"}
                                size={14}
                                color={hasChanges ? colors.obsidian[950] : colors.linenWhisper}
                            />
                            <Text style={[styles.saveBtnText, !hasChanges && styles.saveBtnTextMuted]}>
                                {hasChanges ? 'Save Schedule' : 'Schedule Saved'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Toast Overlay */}
            {toastMessage && (
                <Animated.View style={[styles.toastContainer, { opacity: toastOpacity }]}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.sandstone} />
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}

            {/* Bottom Sheet Time Picker Modal */}
            <Modal
                visible={pickerVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setPickerVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity
                        style={styles.modalDismiss}
                        activeOpacity={1}
                        onPress={() => setPickerVisible(false)}
                    />
                    <View style={styles.pickerSheet}>
                        <View style={styles.sheetHandle} />

                        <View style={styles.sheetHeader}>
                            <View>
                                <Text style={styles.sheetKicker}>SET RELEASE TIME</Text>
                                <Text style={styles.sheetTitle}>{pickerTitle}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.sheetCloseBtn}
                                onPress={() => setPickerVisible(false)}
                            >
                                <Ionicons name="close" size={16} color={colors.linenMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Interactive Steppers for Hour & Minute */}
                        <View style={styles.stepperContainer}>
                            {/* Hour Col */}
                            <View style={styles.stepperCol}>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => setPickerHour((h) => (h + 1) % 24)}
                                >
                                    <Ionicons name="chevron-up" size={18} color={colors.sandstone} />
                                </TouchableOpacity>
                                <Text style={styles.stepperVal}>{String(pickerHour).padStart(2, '0')}</Text>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => setPickerHour((h) => (h - 1 + 24) % 24)}
                                >
                                    <Ionicons name="chevron-down" size={18} color={colors.sandstone} />
                                </TouchableOpacity>
                                <Text style={styles.stepperSub}>HOURS</Text>
                            </View>

                            <Text style={styles.stepperSeparator}>:</Text>

                            {/* Minute Col */}
                            <View style={styles.stepperCol}>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => setPickerMinute((m) => (m + 5) % 60)}
                                >
                                    <Ionicons name="chevron-up" size={18} color={colors.sandstone} />
                                </TouchableOpacity>
                                <Text style={styles.stepperVal}>{String(pickerMinute).padStart(2, '0')}</Text>
                                <TouchableOpacity
                                    style={styles.stepperBtn}
                                    onPress={() => setPickerMinute((m) => (m - 5 + 60) % 60)}
                                >
                                    <Ionicons name="chevron-down" size={18} color={colors.sandstone} />
                                </TouchableOpacity>
                                <Text style={styles.stepperSub}>MINUTES</Text>
                            </View>
                        </View>

                        {/* Quick Presets */}
                        <Text style={styles.presetHeading}>POPULAR RELEASE SLOTS</Text>
                        <View style={styles.presetRow}>
                            {PRESETS.map((preset) => {
                                const currentFormatted = `${String(pickerHour).padStart(2, '0')}:${String(pickerMinute).padStart(2, '0')}`;
                                const isSelected = currentFormatted === preset;
                                return (
                                    <TouchableOpacity
                                        key={preset}
                                        style={[styles.presetPill, isSelected && styles.presetPillActive]}
                                        onPress={() => handleApplyPreset(preset)}
                                    >
                                        <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                                            {preset}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Confirm Button */}
                        <TouchableOpacity
                            style={styles.confirmPickerBtn}
                            onPress={handleConfirmPicker}
                        >
                            <Text style={styles.confirmPickerText}>Apply Time</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: 110,
    },
    header: {
        marginBottom: spacing.sm + 2,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 3,
    },
    pageTitle: {
        fontSize: 20,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: -0.3,
    },
    pageSubtitle: {
        fontSize: 12,
        color: colors.linenMuted,
    },
    timezoneBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    timezoneText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenMuted,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    // Long-Form Premiere Card
    pillarCard: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.sm + 4,
        marginBottom: spacing.md,
    },
    pillarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    pillarTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: colors.sandstoneTint,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: borderRadius.xs - 2,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
    },
    pillarTagText: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 0.8,
    },
    pillarSlotHint: {
        fontSize: 10,
        color: colors.linenWhisper,
    },
    pillarTimeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.borderLight,
        borderRadius: borderRadius.sm,
        padding: 10,
        gap: 10,
    },
    pillarTimeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        minWidth: 0,
    },
    clockIconBox: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    pillarTimeTextCol: {
        flex: 1,
        minWidth: 0,
    },
    timeWithZoneRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 4,
    },
    pillarTimeText: {
        fontSize: 22,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: -0.5,
    },
    timeZoneText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
    },
    pillarTimeCaption: {
        fontSize: 10,
        color: colors.linenWhisper,
        marginTop: 1,
    },
    pillarLinkedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        gap: 4,
    },
    pillarLinkedTitle: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenDim,
        flex: 1,
    },
    editPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.sandstone,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: borderRadius.xs,
        flexShrink: 0,
    },
    editPillText: {
        fontSize: 11,
        fontWeight: typography.fontWeightBold,
        color: colors.obsidian[950],
    },

    // Shorts Section
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs + 4,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    countBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    countBadgeText: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.linenMuted,
        letterSpacing: 0.5,
    },
    segmentedToggle: {
        flexDirection: 'row',
        backgroundColor: colors.card,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 2,
    },
    segmentBtn: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.xs - 2,
    },
    segmentBtnActive: {
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
    },
    segmentText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenWhisper,
    },
    segmentTextActive: {
        color: colors.sandstone,
        fontWeight: typography.fontWeightSemibold,
    },

    // Shorts Slots List
    slotsList: {
        gap: 6,
    },
    slotCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: 9,
        paddingHorizontal: 10,
        gap: 8,
    },
    slotCardTopPriority: {
        borderColor: colors.sandstoneBorder,
        backgroundColor: 'rgba(200, 178, 155, 0.05)',
    },
    slotLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        minWidth: 0,
    },
    slotIndexBadge: {
        width: 26,
        height: 26,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    slotIndexBadgeGold: {
        backgroundColor: colors.sandstoneTint,
        borderColor: colors.sandstoneBorder,
    },
    slotIndexText: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.linenMuted,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    slotIndexTextGold: {
        color: colors.sandstone,
    },
    slotDetails: {
        flex: 1,
        minWidth: 0,
    },
    slotTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 1,
    },
    slotTitle: {
        fontSize: 11,
        fontWeight: typography.fontWeightSemibold,
        color: colors.linen,
    },
    slotWindowHint: {
        fontSize: 9,
        color: colors.linenWhisper,
    },
    slotTimeRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 3,
    },
    slotTimeText: {
        fontSize: 14,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: -0.2,
    },
    slotTimeIst: {
        fontSize: 9,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenWhisper,
    },
    retentionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.sandstoneTint,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        marginLeft: 6,
    },
    retentionPillText: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 0.2,
    },
    noHistoryPill: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginLeft: 6,
    },
    noHistoryPillText: {
        fontSize: 8.5,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenWhisper,
        letterSpacing: 0.2,
    },
    slotLinkedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        gap: 4,
    },
    emeraldDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#10B981',
        flexShrink: 0,
    },
    slotLinkedLabel: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        flexShrink: 0,
    },
    slotLinkedTitle: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenDim,
        flex: 1,
    },
    slotEditBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
        flexShrink: 0,
    },
    slotEditBtnText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenDim,
    },

    // Bottom Dock Action Bar
    bottomDock: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: borderRadius.xs,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    resetBtnText: {
        fontSize: 11,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenMuted,
    },
    saveBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: colors.sandstone,
        paddingVertical: 9,
        borderRadius: borderRadius.xs,
    },
    saveBtnMuted: {
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    saveBtnText: {
        fontSize: 12,
        fontWeight: typography.fontWeightBold,
        color: colors.obsidian[950],
    },
    saveBtnTextMuted: {
        color: colors.linenWhisper,
    },

    // Toast
    toastContainer: {
        position: 'absolute',
        bottom: 60,
        alignSelf: 'center',
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.sandstoneBorder,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: borderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 6,
    },
    toastText: {
        fontSize: 11,
        fontWeight: typography.fontWeightMedium,
        color: colors.linen,
    },

    // Time Picker Modal Sheet
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalDismiss: {
        flex: 1,
    },
    pickerSheet: {
        backgroundColor: colors.card,
        borderTopLeftRadius: borderRadius.lg,
        borderTopRightRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md + 2,
    },
    sheetHandle: {
        width: 32,
        height: 3,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginBottom: spacing.sm,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm + 2,
    },
    sheetKicker: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 0.8,
    },
    sheetTitle: {
        fontSize: 14,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
    },
    sheetCloseBtn: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        paddingVertical: 10,
        backgroundColor: colors.surfaceRecessed,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: spacing.sm + 2,
    },
    stepperCol: {
        alignItems: 'center',
    },
    stepperBtn: {
        padding: 4,
    },
    stepperVal: {
        fontSize: 28,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: -0.5,
    },
    stepperSub: {
        fontSize: 8,
        fontWeight: typography.fontWeightBold,
        color: colors.linenWhisper,
        letterSpacing: 0.5,
        marginTop: 2,
    },
    stepperSeparator: {
        fontSize: 26,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        marginBottom: 8,
    },
    presetHeading: {
        fontSize: 9,
        fontWeight: typography.fontWeightBold,
        color: colors.linenWhisper,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: spacing.md,
    },
    presetPill: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: borderRadius.xs - 2,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
    },
    presetPillActive: {
        backgroundColor: colors.sandstoneTint,
        borderColor: colors.sandstone,
    },
    presetText: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenMuted,
    },
    presetTextActive: {
        color: colors.sandstone,
        fontWeight: typography.fontWeightBold,
    },
    confirmPickerBtn: {
        backgroundColor: colors.sandstone,
        borderRadius: borderRadius.xs,
        paddingVertical: 10,
        alignItems: 'center',
    },
    confirmPickerText: {
        fontSize: 12,
        fontWeight: typography.fontWeightBold,
        color: colors.obsidian[950],
    },
});
