import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

type LoadingSpinnerProps = {
    size?: 'small' | 'large';
};

export default function LoadingSpinner({ size = 'large' }: LoadingSpinnerProps) {
    return (
        <View style={styles.container}>
            <ActivityIndicator size={size} color="#007AFF" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
});
