import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ideasApi, IdeasQueue } from '../services/api';
import ErrorMessage from '../components/ErrorMessage';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export default function IdeasScreen() {
    const [ideasQueue, setIdeasQueue] = useState<IdeasQueue | null>(null);
    const [newIdea, setNewIdea] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');
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

    const handleEditIdea = async (index: number) => {
        if (!editingText.trim()) return;

        setLoading(true);
        setError(null);
        try {
            const response = await ideasApi.editIdea(index, editingText.trim());
            if (response.ok) {
                setIdeasQueue({ ideas: response.ideas, count: response.count });
                setEditingIndex(null);
                setEditingText('');
            } else {
                setError(response.error || 'Failed to edit idea');
            }
        } catch (err) {
            setError(String(err));
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
                setIdeasQueue({ ideas: response.ideas, count: response.count });
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

    const startEditing = (index: number, text: string) => {
        setEditingIndex(index);
        setEditingText(text);
        setExpandedIndex(null);
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditingText('');
    };

    const toggleExpanded = (index: number) => {
        if (editingIndex !== null) return;
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const renderIdeaItem = ({ item, index }: { item: string; index: number }) => {
        const isEditing = editingIndex === index;
        const isExpanded = expandedIndex === index;
        const isFirst = index === 0;
        const isLast = ideasQueue && index === ideasQueue.ideas.length - 1;

        return (
            <TouchableOpacity
                style={styles.ideaCard}
                onPress={() => !isEditing && toggleExpanded(index)}
                activeOpacity={0.7}
                disabled={isEditing}
            >
                <View style={styles.ideaHeader}>
                    <View style={styles.ideaHeaderLeft}>
                        <View style={styles.indexBadge}>
                            <Text style={styles.indexText}>{index + 1}</Text>
                        </View>
                        {isEditing ? (
                            <TextInput
                                style={styles.editInputInline}
                                value={editingText}
                                onChangeText={setEditingText}
                                multiline
                                autoFocus
                                placeholderTextColor={colors.mutedForeground}
                            />
                        ) : (
                            <Text style={styles.ideaTextMinimal} numberOfLines={isExpanded ? undefined : 2}>
                                {item}
                            </Text>
                        )}
                    </View>
                </View>

                {isEditing && (
                    <View style={styles.editActionsMinimal}>
                        <TouchableOpacity
                            style={[styles.actionButtonMinimal, styles.saveButtonMinimal]}
                            onPress={() => handleEditIdea(index)}
                            disabled={!editingText.trim() || loading}
                        >
                            <Ionicons name="checkmark" size={18} color={colors.primaryForeground} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButtonMinimal, styles.cancelButtonMinimal]}
                            onPress={cancelEditing}
                            disabled={loading}
                        >
                            <Ionicons name="close" size={18} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>
                )}

                {isExpanded && !isEditing && (
                    <View style={styles.expandedActions}>
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={styles.compactButton}
                                onPress={() => startEditing(index, item)}
                                disabled={loading}
                            >
                                <Ionicons name="create-outline" size={18} color={colors.foreground} />
                                <Text style={styles.compactButtonText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.compactButton}
                                onPress={() => handleDeleteIdea(index)}
                                disabled={loading}
                            >
                                <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                                <Text style={[styles.compactButtonText, { color: colors.destructive }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.actionRow}>
                            <TouchableOpacity
                                style={[styles.compactButton, isFirst && styles.compactButtonDisabled]}
                                onPress={() => handleMoveIdea(index, 'up')}
                                disabled={isFirst || loading}
                            >
                                <Ionicons name="chevron-up" size={18} color={isFirst ? colors.mutedForeground : colors.foreground} />
                                <Text style={[styles.compactButtonText, isFirst && { color: colors.mutedForeground }]}>Move Up</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.compactButton, isLast && styles.compactButtonDisabled]}
                                onPress={() => handleMoveIdea(index, 'down')}
                                disabled={isLast || loading}
                            >
                                <Ionicons name="chevron-down" size={18} color={isLast ? colors.mutedForeground : colors.foreground} />
                                <Text style={[styles.compactButtonText, isLast && { color: colors.mutedForeground }]}>Move Down</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
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
                <Text style={styles.sectionLabel}>Add New Idea</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter a video idea..."
                    placeholderTextColor={colors.mutedForeground}
                    value={newIdea}
                    onChangeText={setNewIdea}
                    multiline
                    editable={!loading}
                />
                <View style={styles.addButtonRow}>
                    <TouchableOpacity
                        style={[styles.primaryButton, !newIdea.trim() && styles.buttonDisabled]}
                        onPress={handleAddIdea}
                        disabled={!newIdea.trim() || loading}
                    >
                        <Ionicons name="add-circle-outline" size={20} color={colors.primaryForeground} />
                        <Text style={styles.primaryButtonText}>Add Idea</Text>
                    </TouchableOpacity>
                    {ideasQueue && ideasQueue.ideas.length > 0 && (
                        <TouchableOpacity
                            style={styles.outlineButton}
                            onPress={handleClearAll}
                            disabled={loading}
                        >
                            <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                            <Text style={styles.outlineButtonText}>Clear All</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {ideasQueue && ideasQueue.ideas.length > 0 ? (
                <>
                    <View style={styles.countBadge}>
                        <Ionicons name="list" size={16} color={colors.mutedForeground} />
                        <Text style={styles.countText}>
                            {ideasQueue.count} {ideasQueue.count === 1 ? 'idea' : 'ideas'}
                        </Text>
                    </View>
                    <FlatList
                        data={ideasQueue.ideas}
                        renderItem={renderIdeaItem}
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
                </>
            ) : (
                <EmptyState
                    title="No ideas yet"
                    subtitle="Add your first video idea above to get started"
                />
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
    sectionLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
        color: colors.foreground,
        marginBottom: spacing.sm,
        letterSpacing: 0.5,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        fontSize: typography.fontSizeMd,
        minHeight: 80,
        backgroundColor: colors.background,
        color: colors.foreground,
        textAlignVertical: 'top',
    },
    addButtonRow: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.md,
    },
    primaryButton: {
        flex: 1,
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
    outlineButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.background,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.destructive,
    },
    outlineButtonText: {
        color: colors.destructive,
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightMedium,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    countBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    countText: {
        fontSize: typography.fontSizeSm,
        color: colors.mutedForeground,
        fontWeight: typography.fontWeightMedium,
    },
    list: {
        flex: 1,
    },
    listContent: {
        padding: spacing.lg,
        gap: spacing.md,
    },
    ideaCard: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        marginBottom: spacing.sm,
    },
    ideaHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    ideaHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        flex: 1,
    },
    indexBadge: {
        backgroundColor: colors.muted,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
        minWidth: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    indexText: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightSemibold,
        color: colors.mutedForeground,
    },
    ideaTextMinimal: {
        fontSize: typography.fontSizeSm,
        lineHeight: 20,
        color: colors.foreground,
        flex: 1,
    },
    editInputInline: {
        flex: 1,
        fontSize: typography.fontSizeSm,
        color: colors.foreground,
        padding: 0,
        minHeight: 60,
        textAlignVertical: 'top',
    },
    editActionsMinimal: {
        flexDirection: 'row',
        gap: spacing.xs,
        marginTop: spacing.sm,
        justifyContent: 'flex-end',
    },
    actionButtonMinimal: {
        width: 36,
        height: 36,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    saveButtonMinimal: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    cancelButtonMinimal: {
        backgroundColor: colors.background,
        borderColor: colors.border,
    },
    expandedActions: {
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
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
        backgroundColor: colors.background,
    },
    compactButtonDisabled: {
        opacity: 0.4,
    },
    compactButtonText: {
        fontSize: typography.fontSizeXs,
        fontWeight: typography.fontWeightMedium,
        color: colors.foreground,
    },
});
