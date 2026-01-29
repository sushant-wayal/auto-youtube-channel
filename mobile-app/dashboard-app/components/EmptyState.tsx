import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
        padding: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        color: '#666',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: '#999',
    },
});
