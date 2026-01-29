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
import { shortsApi } from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export default function ShortsScheduleScreen() {
    const [publishTime, setPublishTime] = useState('16:30');
    const [originalTime, setOriginalTime] = useState('16:30');
    const [showTimePicker, setShowTimePicker] = useState(false);
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
        loadPublishTime();
    }, []);

    const loadPublishTime = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await shortsApi.getPublishTime();
            if (response.ok && response.time) {
                setPublishTime(response.time);
                setOriginalTime(response.time);
            } else {
                setError(response.error || 'Failed to load publish time');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadPublishTime();
        setRefreshing(false);
    };

    const validateTime = (time: string): boolean => {
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        return timeRegex.test(time);
    };

    const handleSave = async () => {
        setSuccessMessage(null);

        if (!validateTime(publishTime)) {
            Alert.alert(
                'Invalid Time Format',
                'Please use HH:MM format (24-hour). Example: 16:30 for 4:30 PM'
            );
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await shortsApi.updatePublishTime(publishTime);
            if (response.ok && response.time) {
                setPublishTime(response.time);
                setOriginalTime(response.time);
                setSuccessMessage('Publish time updated successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
            } else {
                setError(response.error || 'Failed to update publish time');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setPublishTime(originalTime);
        setError(null);
        setSuccessMessage(null);
    };

    const handleTimeChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }

        if (selectedDate) {
            const timeStr = dateToTime(selectedDate);
            setPublishTime(timeStr);
        }
    };

    const hasChanges = publishTime !== originalTime;

    if (loading && !originalTime) {
        return <LoadingSpinner />;
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
                <View style={styles.successBanner}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={styles.successText}>{successMessage}</Text>
                </View>
            )}

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="time-outline" size={24} color={colors.primary} />
                    <View>
                        <Text style={styles.cardTitle}>Current Schedule</Text>
                        <Text style={styles.cardSubtitle}>Indian Standard Time (IST)</Text>
                    </View>
                </View>

                <View style={styles.timeDisplay}>
                    <Ionicons name="alarm-outline" size={32} color={colors.mutedForeground} />
                    <Text style={styles.currentTime}>{originalTime}</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionLabel}>Update Publish Time</Text>
                <TouchableOpacity
                    style={styles.timePickerButton}
                    onPress={() => setShowTimePicker(true)}
                    disabled={loading}
                >
                    <Ionicons name="time-outline" size={20} color={colors.mutedForeground} />
                    <Text style={styles.timePickerText}>{publishTime}</Text>
                    <Ionicons name="chevron-down" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
                <Text style={styles.helperText}>
                    Tap to select time using the picker
                </Text>

                {showTimePicker && (
                    <DateTimePicker
                        value={timeToDate(publishTime)}
                        mode="time"
                        is24Hour={true}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                    />
                )}
            </View>

            <View style={styles.card}>
                <Text style={styles.sectionLabel}>Quick Presets</Text>
                <View style={styles.presetsGrid}>
                    {[
                        { time: '09:00', label: '9:00 AM' },
                        { time: '12:00', label: '12:00 PM' },
                        { time: '16:30', label: '4:30 PM' },
                        { time: '20:00', label: '8:00 PM' },
                    ].map((preset) => (
                        <TouchableOpacity
                            key={preset.time}
                            style={[
                                styles.presetChip,
                                publishTime === preset.time && styles.presetChipActive
                            ]}
                            onPress={() => setPublishTime(preset.time)}
                            disabled={loading}
                        >
                            <Text style={[
                                styles.presetText,
                                publishTime === preset.time && styles.presetTextActive
                            ]}>
                                {preset.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.primaryButton, (!hasChanges || loading) && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={!hasChanges || loading}
                >
                    <Ionicons
                        name={loading ? "sync" : "save-outline"}
                        size={20}
                        color={colors.primaryForeground}
                    />
                    <Text style={styles.primaryButtonText}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Text>
                </TouchableOpacity>
                {hasChanges && (
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={handleReset}
                        disabled={loading}
                    >
                        <Ionicons name="refresh-outline" size={20} color={colors.foreground} />
                        <Text style={styles.secondaryButtonText}>Reset</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                    <Text style={styles.infoTitle}>How it works</Text>
                </View>
                <Text style={styles.infoText}>
                    Shorts videos are automatically published to YouTube at the scheduled time each day.
                    All times are in Indian Standard Time (IST).
                </Text>
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
        paddingBottom: spacing.xxxl,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        ...shadows.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    cardTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    cardSubtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.mutedForeground,
        marginTop: 2,
    },
    timeDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.muted,
        padding: spacing.lg,
        borderRadius: borderRadius.md,
    },
    currentTime: {
        fontSize: 36,
        fontWeight: typography.fontWeightBold,
        color: colors.primary,
        letterSpacing: 2,
    },
    sectionLabel: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        marginBottom: spacing.md,
    },
    timePickerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        backgroundColor: colors.background,
    },
    timePickerText: {
        flex: 1,
        fontSize: 24,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        letterSpacing: 2,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        backgroundColor: colors.background,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
        letterSpacing: 2,
    },
    helperText: {
        fontSize: typography.fontSizeXs,
        color: colors.mutedForeground,
        marginTop: spacing.sm,
        fontStyle: 'italic',
    },
    presetsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    presetChip: {
        flex: 1,
        minWidth: '45%',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        alignItems: 'center',
    },
    presetChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    presetText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.foreground,
    },
    presetTextActive: {
        color: colors.primaryForeground,
    },
    actionButtons: {
        gap: spacing.sm,
        marginBottom: spacing.lg,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        ...shadows.sm,
    },
    primaryButtonText: {
        color: colors.primaryForeground,
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
    },
    secondaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.background,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    secondaryButtonText: {
        color: colors.foreground,
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightMedium,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    successBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.success,
    },
    successText: {
        flex: 1,
        color: colors.success,
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
    },
    infoCard: {
        backgroundColor: colors.muted,
        borderRadius: borderRadius.md,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        marginBottom: spacing.sm,
    },
    infoTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
    infoText: {
        fontSize: typography.fontSizeSm,
        color: colors.mutedForeground,
        lineHeight: 20,
    },
});
