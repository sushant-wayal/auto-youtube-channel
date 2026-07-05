import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, borderRadius } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Shimmer Bone ─────────────────────────────────────────────────────────────
function ShimmerBone({
    width = '100%' as number | `${number}%`,
    height = 14,
    borderRadius: br = 8,
    style,
}: {
    width?: number | `${number}%`;
    height?: number;
    borderRadius?: number;
    style?: object;
}) {
    const shimmer = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(shimmer, {
                toValue: 1,
                duration: 1400,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const translateX = shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
    });

    return (
        <View
            style={[
                {
                    width,
                    height,
                    borderRadius: br,
                    backgroundColor: '#131E35',
                    overflow: 'hidden',
                },
                style,
            ]}
        >
            <Animated.View
                style={[
                    StyleSheet.absoluteFillObject,
                    { transform: [{ translateX }] },
                ]}
            >
                <LinearGradient
                    colors={[
                        'transparent',
                        'rgba(139, 92, 246, 0.12)',
                        'rgba(99, 102, 241, 0.18)',
                        'rgba(139, 92, 246, 0.12)',
                        'transparent',
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFillObject}
                />
            </Animated.View>
        </View>
    );
}

// ─── Pipeline Screen Skeleton ─────────────────────────────────────────────────
function PipelineSkeleton() {
    return (
        <View style={skStyles.container}>
            {/* Overall status card */}
            <View style={skStyles.card}>
                <View style={skStyles.row}>
                    <ShimmerBone width={44} height={44} borderRadius={22} />
                    <View style={{ flex: 1, gap: 8 }}>
                        <ShimmerBone width="60%" height={16} />
                        <ShimmerBone width="80%" height={12} />
                        <ShimmerBone width="40%" height={10} />
                    </View>
                </View>
            </View>

            {/* Timeline card */}
            <View style={skStyles.card}>
                <ShimmerBone width="50%" height={10} style={{ marginBottom: 20 }} />
                {[...Array(6)].map((_, i) => (
                    <View key={i} style={skStyles.timelineRow}>
                        <ShimmerBone width={18} height={18} borderRadius={9} />
                        <View style={[skStyles.timelineContent, { opacity: 1 - i * 0.1 }]}>
                            <ShimmerBone width={`${75 - i * 5}%` as `${number}%`} height={13} />
                            <ShimmerBone width={48} height={18} borderRadius={9} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── Ideas Screen Skeleton ────────────────────────────────────────────────────
function IdeasSkeleton() {
    return (
        <View style={skStyles.container}>
            {/* Input area */}
            <View style={skStyles.card}>
                <ShimmerBone width="30%" height={10} style={{ marginBottom: 10 }} />
                <ShimmerBone width="100%" height={52} borderRadius={12} />
                <View style={[skStyles.row, { marginTop: 12, justifyContent: 'flex-end' }]}>
                    <ShimmerBone width={100} height={36} borderRadius={18} />
                </View>
            </View>

            {/* Ideas list */}
            {[...Array(5)].map((_, i) => (
                <View key={i} style={[skStyles.card, { gap: 10 }]}>
                    <View style={skStyles.row}>
                        <ShimmerBone width={28} height={28} borderRadius={14} />
                        <View style={{ flex: 1, gap: 6 }}>
                            <ShimmerBone width={`${90 - i * 8}%` as `${number}%`} height={13} />
                            <ShimmerBone width={`${65 - i * 5}%` as `${number}%`} height={11} />
                        </View>
                        <ShimmerBone width={24} height={24} borderRadius={12} />
                    </View>
                </View>
            ))}
        </View>
    );
}

// ─── Schedule Times Screen Skeleton ──────────────────────────────────────────
function ScheduleSkeleton() {
    return (
        <View style={skStyles.container}>
            {/* Card header */}
            <View style={skStyles.card}>
                <View style={skStyles.row}>
                    <ShimmerBone width={36} height={36} borderRadius={18} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <ShimmerBone width="50%" height={15} />
                        <ShimmerBone width="70%" height={11} />
                    </View>
                </View>

                {/* Timeline rows */}
                <View style={{ marginTop: 16, gap: 10 }}>
                    {[...Array(4)].map((_, i) => (
                        <View key={i} style={[skStyles.row, { paddingVertical: 8 }]}>
                            <ShimmerBone width={28} height={28} borderRadius={14} />
                            <View style={{ flex: 1, gap: 4 }}>
                                <ShimmerBone width="35%" height={12} />
                                <ShimmerBone width="25%" height={10} />
                            </View>
                            <ShimmerBone width={64} height={28} borderRadius={14} />
                        </View>
                    ))}
                </View>
            </View>

            {/* Second card */}
            <View style={skStyles.card}>
                <View style={skStyles.row}>
                    <ShimmerBone width={36} height={36} borderRadius={18} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <ShimmerBone width="40%" height={15} />
                        <ShimmerBone width="60%" height={11} />
                    </View>
                </View>
                <View style={{ marginTop: 14 }}>
                    <ShimmerBone width="100%" height={52} borderRadius={14} />
                </View>
            </View>

            {/* Save button skeleton */}
            <ShimmerBone width="100%" height={48} borderRadius={16} />
        </View>
    );
}

// ─── Shorts Schedule Screen Skeleton ─────────────────────────────────────────
function ShortsSkeleton() {
    return (
        <View style={skStyles.container}>
            <View style={skStyles.card}>
                <View style={skStyles.row}>
                    <ShimmerBone width={28} height={28} borderRadius={14} />
                    <View style={{ flex: 1, gap: 6 }}>
                        <ShimmerBone width="45%" height={15} />
                        <ShimmerBone width="65%" height={11} />
                    </View>
                </View>

                {/* Big time display */}
                <View style={{ alignItems: 'center', marginVertical: 24, gap: 10 }}>
                    <ShimmerBone width={36} height={36} borderRadius={18} />
                    <ShimmerBone width={120} height={48} borderRadius={14} />
                    <ShimmerBone width={80} height={11} />
                </View>
            </View>

            {/* Action buttons */}
            <View style={[skStyles.row, { gap: 10 }]}>
                <View style={{ flex: 1 }}>
                    <ShimmerBone height={42} borderRadius={14} />
                </View>
                <View style={{ flex: 1 }}>
                    <ShimmerBone height={42} borderRadius={14} />
                </View>
            </View>
        </View>
    );
}

// ─── Generic Fallback Skeleton ────────────────────────────────────────────────
function GenericSkeleton() {
    return (
        <View style={skStyles.container}>
            {[...Array(3)].map((_, i) => (
                <View key={i} style={skStyles.card}>
                    <ShimmerBone width="60%" height={16} style={{ marginBottom: 12 }} />
                    <ShimmerBone width="100%" height={12} style={{ marginBottom: 8 }} />
                    <ShimmerBone width="85%" height={12} style={{ marginBottom: 8 }} />
                    <ShimmerBone width="70%" height={12} />
                </View>
            ))}
        </View>
    );
}

// ─── Public API ───────────────────────────────────────────────────────────────
export type SkeletonVariant = 'pipeline' | 'ideas' | 'schedule' | 'shorts' | 'generic';

type SkeletonLoaderProps = {
    variant?: SkeletonVariant;
};

export default function SkeletonLoader({ variant = 'generic' }: SkeletonLoaderProps) {
    const map: Record<SkeletonVariant, React.ReactNode> = {
        pipeline: <PipelineSkeleton />,
        ideas: <IdeasSkeleton />,
        schedule: <ScheduleSkeleton />,
        shorts: <ShortsSkeleton />,
        generic: <GenericSkeleton />,
    };
    return <>{map[variant]}</>;
}

// ─── Skeleton styles ──────────────────────────────────────────────────────────
const skStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.backgroundSecondary,
        padding: spacing.lg,
        gap: spacing.md,
    },
    card: {
        backgroundColor: colors.card,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        gap: spacing.sm,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    timelineContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.sm,
    },
});
