import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { borderRadius, colors, spacing, typography } from '../theme';

type ErrorMessageProps = {
    message: string;
};

export default function ErrorMessage({ message }: ErrorMessageProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#2A1117',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#7F1D1D',
    },
    text: {
        color: '#FCA5A5',
        fontSize: typography.fontSizeSm,
    },
});
