import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Alert,
    RefreshControl,
    KeyboardAvoidingView,
    Platform,
    LayoutAnimation,
    Animated,
    UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ideasApi, IdeasQueue } from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, spacing, borderRadius, typography, shadows, gradients, motion } from '../theme';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnim = () => {
    LayoutAnimation.configureNext({
        duration: 250,
        create: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
        update: {
            type: LayoutAnimation.Types.spring,
            springDamping: 0.75,
        },
        delete: {
            type: LayoutAnimation.Types.easeInEaseOut,
            property: LayoutAnimation.Properties.opacity,
        },
    });
};

type IdeaCardItemProps = {
    item: string;
    index: number;
    ideasCount: number;
    isExpanded: boolean;
    loading: boolean;
    toggleExpanded: (index: number) => void;
    handleEditIdea: (index: number, text: string) => Promise<boolean>;
    handleDeleteIdea: (index: number) => void;
    handleMoveIdea: (index: number, direction: 'up' | 'down') => void;
};

function IdeaCardItem({
    item,
    index,
    ideasCount,
    isExpanded,
    loading,
    toggleExpanded,
    handleEditIdea,
    handleDeleteIdea,
    handleMoveIdea,
}: IdeaCardItemProps) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(18)).current;

    const [isEditing, setIsEditing] = useState(false);
    const [editingText, setEditingText] = useState(item);

    useEffect(() => {
        setEditingText(item);
    }, [item]);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 180,
                friction: 12,
            }),
        ]).start();
    }, []);

    const handlePressIn = () => {
        if (isEditing) return;
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
        }).start();
    };

    const handlePressOut = () => {
        if (isEditing) return;
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 10,
        }).start();
    };

    const startEditing = () => {
        setEditingText(item);
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setEditingText(item);
        setIsEditing(false);
    };

    const saveEditing = async () => {
        if (!editingText.trim() || loading) return;
        const success = await handleEditIdea(index, editingText.trim());
        if (success) {
            setIsEditing(false);
        }
    };

    const isFirst = index === 0;
    const isLast = index === ideasCount - 1;

    return (
        <Animated.View
            style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            }}
        >
            <TouchableOpacity
                onPress={() => !isEditing && toggleExpanded(index)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                disabled={isEditing}
            >
                <LinearGradient
                    colors={isExpanded ? ['#0D1527', '#1F153F'] : gradients.card}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.ideaCard,
                        isExpanded && styles.ideaCardExpanded,
                        isEditing && styles.ideaCardEditing,
                    ]}
                >
                    <View style={styles.ideaHeader}>
                        <View style={styles.ideaHeaderLeft}>
                            <LinearGradient
                                colors={isExpanded ? gradients.primary : ['#1E293B', '#111827']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.indexBadge}
                            >
                                <Text style={[styles.indexText, isExpanded && styles.indexTextActive]}>
                                    {index + 1}
                                </Text>
                            </LinearGradient>
                            {isEditing ? (
                                <TextInput
                                    style={styles.editInputInline}
                                    value={editingText}
                                    onChangeText={setEditingText}
                                    multiline
                                    autoFocus
                                    placeholder="Edit idea..."
                                    placeholderTextColor={colors.mutedForeground}
                                />
                            ) : (
                                <Text style={[styles.ideaTextMinimal, isExpanded && styles.ideaTextExpanded]} numberOfLines={isExpanded ? undefined : 2}>
                                    {item}
                                </Text>
                            )}
                        </View>
                    </View>

                    {isEditing && (
                        <View style={styles.editActionsMinimal}>
                            <TouchableOpacity
                                style={[styles.actionButtonMinimal, styles.saveButtonMinimal]}
                                onPress={saveEditing}
                                disabled={!editingText.trim() || loading}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionButtonMinimal, styles.cancelButtonMinimal]}
                                onPress={cancelEditing}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="close" size={16} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {isExpanded && !isEditing && (
                        <View style={styles.expandedActions}>
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={styles.compactButton}
                                    onPress={startEditing}
                                    disabled={loading}
                                >
                                    <Ionicons name="create-outline" size={16} color={colors.foreground} />
                                    <Text style={styles.compactButtonText}>Edit</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.compactButton, styles.deleteButton]}
                                    onPress={() => handleDeleteIdea(index)}
                                    disabled={loading}
                                >
                                    <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                                    <Text style={[styles.compactButtonText, { color: colors.destructive }]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.actionRow}>
                                <TouchableOpacity
                                    style={[styles.compactButton, isFirst && styles.compactButtonDisabled]}
                                    onPress={() => handleMoveIdea(index, 'up')}
                                    disabled={isFirst || loading}
                                >
                                    <Ionicons name="arrow-up" size={16} color={isFirst ? colors.mutedForeground : colors.foreground} />
                                    <Text style={[styles.compactButtonText, isFirst && { color: colors.mutedForeground }]}>Move Up</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.compactButton, isLast && styles.compactButtonDisabled]}
                                    onPress={() => handleMoveIdea(index, 'down')}
                                    disabled={isLast || loading}
                                >
                                    <Ionicons name="arrow-down" size={16} color={isLast ? colors.mutedForeground : colors.foreground} />
                                    <Text style={[styles.compactButtonText, isLast && { color: colors.mutedForeground }]}>Move Down</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        </Animated.View>
    );
}

