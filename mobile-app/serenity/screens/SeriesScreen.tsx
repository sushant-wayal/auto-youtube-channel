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
    Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, gradients } from '../theme';
import { seriesApi, SeriesState } from '../services/api';

export default function SeriesScreen() {
    const [seriesList, setSeriesList] = useState<SeriesState[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isCreateModalVisible, setCreateModalVisible] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newLearningGoal, setNewLearningGoal] = useState('');
    const [expandedSeries, setExpandedSeries] = useState<string | null>(null);

    const fetchSeries = useCallback(async () => {
        const result = await seriesApi.getSeries();
        if (result.ok && Array.isArray(result.series)) {
            setSeriesList(result.series);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useEffect(() => {
        fetchSeries();
        const interval = setInterval(fetchSeries, 30000);
        return () => clearInterval(interval);
    }, [fetchSeries]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchSeries();
    };

    const handleCreateSeries = async () => {
        if (!newTitle.trim() || !newLearningGoal.trim()) {
            Alert.alert('Error', 'Please enter both a title and learning goal.');
            return;
        }
        
        const result = await seriesApi.createSeries(newTitle, newLearningGoal);
        if (result.ok) {
            setCreateModalVisible(false);
            setNewTitle('');
            setNewLearningGoal('');
            fetchSeries();
        } else {
            Alert.alert('Error', result.error || 'Failed to create series');
        }
    };

    const handleUpdateStatus = async (id: string, status: 'active' | 'paused') => {
        const result = await seriesApi.updateSeriesStatus(id, status);
        if (result.ok) {
            fetchSeries();
        } else {
            Alert.alert('Error', result.error || 'Failed to update status');
        }
    };

    const handleDeleteSeries = (id: string) => {
        Alert.alert(
            "Delete Series",
            "Are you sure you want to delete this series? This cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        const result = await seriesApi.deleteSeries(id);
                        if (result.ok) {
                            fetchSeries();
                        } else {
                            Alert.alert('Error', result.error || 'Failed to delete series');
                        }
                    }
                }
            ]
        );
    };

    const toggleExpand = (id: string) => {
        setExpandedSeries(expandedSeries === id ? null : id);
    };

    const renderSeriesCard = ({ item }: { item: SeriesState }) => {
        const isActive = item.status === 'active';
        const isExpanded = expandedSeries === item.id;
        
        return (
            <View style={[styles.cardShadowContainer, isExpanded && styles.cardExpandedShadow]}>
                <LinearGradient
                    colors={isExpanded 
                        ? ['rgba(139, 92, 246, 0.08)', 'rgba(0,0,0,0.4)'] 
                        : ['rgba(255,255,255,0.03)', 'rgba(255,255,255,0.01)']}
                    style={styles.cardGradient}
                >
                    <TouchableOpacity onPress={() => toggleExpand(item.id)} activeOpacity={0.8}>
                        <View style={styles.cardMain}>
                            <View style={styles.titleRow}>
                                <View style={[styles.statusIndicator, isActive ? styles.statusActive : styles.statusPaused]} />
                                <Text style={styles.seriesTitle} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
                            </View>
                            
                            <View style={styles.statsRow}>
                                <View style={styles.statBadge}>
                                    <Ionicons name="list" size={12} color={colors.primary} />
                                    <Text style={styles.statText}>{item.learningQueue?.length || 0} Queued</Text>
                                </View>
                                <View style={[styles.statBadge, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
                                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                    <Text style={[styles.statText, { color: '#10B981' }]}>{item.uploadCount || 0} Uploaded</Text>
                                </View>
                            </View>
                        </View>

                        {isExpanded && (
                            <View style={styles.expandedContent}>
                                <View style={styles.goalSection}>
                                    <View style={styles.sectionHeader}>
                                        <Ionicons name="school" size={16} color={colors.primary} />
                                        <Text style={styles.sectionTitle}>Learning Goal</Text>
                                    </View>
                                    <Text style={styles.learningGoal}>
                                        {item.learningGoal}
                                    </Text>
                                </View>

                                {item.learningQueue && item.learningQueue.length > 0 && (
                                    <View style={styles.queueContainer}>
                                        <View style={styles.sectionHeader}>
                                            <Ionicons name="calendar" size={16} color={colors.primary} />
                                            <Text style={styles.sectionTitle}>Upcoming Episodes</Text>
                                        </View>
                                        <View style={styles.timeline}>
                                            {item.learningQueue.slice(0, 3).map((ep, idx) => (
                                                <View key={ep.episodeId || idx} style={styles.timelineItem}>
                                                    <View style={styles.timelineDot} />
                                                    <Text style={styles.queueTopic} numberOfLines={2}>
                                                        <Text style={styles.episodeNumber}>Ep {idx + 1}: </Text>
                                                        {ep.topic}
                                                    </Text>
                                                </View>
                                            ))}
                                            {item.learningQueue.length > 3 && (
                                                <View style={styles.timelineItem}>
                                                    <View style={[styles.timelineDot, styles.timelineDotMuted]} />
                                                    <Text style={styles.moreText}>+ {item.learningQueue.length - 3} more episodes planned</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                <View style={styles.actionRow}>
                                    {isActive ? (
                                        <TouchableOpacity style={[styles.actionButton, styles.pauseButton]} onPress={() => handleUpdateStatus(item.id, 'paused')}>
                                            <Ionicons name="pause" size={16} color="#F59E0B" />
                                            <Text style={[styles.actionText, { color: '#F59E0B' }]}>Pause Series</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity style={[styles.actionButton, styles.resumeButton]} onPress={() => handleUpdateStatus(item.id, 'active')}>
                                            <Ionicons name="play" size={16} color="#10B981" />
                                            <Text style={[styles.actionText, { color: '#10B981' }]}>Resume Series</Text>
                                        </TouchableOpacity>
                                    )}
                                    
                                    <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDeleteSeries(item.id)}>
                                        <Ionicons name="trash" size={20} color="#F43F5E" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Series Management</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setCreateModalVisible(true)}>
                    <Ionicons name="add" size={20} color={colors.foreground} />
                    <Text style={styles.addButtonText}>New Series</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={seriesList}
                keyExtractor={(item) => item.id}
                renderItem={renderSeriesCard}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="layers-outline" size={48} color={colors.foregroundMuted} />
                            <Text style={styles.emptyStateText}>No series created yet.</Text>
                        </View>
                    ) : null
                }
            />

            <Modal visible={isCreateModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <LinearGradient colors={gradients.subtle} style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Create New Series</Text>
                            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                                <Ionicons name="close" size={24} color={colors.foregroundMuted} />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Series Title</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Master TypeScript in 30 Days"
                            placeholderTextColor={colors.foregroundMuted}
                            value={newTitle}
                            onChangeText={setNewTitle}
                        />

                        <Text style={styles.inputLabel}>Learning Goal</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="What should the viewer learn by the end of this series?"
                            placeholderTextColor={colors.foregroundMuted}
                            value={newLearningGoal}
                            onChangeText={setNewLearningGoal}
                            multiline
                            numberOfLines={4}
                        />

                        <TouchableOpacity style={styles.submitButton} onPress={handleCreateSeries}>
                            <LinearGradient colors={gradients.primary} style={styles.submitGradient}>
                                <Text style={styles.submitText}>Create Series</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>
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
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.4)',
        gap: 4,
    },
    addButtonText: {
        color: colors.foreground,
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
    },
    listContent: {
        padding: spacing.md,
        gap: spacing.md,
        paddingBottom: spacing.xl * 2,
    },
    cardShadowContainer: {
        borderRadius: borderRadius.lg,
        backgroundColor: colors.card,
        ...shadows.md,
    },
    cardExpandedShadow: {
        shadowColor: 'rgba(139, 92, 246, 0.3)',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 12,
    },
    cardGradient: {
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        padding: spacing.md,
        overflow: 'hidden',
    },
    cardMain: {
        gap: spacing.sm,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    statusIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 2,
    },
    statusActive: {
        backgroundColor: '#10B981', // Emerald
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 6,
    },
    statusPaused: {
        backgroundColor: '#F59E0B', // Amber
        opacity: 0.8,
    },
    seriesTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        flexShrink: 1,
        letterSpacing: 0.3,
    },
    statsRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginLeft: 18, // Align with text past indicator
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: 99,
        gap: 4,
    },
    statText: {
        fontSize: typography.fontSizeXs,
        color: colors.primary,
        fontWeight: typography.fontWeightSemibold,
    },
    expandedContent: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        gap: spacing.lg,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: spacing.xs,
    },
    sectionTitle: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    goalSection: {
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    learningGoal: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        lineHeight: 22,
    },
    queueContainer: {
        paddingHorizontal: 4,
    },
    timeline: {
        marginTop: spacing.sm,
        paddingLeft: 6,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(255,255,255,0.1)',
        gap: spacing.sm,
        marginLeft: spacing.xs,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: spacing.sm,
        position: 'relative',
    },
    timelineDot: {
        position: 'absolute',
        left: -11, // centers on the border
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
    timelineDotMuted: {
        backgroundColor: colors.foregroundMuted,
    },
    episodeNumber: {
        color: colors.primary,
        fontWeight: typography.fontWeightBold,
    },
    queueTopic: {
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        lineHeight: 18,
    },
    moreText: {
        fontSize: typography.fontSizeXs,
        color: colors.foregroundMuted,
        fontStyle: 'italic',
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.xs,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 10,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        gap: 8,
        justifyContent: 'center',
    },
    pauseButton: {
        flex: 1,
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    resumeButton: {
        flex: 1,
        backgroundColor: 'rgba(16, 185, 129, 0.05)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    deleteButton: {
        width: 44, // Make it a square icon button so it doesn't take up too much space
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
        borderColor: 'rgba(244, 63, 94, 0.2)',
    },
    actionText: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightBold,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing.xl * 2,
    },
    emptyStateText: {
        color: colors.foregroundMuted,
        marginTop: spacing.md,
        fontSize: typography.fontSizeMd,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: spacing.md,
    },
    modalContent: {
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
    },
    inputLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foregroundMuted,
        marginBottom: spacing.xs,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        color: colors.foreground,
        padding: spacing.md,
        marginBottom: spacing.md,
        fontSize: typography.fontSizeMd,
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
    },
    submitButton: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        marginTop: spacing.sm,
    },
    submitGradient: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    submitText: {
        color: colors.primaryForeground,
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightBold,
    }
});
