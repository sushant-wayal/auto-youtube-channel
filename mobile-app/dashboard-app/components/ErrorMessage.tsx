import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

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
        backgroundColor: '#fee',
        padding: 12,
        borderRadius: 8,
        marginBottom: 12,
    },
    text: {
        color: '#c00',
        fontSize: 14,
    },
});
