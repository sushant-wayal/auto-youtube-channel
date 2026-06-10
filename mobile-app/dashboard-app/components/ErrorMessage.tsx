import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography, shadows } from '../theme';

type ErrorMessageProps = {
    message: string;
};

export default function ErrorMessage({ message }: ErrorMessageProps) {
    return (
        <View style={styles.container}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} style={styles.icon} />
            <Text style={styles.text}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E0C12',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#5C1B24',
    },
    icon: {
        marginRight: spacing.sm,
    },
    text: {
        color: colors.destructive,
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        flex: 1,
    },
});