export default function IdeasScreen() {
    const [ideasQueue, setIdeasQueue] = useState<IdeasQueue | null>(null);
    const [newIdea, setNewIdea] = useState('');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadIdeas();
    }, []);

    const loadIdeas = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await ideasApi.getIdeas();
            if (response.ok) {
                triggerLayoutAnim();
                setIdeasQueue({ ideas: response.ideas, count: response.count });
            } else {
                setError(response.error || 'Failed to load ideas');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadIdeas();
        setRefreshing(false);
    };

    const handleAddIdea = async () => {
        if (!newIdea.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const response = await ideasApi.addIdea(newIdea.trim());
            if (response.ok) {
                triggerLayoutAnim();
                setIdeasQueue({ ideas: response.ideas, count: response.count });
                setNewIdea('');
            } else {
                setError(response.error || 'Failed to add idea');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleEditIdea = async (index: number, text: string): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const response = await ideasApi.editIdea(index, text);
            if (response.ok) {
                triggerLayoutAnim();
                setIdeasQueue({ ideas: response.ideas, count: response.count });
                return true;
            } else {
                setError(response.error || 'Failed to edit idea');
                return false;
            }
        } catch (err) {
            setError(String(err));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteIdea = async (index: number) => {
        Alert.alert(
            'Delete Idea',
            'Are you sure you want to delete this idea?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        setError(null);
                        try {
                            const response = await ideasApi.removeIdea(index);
                            if (response.ok) {
                                triggerLayoutAnim();
                                setIdeasQueue({ ideas: response.ideas, count: response.count });
                            } else {
                                setError(response.error || 'Failed to delete idea');
                            }
                        } catch (err) {
                            setError(String(err));
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleMoveIdea = async (index: number, direction: 'up' | 'down') => {
        if (!ideasQueue) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= ideasQueue.ideas.length) return;

        setLoading(true);
        setError(null);
        try {
            const response = await ideasApi.moveIdea(index, newIndex);
            if (response.ok) {
                triggerLayoutAnim();
                setIdeasQueue({ ideas: response.ideas, count: response.count });
                // Automatically follow the expansion of the moved item
                setExpandedIndex(newIndex);
            } else {
                setError(response.error || 'Failed to move idea');
            }
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    const handleClearAll = () => {
        Alert.alert(
            'Clear All Ideas',
            'Are you sure you want to clear all ideas from the queue?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        setError(null);
                        try {
                            const response = await ideasApi.clearIdeas();
                            if (response.ok) {
                                triggerLayoutAnim();
                                setIdeasQueue({ ideas: response.ideas, count: response.count });
                            } else {
                                setError(response.error || 'Failed to clear ideas');
                            }
                        } catch (err) {
                            setError(String(err));
                        } finally {
                            setLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const toggleExpanded = (index: number) => {
        triggerLayoutAnim();
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    if (loading && !ideasQueue) {
        return <LoadingSpinner />;
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {error && <ErrorMessage message={error} />}

            <View style={styles.addSection}>
                <View style={styles.inputWrapper}>
                    <Text style={styles.sectionLabel}>ADD NEW IDEA</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter a captivating video idea..."
                        placeholderTextColor={colors.mutedForeground}
                        value={newIdea}
                        onChangeText={setNewIdea}
                        multiline
                        editable={!loading}
                    />
                </View>

                <View style={styles.addButtonRow}>
                    <TouchableOpacity
                        style={[styles.primaryButton, !newIdea.trim() && styles.buttonDisabled]}
                        onPress={handleAddIdea}
                        disabled={!newIdea.trim() || loading}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={!newIdea.trim() ? ['#3B3F4A', '#2E323D'] : gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.gradientBtn}
                        >
                            <Ionicons name="add" size={18} color={colors.primaryForeground} />
                            <Text style={styles.primaryButtonText}>Add Idea</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {ideasQueue && ideasQueue.ideas.length > 0 && (
                        <TouchableOpacity
                            style={styles.outlineButton}
                            onPress={handleClearAll}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                            <Text style={styles.outlineButtonText}>Clear Queue</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {ideasQueue && ideasQueue.ideas.length > 0 ? (
                <View style={styles.listContainer}>
                    <View style={styles.countBadge}>
                        <LinearGradient
                            colors={['rgba(6, 182, 212, 0.1)', 'rgba(99, 102, 241, 0.1)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.countGradient}
                        >
                            <Ionicons name="list" size={13} color={colors.gradientTo} />
                            <Text style={styles.countText}>
                                {ideasQueue.count} {ideasQueue.count === 1 ? 'idea queued' : 'ideas queued'}
                            </Text>
                        </LinearGradient>
                    </View>
                    <FlatList
                        data={ideasQueue.ideas}
                        renderItem={({ item, index }) => (
                            <IdeaCardItem
                                item={item}
                                index={index}
                                ideasCount={ideasQueue.ideas.length}
                                isExpanded={expandedIndex === index}
                                loading={loading}
                                toggleExpanded={toggleExpanded}
                                handleEditIdea={handleEditIdea}
                                handleDeleteIdea={handleDeleteIdea}
                                handleMoveIdea={handleMoveIdea}
                            />
                        )}
                        keyExtractor={(_, index) => index.toString()}
                        style={styles.list}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                tintColor={colors.primary}
                            />
                        }
                    />
                </View>
            ) : (
                <View style={styles.emptyContainer}>
                    <EmptyState
                        title="No Ideas Queued"
                        subtitle="Add a YouTube short or video concept above to populate the queue."
                    />
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
    },
    addSection: {
        backgroundColor: colors.background,
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    inputWrapper: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        backgroundColor: '#070C1B',
    },
    inputWrapperFocused: {
        borderColor: colors.primary,
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
        marginBottom: spacing.xs,
        letterSpacing: 1.5,
    },
    input: {
        fontSize: typography.fontSizeMd,
        minHeight: 60,
        color: colors.foreground,
        textAlignVertical: 'top',
        paddingTop: spacing.xs,
    },
    addButtonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    primaryButton: {
        flex: 1,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        ...shadows.sm,
    },
    gradientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
    },
    primaryButtonText: {
        color: colors.primaryForeground,
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightSemibold,
    },
    outlineButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(244, 63, 94, 0.08)',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(244, 63, 94, 0.25)',
    },
    outlineButtonText: {
        color: colors.destructive,
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    listContainer: {
        flex: 1,
    },
    countBadge: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        alignItems: 'flex-start',
    },
    countGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.25)',
    },
    countText: {
        fontSize: typography.fontSizeXs,
        color: colors.foreground,
        fontWeight: typography.fontWeightMedium,
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.sm,
    },
    emptyContainer: {
        flex: 1,
        padding: spacing.lg,
        justifyContent: 'center',
    },
    ideaCard: {
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: 2,
    },
    ideaCardExpanded: {
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    ideaCardEditing: {
        borderColor: colors.gradientMid,
    },
    ideaHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    ideaHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        flex: 1,
    },
    indexBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    indexText: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightBold,
        color: colors.foregroundMuted,
    },
    indexTextActive: {
        color: colors.primaryForeground,
    },
    ideaTextMinimal: {
        fontSize: typography.fontSizeSm + 1,
        lineHeight: 21,
        color: colors.foreground,
        flex: 1,
        paddingTop: 1,
    },
    ideaTextExpanded: {
        color: colors.foreground,
    },
    editInputInline: {
        flex: 1,
        fontSize: typography.fontSizeSm + 1,
        color: colors.foreground,
        padding: 0,
        minHeight: 50,
        textAlignVertical: 'top',
    },
    editActionsMinimal: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        justifyContent: 'flex-end',
    },
    actionButtonMinimal: {
        width: 32,
        height: 32,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    saveButtonMinimal: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        ...shadows.sm,
    },
    cancelButtonMinimal: {
        backgroundColor: colors.secondary,
        borderColor: colors.border,
    },
    expandedActions: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.06)',
        gap: spacing.sm,
    },
    actionRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    compactButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondary,
    },
    compactButtonDisabled: {
        opacity: 0.35,
    },
    deleteButton: {
        borderColor: 'rgba(244, 63, 94, 0.2)',
        backgroundColor: 'rgba(244, 63, 94, 0.05)',
    },
    compactButtonText: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightSemibold,
        color: colors.foreground,
    },
});
