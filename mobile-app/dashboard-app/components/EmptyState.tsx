import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography, shadows } from '../theme';

type EmptyStateProps = {
    title: string;
    subtitle?: string;
    icon?: React.ComponentProps<typeof Ionicons>['name'];
};

export default function EmptyState({ title, subtitle, icon = 'folder-open-outline' }: EmptyStateProps) {
    return (
        <View style={styles.container}>
            <View style={styles.iconContainer}>
                <Ionicons name={icon} size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>{title}</Text>
            {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: spacing.xxxl,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: 'rgba(13, 21, 39, 0.5)',
        borderRadius: borderRadius.lg,
        ...shadows.md,
    },
    iconContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    title: {
        fontSize: typography.fontSizeMd + 1,
        color: colors.foreground,
        marginBottom: spacing.xs,
        fontWeight: typography.fontWeightBold,
        letterSpacing: 0.3,
    },
    subtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        textAlign: 'center',
        lineHeight: 18,
    },
});
