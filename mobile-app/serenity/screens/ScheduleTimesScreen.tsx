import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    RefreshControl,
    Platform,
    Animated,
    LayoutAnimation,
    UIManager,
    Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { scheduleTimesApi } from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import SkeletonLoader from '../components/SkeletonLoader';
import { colors, spacing, borderRadius, typography, shadows, gradients } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnim = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
};

type TimelineRowProps = {
    time: string;
    index: number;
    loading: boolean;
    openTimePicker: (index: number) => void;
};

function TimelineRow({ time, index, loading, openTimePicker }: TimelineRowProps) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.96,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
        }).start();
    };

    const getRankInfo = (idx: number) => {
        const labels = ['Best Slot', '2nd Slot', '3rd Slot', '4th Slot', 'Worst Slot'];
        const badgeColors = [
            ['#FBBF24', '#D97706'], // Gold
            ['#CBD5E1', '#64748B'], // Silver
            ['#FDBA74', '#C2410C'], // Bronze
            ['#94A3B8', '#475569'], // Grey
            ['#475569', '#1E293B'], // Dark
        ] as const;
        return {
            label: labels[idx],
            colors: badgeColors[idx]
        };
    };

    const rankInfo = getRankInfo(index);

    return (
        <Animated.View style={[styles.timelineRow, { transform: [{ scale }] }]}>
            {/* Timeline track left */}
            <View style={styles.trackContainer}>
                <View style={styles.trackLine} />
                <LinearGradient
                    colors={rankInfo.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.trackDot}
                >
                    <Text style={styles.trackDotText}>{index + 1}</Text>
                </LinearGradient>
            </View>

            {/* Time Slot card */}
            <TouchableOpacity
                style={styles.timeButton}
                onPress={() => openTimePicker(index)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={loading}
                activeOpacity={1}
            >
                <View style={styles.timeButtonLeft}>
                    <Text style={styles.rankLabel}>{rankInfo.label}</Text>
                    <Text style={styles.timeText}>{time}</Text>
                </View>
                <View style={styles.timeButtonRight}>
                    <Ionicons name="time-outline" size={16} color={colors.primary} />
                    <Ionicons name="chevron-down" size={16} color={colors.foregroundMuted} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function ScheduleTimesScreen() {
    const [shortsTimes, setShortsTimes] = useState<string[]>(['16:30', '18:00', '20:00', '12:00', '14:00']);
    const [longFormTime, setLongFormTime] = useState('18:30');
    const [originalShortsTimes, setOriginalShortsTimes] = useState<string[]>(['16:30', '18:00', '20:00', '12:00', '14:00']);
    const [originalLongFormTime, setOriginalLongFormTime] = useState('18:30');

    const [showTimePicker, setShowTimePicker] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null); // null = long-form, 0-4 = shorts rank

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    useEffect(() => {
        loadScheduleTimes();
    }, []);

    const loadScheduleTimes = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await scheduleTimesApi.getScheduleTimes();
            if (response.ok && response.shortsTimes && response.longFormTime) {
                triggerLayoutAnim();
                setShortsTimes(response.shortsTimes);
                setLongFormTime(response.longFormTime);
                setOriginalShortsTimes(response.shortsTimes);
                setOriginalLongFormTime(response.longFormTime);
            } else {
                setError(response.error || 'Failed to load schedule times');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadScheduleTimes();
        setRefreshing(false);
    };

    const validateTime = (time: string): boolean => {
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    };

    const handleSave = async () => {
        setSuccessMessage(null);

        for (const time of shortsTimes) {
            if (!validateTime(time)) {
                Alert.alert(
                    'Invalid Time Format',
                    `Invalid shorts time: ${time}. Please use HH:MM format (24-hour).`
                );
                return;
            }
        }

        if (!validateTime(longFormTime)) {
            Alert.alert(
                'Invalid Time Format',
                'Please use HH:MM format (24-hour) for long-form time. Example: 18:30 for 6:30 PM'
            );
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await scheduleTimesApi.updateAllScheduleTimes(shortsTimes, longFormTime);
            if (response.ok && response.shortsTimes && response.longFormTime) {
                triggerLayoutAnim();
                setShortsTimes(response.shortsTimes);
                setLongFormTime(response.longFormTime);
                setOriginalShortsTimes(response.shortsTimes);
                setOriginalLongFormTime(response.longFormTime);
                setSuccessMessage('Schedule times updated successfully!');
                setTimeout(() => {
                    triggerLayoutAnim();
                    setSuccessMessage(null);
                }, 3000);
            } else {
                setError(response.error || 'Failed to update schedule times');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        triggerLayoutAnim();
        setShortsTimes(originalShortsTimes);
        setLongFormTime(originalLongFormTime);
        setError(null);
        setSuccessMessage(null);
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }

        if (selectedDate && editingIndex !== null) {
            const timeStr = dateToTime(selectedDate);

            if (editingIndex === -1) {
                setLongFormTime(timeStr);
            } else {
                const newTimes = [...shortsTimes];
                newTimes[editingIndex] = timeStr;
                setShortsTimes(newTimes);
            }
        }

        if (Platform.OS === 'ios' && event.type === 'dismissed') {
            setShowTimePicker(false);
            setEditingIndex(null);
        }
    };

    const openTimePicker = (index: number) => {
        setEditingIndex(index);
        setShowTimePicker(true);
    };

    const getActiveTime = (): string => {
        if (editingIndex === -1) return longFormTime;
        if (editingIndex !== null && shortsTimes[editingIndex] !== undefined) {
            return shortsTimes[editingIndex];
        }
        return '12:00';
    };

    const timeToDate = (timeStr?: string): Date => {
        const safeTime = timeStr || '12:00';
        const [hours, minutes] = safeTime.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    const dateToTime = (date: Date): string => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    const hasChanges =
        JSON.stringify(shortsTimes) !== JSON.stringify(originalShortsTimes) ||
        longFormTime !== originalLongFormTime;

    if (loading && originalShortsTimes.length === 0) {
        return <SkeletonLoader variant="schedule" />;
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                />
            }
        >
            {error && <ErrorMessage message={error} />}

            {successMessage && (
                <LinearGradient
                    colors={['#0C2E24', '#065F46']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.successBanner}
                >
                    <Ionicons name="checkmark-circle" size={18} color={colors.successGlow} />
                    <Text style={styles.successText}>{successMessage}</Text>
                </LinearGradient>
            )}

            {/* Shorts Schedule Timeline */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.iconShell}>
                        <Ionicons name="film" size={18} color={colors.gradientTo} />
                    </View>
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>Shorts Schedule Flow</Text>
                        <Text style={styles.cardSubtitle}>Times ranked by quality output slots</Text>
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle" size={16} color={colors.gradientFrom} />
                    <Text style={styles.infoText}>
                        Video rendering queue schedules the top quality renders at Rank 1 slot, decreasing sequentially.
                    </Text>
                </View>

                <View style={styles.timelineContainer}>
                    {shortsTimes.map((time, index) => (
                        <TimelineRow
                            key={index}
                            time={time}
                            index={index}
                            loading={loading}
                            openTimePicker={openTimePicker}
                        />
                    ))}
                </View>
            </View>

            {/* Long-Form Time Section */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="videocam-outline" size={24} color={colors.primary} />
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>Long-Form Video Time</Text>
                        <Text style={styles.cardSubtitle}>Indian Standard Time (IST)</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.longFormTimeButton}
                    onPress={() => openTimePicker(-1)}
                    disabled={loading}
                >
                    <Ionicons name="alarm-outline" size={32} color={colors.primary} />
                    <Text style={styles.longFormTimeText}>{longFormTime}</Text>
                    <Ionicons name="create-outline" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
            </View>

            {/* Time Picker */}
            {showTimePicker && (
                <View style={styles.pickerContainer}>
                    <DateTimePicker
                        value={timeToDate(getActiveTime())}
                        mode="time"
                        is24Hour={true}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                    />
                    {Platform.OS === 'ios' && (
                        <View style={styles.pickerActions}>
                            <TouchableOpacity
                                style={styles.pickerButton}
                                onPress={() => {
                                    setShowTimePicker(false);
                                    setEditingIndex(null);
                                }}
                            >
                                <Text style={styles.pickerButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={handleReset}
                    disabled={loading || !hasChanges}
                    activeOpacity={0.8}
                >
                    <Ionicons name="refresh-outline" size={18} color={colors.foregroundMuted} />
                    <Text style={styles.secondaryButtonText}>Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.primaryButton, (!hasChanges || loading) && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={loading || !hasChanges}
                    activeOpacity={0.85}
                >
                    <LinearGradient
                        colors={!hasChanges ? ['#242D42', '#1B2335'] : gradients.primary}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientBtn}
                    >
                        <Ionicons name="save-outline" size={18} color={colors.primaryForeground} />
                        <Text style={styles.primaryButtonText}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    contentContainer: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        ...shadows.glowSuccess,
    },
    successText: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        fontWeight: typography.fontWeightSemibold,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.md,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    iconShell: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: typography.fontSizeMd + 1,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        letterSpacing: 0.3,
    },
    cardSubtitle: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        marginTop: 2,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: 'rgba(99, 102, 241, 0.05)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.15)',
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        lineHeight: 18,
    },
    timelineContainer: {
        paddingLeft: spacing.sm,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 72,
    },
    trackContainer: {
        width: 30,
        alignItems: 'center',
        position: 'relative',
    },
    trackLine: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 2,
        backgroundColor: colors.border,
    },
    trackDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 18,
        zIndex: 2,
        borderWidth: 2,
        borderColor: colors.card,
    },
    trackDotText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: typography.fontWeightBold,
    },
    timeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.secondary,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        marginLeft: spacing.sm,
        marginBottom: spacing.md,
        ...shadows.sm,
        overflow: 'hidden',
    },
    timeButtonLeft: {
        gap: 3,
    },
    timeButtonRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    rankLabel: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timeText: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    longFormTimeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        backgroundColor: colors.muted,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        borderWidth: 2,
        borderColor: colors.border,
    },
    longFormTimeText: {
        fontSize: 32,
        fontWeight: '700',
        color: colors.primary,
        letterSpacing: 2,
    },
    pickerContainer: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        ...shadows.md,
    },
    pickerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: spacing.md,
    },
    pickerButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    pickerButtonText: {
        fontSize: typography.fontSizeMd,
        fontWeight: '600',
        color: colors.primary,
    },
    actions: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    button: {
        flex: 1,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    primaryButton: {
        ...shadows.sm,
    },
    gradientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.secondary,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    disabledButton: {
        opacity: 0.6,
    },
    primaryButtonText: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.primaryForeground,
    },
    secondaryButtonText: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foregroundMuted,
    },
});
