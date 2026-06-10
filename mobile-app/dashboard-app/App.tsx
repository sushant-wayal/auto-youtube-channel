import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Animated, Dimensions, TouchableOpacity, Platform, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import IdeasScreen from './screens/IdeasScreen';
import ScheduleTimesScreen from './screens/ScheduleTimesScreen';
import PipelineStatusScreen from './screens/PipelineStatusScreen';
import SettingsScreen from './screens/SettingsScreen';
import { borderRadius, colors, gradients, motion, shadows, spacing, typography } from './theme';
import { pipelineApi } from './services/api';

// Hardcoded - avoids any Constants resolution issues in standalone builds
const EXPO_PROJECT_ID = '294f6e06-d643-47b7-92a6-8701a374abf0';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const Tab = createMaterialTopTabNavigator();
const NUM_TABS = 3;

type TabItemProps = {
    label: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    isActive: boolean;
    onPress: () => void;
};

function TabItem({ label, icon, isActive, onPress }: TabItemProps) {
    const scale = React.useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.92,
            useNativeDriver: true,
            tension: 250,
            friction: 10,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 250,
            friction: 10,
        }).start();
    };

    return (
        <TouchableOpacity
            style={styles.tabButton}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View style={[styles.tabButtonContent, { transform: [{ scale }] }]}>
                <View style={[styles.iconShell, isActive && styles.iconShellActive]}>
                    <LinearGradient
                        colors={isActive ? gradients.primary : ['#1E293B', '#1E293B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.iconGradient}
                    >
                        <Ionicons
                            name={icon}
                            size={14}
                            color={isActive ? colors.primaryForeground : colors.foregroundMuted}
                        />
                    </LinearGradient>
                </View>
                <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : styles.tabLabelInactive]}>
                    {label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
}

export default function App() {
    const navigationRef = useNavigationContainerRef();
    const [activeTab, setActiveTab] = React.useState(0);
    const [showSettings, setShowSettings] = React.useState(false);
    const indicatorPosition = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.spring(indicatorPosition, {
            toValue: activeTab,
            useNativeDriver: true,
            tension: motion.springConfig.tension,
            friction: motion.springConfig.friction,
        }).start();
    }, [activeTab, indicatorPosition]);

    React.useEffect(() => {
        (async () => {
            try {
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('pipeline', {
                        name: 'Pipeline Status',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: colors.gradientMid,
                    });
                }

                const { status: existingStatus } = await Notifications.getPermissionsAsync();
                let finalStatus = existingStatus;

                if (existingStatus !== 'granted') {
                    const { status } = await Notifications.requestPermissionsAsync();
                    finalStatus = status;
                }

                if (finalStatus !== 'granted') {
                    console.log('[Push] Permission denied');
                    return;
                }

                const token = (await Notifications.getExpoPushTokenAsync({ projectId: EXPO_PROJECT_ID })).data;
                console.log('[Push] Token obtained:', token.substring(0, 30) + '...');

                const result = await pipelineApi.savePushToken(token);
                if (result.ok) {
                    console.log('[Push] Token saved to backend');
                } else {
                    console.error('[Push] Backend save failed:', result.error);
                }
            } catch (err: any) {
                console.error('[Push] Error:', err.message ?? String(err));
            }
        })();
    }, []);

    const screenWidth = Dimensions.get('window').width;
    const innerWidth = screenWidth - spacing.md * 2;
    const tabWidth = innerWidth / NUM_TABS;

    const handleTabPress = (index: number, routeName: string) => {
        setActiveTab(index);
        if (navigationRef.isReady()) {
            navigationRef.navigate(routeName as never);
        }
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <StatusBar style="light" />

                <LinearGradient
                    colors={gradients.subtle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.headerShell}
                >
                    <View style={styles.brandRow}>
                        <Text style={styles.brandTitle}>SERENITY</Text>
                        <TouchableOpacity style={styles.settingsButton} onPress={() => setShowSettings(true)}>
                            <Ionicons name="settings-outline" size={18} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.headerInner}>
                        <Animated.View
                            style={[
                                styles.pillIndicator,
                                {
                                    width: tabWidth - 8,
                                    transform: [{
                                        translateX: indicatorPosition.interpolate({
                                            inputRange: [0, 1, 2],
                                            outputRange: [0, tabWidth, tabWidth * 2],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <LinearGradient
                                colors={['rgba(139, 92, 246, 0.22)', 'rgba(6, 182, 212, 0.15)']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.pillGradient}
                            />
                        </Animated.View>

                        <TabItem label="Ideas" icon="bulb-outline" isActive={activeTab === 0} onPress={() => handleTabPress(0, 'Ideas')} />
                        <TabItem label="Schedule" icon="time-outline" isActive={activeTab === 1} onPress={() => handleTabPress(1, 'Schedule')} />
                        <TabItem label="Pipeline" icon="git-branch-outline" isActive={activeTab === 2} onPress={() => handleTabPress(2, 'Pipeline')} />
                    </View>
                </LinearGradient>

                <NavigationContainer
                    ref={navigationRef}
                    onStateChange={(state) => {
                        const index = state?.index;
                        if (index !== undefined) {
                            setActiveTab(index);
                        }
                    }}
                >
                    <Tab.Navigator
                        screenOptions={{
                            swipeEnabled: true,
                            tabBarStyle: {
                                height: 0,
                            },
                            tabBarIndicatorStyle: {
                                height: 0,
                            },
                        }}
                    >
                        <Tab.Screen name="Ideas" component={IdeasScreen} options={{}} />
                        <Tab.Screen name="Schedule" component={ScheduleTimesScreen} options={{}} />
                        <Tab.Screen name="Pipeline" component={PipelineStatusScreen} options={{}} />
                    </Tab.Navigator>
                </NavigationContainer>

                <Modal
                    visible={showSettings}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={() => setShowSettings(false)}
                >
                    <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
                        <StatusBar style="light" />
                        <View style={styles.modalHeader}>
                            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowSettings(false)}>
                                <Ionicons name="chevron-back" size={24} color={colors.foreground} />
                                <Text style={styles.modalCloseText}>Back</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>Settings</Text>
                            <View style={{ width: 60 }} />
                        </View>
                        <SettingsScreen />
                    </SafeAreaView>
                </Modal>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    headerShell: {
        paddingHorizontal: spacing.md,
        paddingTop: Platform.OS === 'ios' ? spacing.sm : spacing.md,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerInner: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.cardBorder,
        overflow: 'hidden',
        paddingVertical: 4,
        ...shadows.md,
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.md,
    },
    tabButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs + 2,
    },
    iconShell: {
        width: 26,
        height: 26,
        borderRadius: 13,
        overflow: 'hidden',
        opacity: 0.75,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    iconShellActive: {
        opacity: 1,
        borderColor: 'rgba(139, 92, 246, 0.3)',
        ...shadows.sm,
    },
    iconGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 13,
    },
    tabLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
        letterSpacing: 0.3,
    },
    tabLabelActive: {
        color: colors.foreground,
    },
    tabLabelInactive: {
        color: colors.foregroundMuted,
    },
    pillIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(139, 92, 246, 0.35)',
    },
    pillGradient: {
        flex: 1,
        borderRadius: borderRadius.lg,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    brandTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        letterSpacing: 2,
        textShadowColor: colors.primary,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
    },
    settingsButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    modalSafeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
    },
    modalCloseButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    modalCloseText: {
        fontSize: typography.fontSizeMd,
        color: colors.foreground,
        fontWeight: typography.fontWeightSemibold,
    },
    modalTitle: {
        fontSize: typography.fontSizeMd,
        fontWeight: typography.fontWeightBold,
        color: colors.foreground,
        textAlign: 'center',
    },
});
