import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    RefreshControl,
    Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { scheduleTimesApi } from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

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

    // Convert time string (HH:MM) to Date object
    const timeToDate = (timeStr: string): Date => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        return date;
    };

    // Convert Date object to time string (HH:MM)
    const dateToTime = (date: Date): string => {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    useEffect(() => {
        loadScheduleTimes();
    }, []);

    const loadScheduleTimes = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await scheduleTimesApi.getScheduleTimes();
            if (response.ok && response.shortsTimes && response.longFormTime) {
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

        // Validate all times
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
                'Please use HH:MM format (24-hour) for long-form time. Example: 16:30 for 4:30 PM'
            );
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await scheduleTimesApi.updateAllScheduleTimes(shortsTimes, longFormTime);
            if (response.ok && response.shortsTimes && response.longFormTime) {
                setShortsTimes(response.shortsTimes);
                setLongFormTime(response.longFormTime);
                setOriginalShortsTimes(response.shortsTimes);
                setOriginalLongFormTime(response.longFormTime);
                setSuccessMessage('Schedule times updated successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
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
                // Editing long-form time
                setLongFormTime(timeStr);
            } else {
                // Editing shorts time
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

    const hasChanges =
        JSON.stringify(shortsTimes) !== JSON.stringify(originalShortsTimes) ||
        longFormTime !== originalLongFormTime;

    if (loading && originalShortsTimes.length === 0) {
        return <LoadingSpinner />;
    }

    const getRankLabel = (index: number) => {
        const labels = ['Best', '2nd', '3rd', '4th', 'Worst'];
        return labels[index];
    };

    const getRankEmoji = (index: number) => {
        const emojis = ['🏆', '🥈', '🥉', '4️⃣', '5️⃣'];
        return emojis[index];
    };

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
                <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.successText}>{successMessage}</Text>
                </View>
            )}

            {/* Shorts Times Section */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="film-outline" size={24} color={colors.primary} />
                    <View style={styles.cardHeaderText}>
                        <Text style={styles.cardTitle}>Shorts Schedule Times</Text>
                        <Text style={styles.cardSubtitle}>5 ranked times (best to worst)</Text>
                    </View>
                </View>

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={18} color={colors.mutedForeground} />
                    <Text style={styles.infoText}>
                        Shorts are assigned times based on their quality rank. Best shorts get Rank 1 time.
                    </Text>
                </View>

                {shortsTimes.map((time, index) => (
                    <View key={index} style={styles.timeRow}>
                        <View style={styles.rankBadge}>
                            <Text style={styles.rankEmoji}>{getRankEmoji(index)}</Text>
                            <Text style={styles.rankLabel}>{getRankLabel(index)}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.timeButton}
                            onPress={() => openTimePicker(index)}
                            disabled={loading}
                        >
                            <Ionicons name="time-outline" size={18} color={colors.mutedForeground} />
                            <Text style={styles.timeText}>{time}</Text>
                            <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
                        </TouchableOpacity>
                    </View>
                ))}
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
                        value={editingIndex === -1 ? timeToDate(longFormTime) : timeToDate(shortsTimes[editingIndex!])}
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
                >
                    <Ionicons name="refresh-outline" size={20} color={colors.mutedForeground} />
                    <Text style={styles.secondaryButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, styles.primaryButton, (!hasChanges || loading) && styles.disabledButton]}
                    onPress={handleSave}
                    disabled={loading || !hasChanges}
                >
                    <Ionicons name="save-outline" size={20} color={colors.primaryForeground} />
                    <Text style={styles.primaryButtonText}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    contentContainer: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: '#0C241E',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: '#1D7F68',
    },
    successText: {
        flex: 1,
        fontSize: typography.fontSizeMd,
        color: colors.success,
        fontWeight: '500',
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        ...shadows.md,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    cardHeaderText: {
        flex: 1,
    },
    cardTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: '600',
        color: colors.foreground,
    },
    cardSubtitle: {
        fontSize: typography.fontSizeXs,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        backgroundColor: colors.muted,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
    },
    infoText: {
        flex: 1,
        fontSize: typography.fontSizeXs,
        color: colors.mutedForeground,
        lineHeight: 18,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    rankBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        minWidth: 90,
    },
    rankEmoji: {
        fontSize: 20,
    },
    rankLabel: {
        fontSize: typography.fontSizeXs,
        fontWeight: '600',
        color: colors.foreground,
    },
    timeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        backgroundColor: colors.muted,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    timeText: {
        flex: 1,
        fontSize: typography.fontSizeMd,
        fontWeight: '500',
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        ...shadows.sm,
    },
    secondaryButton: {
        backgroundColor: colors.muted,
        borderWidth: 1,
        borderColor: colors.border,
    },
    disabledButton: {
        opacity: 0.5,
    },
    primaryButtonText: {
        fontSize: typography.fontSizeMd,
        fontWeight: '600',
        color: colors.primaryForeground,
    },
    secondaryButtonText: {
        fontSize: typography.fontSizeMd,
        fontWeight: '600',
        color: colors.mutedForeground,
    },
});
