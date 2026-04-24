import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../theme';

type EmptyStateProps = {
    title: string;
    subtitle?: string;
};

export default function EmptyState({ title, subtitle }: EmptyStateProps) {
    return (
        <View style={styles.container}>
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
        borderColor: colors.border,
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
    },
    title: {
        fontSize: typography.fontSizeMd,
        color: colors.foreground,
        marginBottom: spacing.xs,
        fontWeight: typography.fontWeightSemibold,
    },
    subtitle: {
        fontSize: typography.fontSizeSm,
        color: colors.foregroundMuted,
        textAlign: 'center',
    },
});
