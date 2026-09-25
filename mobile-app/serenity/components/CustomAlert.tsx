import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';

export type AlertButton = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

export type CustomAlertConfig = {
    visible: boolean;
    title: string;
    message: string;
    type?: 'default' | 'danger' | 'warning' | 'success';
    buttons?: AlertButton[];
};

type Props = {
    visible: boolean;
    title: string;
    message: string;
    type?: 'default' | 'danger' | 'warning' | 'success';
    buttons?: AlertButton[];
    onClose?: () => void;
};

export default function CustomAlert({
    visible,
    title,
    message,
    type = 'default',
    buttons = [{ text: 'OK', style: 'default' }],
    onClose,
}: Props) {
    const scaleAnim = React.useRef(new Animated.Value(0.92)).current;
    const opacityAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            scaleAnim.setValue(0.92);
            opacityAnim.setValue(0);
        }
    }, [visible, scaleAnim, opacityAnim]);

    if (!visible) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return { name: 'trash-outline' as const, color: colors.failed, bg: 'rgba(196, 119, 104, 0.12)', border: 'rgba(196, 119, 104, 0.3)' };
            case 'warning':
                return { name: 'alert-circle-outline' as const, color: colors.sandstone, bg: 'rgba(200, 178, 155, 0.12)', border: 'rgba(200, 178, 155, 0.3)' };
            case 'success':
                return { name: 'checkmark-circle-outline' as const, color: colors.sandstone, bg: 'rgba(200, 178, 155, 0.12)', border: 'rgba(200, 178, 155, 0.3)' };
            default:
                return { name: 'sparkles-outline' as const, color: colors.sandstone, bg: 'rgba(200, 178, 155, 0.12)', border: 'rgba(200, 178, 155, 0.3)' };
        }
    };

    const iconInfo = getIcon();

    const handlePress = (btn?: AlertButton) => {
        if (btn?.onPress) {
            btn.onPress();
        }
        if (onClose) {
            onClose();
        }
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={() => handlePress(buttons[0])}
        >
            <View style={styles.overlay}>
                <Animated.View
                    style={[
                        styles.dialogCard,
                        {
                            opacity: opacityAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    {/* Top Icon Badge */}
                    <View style={[styles.iconBadge, { backgroundColor: iconInfo.bg, borderColor: iconInfo.border }]}>
                        <Ionicons name={iconInfo.name} size={22} color={iconInfo.color} />
                    </View>

                    {/* Dialog Content */}
                    <Text style={styles.titleText}>{title}</Text>
                    <Text style={styles.messageText}>{message}</Text>

                    {/* Action Buttons Row */}
                    <View style={styles.buttonsContainer}>
                        {buttons.map((btn, idx) => {
                            const isDestructive = btn.style === 'destructive';
                            const isCancel = btn.style === 'cancel';

                            let btnStyle = styles.defaultBtn;
                            let textStyle = styles.defaultBtnText;

                            if (isDestructive) {
                                btnStyle = styles.destructiveBtn;
                                textStyle = styles.destructiveBtnText;
                            } else if (isCancel) {
                                btnStyle = styles.cancelBtn;
                                textStyle = styles.cancelBtnText;
                            }

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.btnBase, btnStyle]}
                                    onPress={() => handlePress(btn)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[styles.btnTextBase, textStyle]}>{btn.text}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(17, 14, 8, 0.82)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
    },
    dialogCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: colors.cardElevated,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        alignItems: 'center',
        ...shadows.glowSandstone,
    },
    iconBadge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        marginBottom: spacing.md,
    },
    titleText: {
        fontSize: 16,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        textAlign: 'center',
        letterSpacing: 0.2,
        marginBottom: spacing.xs + 2,
    },
    messageText: {
        fontSize: 13,
        fontWeight: typography.fontWeightNormal,
        color: colors.linenMuted,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.xs,
    },
    buttonsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        width: '100%',
    },
    btnBase: {
        flex: 1,
        paddingVertical: 11,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnTextBase: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        letterSpacing: 0.3,
    },
    defaultBtn: {
        backgroundColor: colors.sandstone,
    },
    defaultBtnText: {
        color: colors.primaryForeground,
    },
    cancelBtn: {
        backgroundColor: colors.surfaceRecessed,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cancelBtnText: {
        color: colors.linenMuted,
    },
    destructiveBtn: {
        backgroundColor: colors.failed,
    },
    destructiveBtnText: {
        color: '#ffffff',
    },
});
