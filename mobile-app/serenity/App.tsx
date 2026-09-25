import React from 'react';
import { NavigationContainer, useNavigationContainerRef, TabActions } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StatusBar } from 'expo-status-bar';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Animated, Dimensions, TouchableOpacity, Platform, StyleSheet, Modal, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import IdeasScreen from './screens/IdeasScreen';
import ScheduleTimesScreen from './screens/ScheduleTimesScreen';
import PipelineStatusScreen from './screens/PipelineStatusScreen';
import SettingsScreen from './screens/SettingsScreen';
import SeriesScreen from './screens/SeriesScreen';
import CommentsScreen from './screens/CommentsScreen';
import { borderRadius, colors, gradients, motion, shadows, spacing, typography } from './theme';
import { pipelineApi } from './services/api';

// Hardcoded - avoids any Constants resolution issues in standalone builds
const EXPO_PROJECT_ID = '294f6e06-d643-47b7-92a6-8701a374abf0';
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const getNotifications = () =>
    isExpoGo ? null : (require('expo-notifications') as typeof import('expo-notifications'));

const Tab = createMaterialTopTabNavigator();

type BottomNavItemProps = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    activeIcon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    isActive: boolean;
    onPress: () => void;
};

function BottomNavItem({ icon, activeIcon, label, isActive, onPress }: BottomNavItemProps) {
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
            style={styles.bottomNavButton}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.8}
        >
            <Animated.View style={[styles.bottomNavContent, { transform: [{ scale }] }]}>
                <Ionicons
                    name={isActive ? activeIcon : icon}
                    size={20}
                    color={isActive ? colors.sandstone : colors.linenWhisper}
                />
                <Text style={[styles.bottomNavLabel, isActive && styles.bottomNavLabelActive]}>
                    {label}
                </Text>
                {isActive && <View style={styles.activeDot} />}
            </Animated.View>
        </TouchableOpacity>
    );
}

const TAB_SUBTITLES = [
    'Editorial Ideas Queue',
    'Series Architecture & Library',
    'Publishing Schedules',
    'Automation Pipeline Telemetry',
    'Audience Response & Tuning',
];

export default function App() {
    const navigationRef = useNavigationContainerRef();
    const [activeTab, setActiveTab] = React.useState(0); // Start on Ideas
    const [showSettings, setShowSettings] = React.useState(false);

    // In-app floating notification state
    const [inAppNotification, setInAppNotification] = React.useState<{
        title: string;
        body: string;
        targetScreen: string;
        tabIndex: number;
    } | null>(null);
    const inAppAnim = React.useRef(new Animated.Value(-140)).current;

    const pendingRouteRef = React.useRef<{ name: string; index: number; timestamp: number } | null>(null);
    const lastHandledTimeRef = React.useRef<number>(0);
    const suppressStateSyncUntilRef = React.useRef<number>(0);

    const jumpToTab = React.useCallback((routeName: string, tabIndex: number) => {
        console.log(`[Push] jumpToTab requested for ${routeName} (index ${tabIndex})`);
        
        // Immediately set the UI bottom bar tab state
        setActiveTab(tabIndex);
        
        // Suppress onStateChange from resetting to 0 during tab initialization
        suppressStateSyncUntilRef.current = Date.now() + 1500;

        const performJump = () => {
            if (navigationRef.isReady()) {
                setActiveTab(tabIndex);
                try {
                    navigationRef.dispatch(TabActions.jumpTo(routeName));
                } catch {
                    try {
                        navigationRef.navigate(routeName as never);
                    } catch (e) {
                        console.error('[Push] Navigation jump error:', e);
                    }
                }
            }
        };

        // Execute immediately
        performJump();

        // Staggered retries to ensure Android ViewPager2 / TopTabs registers the jump after layout passes
        const t1 = setTimeout(performJump, 80);
        const t2 = setTimeout(performJump, 250);
        const t3 = setTimeout(performJump, 600);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    }, [navigationRef]);

    const navigateToScreen = React.useCallback((routeName: string, tabIndex: number) => {
        if (navigationRef.isReady()) {
            jumpToTab(routeName, tabIndex);
        } else {
            console.log(`[Push] NavigationContainer not ready, storing pending route: ${routeName}`);
            pendingRouteRef.current = { name: routeName, index: tabIndex, timestamp: Date.now() };
            setActiveTab(tabIndex);
            suppressStateSyncUntilRef.current = Date.now() + 1800;
        }
    }, [navigationRef, jumpToTab]);

    const handleNotificationResponse = React.useCallback((response: any) => {
        if (!response) return;

        // Deduplicate rapid repeat invocations within 1.5 seconds
        const now = Date.now();
        if (now - lastHandledTimeRef.current < 1500) {
            return;
        }
        lastHandledTimeRef.current = now;

        console.log('[Push] Notification response received:', JSON.stringify(response.notification?.request?.content?.title));

        let rawData: any = response.notification?.request?.content?.data;
        if (typeof rawData === 'string') {
            try {
                rawData = JSON.parse(rawData);
            } catch {}
        }

        const targetScreen: string = String(rawData?.screen || rawData?.targetScreen || rawData?.route || 'Pipeline');
        const screenTabMap: Record<string, number> = {
            Ideas: 0,
            Series: 1,
            Schedule: 2,
            Pipeline: 3,
            Comments: 4,
        };
        const tabIndex = screenTabMap[targetScreen] ?? 3;

        console.log(`[Push] Routing notification click to: ${targetScreen} (tab ${tabIndex})`);
        navigateToScreen(targetScreen, tabIndex);
    }, [navigateToScreen]);

    const handleNavigationReady = React.useCallback(() => {
        console.log('[Push] NavigationContainer is ready');
        if (pendingRouteRef.current) {
            const { name, index } = pendingRouteRef.current;
            pendingRouteRef.current = null;
            jumpToTab(name, index);
        }
    }, [jumpToTab]);

    // Push Notification Token & Channel Setup
    React.useEffect(() => {
        const Notifications = getNotifications();
        if (!Notifications) return;

        (async () => {
            try {
                Notifications.setNotificationHandler({
                    handleNotification: async () => ({
                        shouldShowAlert: true,
                        shouldShowBanner: true,
                        shouldShowList: true,
                        shouldPlaySound: true,
                        shouldSetBadge: true,
                    }),
                });

                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('pipeline', {
                        name: 'Serenity Studio Telemetry',
                        description: 'Real-time pipeline automation alerts and production notifications',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: colors.sandstone,
                        sound: 'default',
                        enableVibrate: true,
                        showBadge: true,
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

    // Notification Response Listeners (Cold start + Foreground + Background resume)
    React.useEffect(() => {
        const Notifications = getNotifications();
        if (!Notifications) return;

        const checkLastResponse = async () => {
            try {
                const response = await Notifications.getLastNotificationResponseAsync();
                if (response) {
                    console.log('[Push] Found notification response on launch or resume');
                    handleNotificationResponse(response);
                }
            } catch (err) {
                console.error('[Push] Error checking last notification response:', err);
            }
        };

        // 1. Check on initial mount (cold start)
        checkLastResponse();
        const mountTimer = setTimeout(checkLastResponse, 300);

        // 2. Listen for clicks while the app is active
        const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('[Push] addNotificationResponseReceivedListener triggered');
            handleNotificationResponse(response);
        });

        // 3. Listen for AppState transition to 'active' (resumed from background tap)
        const appStateSub = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('[Push] AppState became active, checking notification response');
                checkLastResponse();
            }
        });

        // 4. In-App Banner for foreground notifications
        const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
            console.log('[Push] Foreground notification received');
            const content = notification?.request?.content;
            let rawData: any = content?.data;
            if (typeof rawData === 'string') {
                try { rawData = JSON.parse(rawData); } catch {}
            }
            const target: string = String(rawData?.screen || rawData?.targetScreen || rawData?.route || 'Pipeline');
            const screenTabMap: Record<string, number> = {
                Ideas: 0,
                Series: 1,
                Schedule: 2,
                Pipeline: 3,
                Comments: 4,
            };
            const tabIdx = screenTabMap[target] ?? 3;

            setInAppNotification({
                title: content?.title || '✦ Serenity Studio • Telemetry Alert',
                body: content?.body || 'New pipeline update available.',
                targetScreen: target,
                tabIndex: tabIdx,
            });

            Animated.spring(inAppAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        });

        return () => {
            clearTimeout(mountTimer);
            responseSub.remove();
            appStateSub.remove();
            receivedSub.remove();
        };
    }, [handleNotificationResponse, inAppAnim]);

    const dismissInAppBanner = React.useCallback(() => {
        Animated.timing(inAppAnim, {
            toValue: -140,
            duration: 220,
            useNativeDriver: true,
        }).start(() => {
            setInAppNotification(null);
        });
    }, [inAppAnim]);

    React.useEffect(() => {
        if (inAppNotification) {
            const timer = setTimeout(dismissInAppBanner, 7000);
            return () => clearTimeout(timer);
        }
    }, [inAppNotification, dismissInAppBanner]);

    const handleInAppBannerPress = () => {
        if (!inAppNotification) return;
        const { targetScreen, tabIndex } = inAppNotification;
        dismissInAppBanner();
        jumpToTab(targetScreen, tabIndex);
    };

    const handleTabPress = (index: number, routeName: string) => {
        jumpToTab(routeName, index);
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <StatusBar style="light" />

                {/* Floating Serenity In-App Telemetry Notification Banner */}
                {inAppNotification && (
                    <Animated.View style={[styles.inAppBannerContainer, { transform: [{ translateY: inAppAnim }] }]}>
                        <TouchableOpacity
                            style={styles.inAppBannerCard}
                            onPress={handleInAppBannerPress}
                            activeOpacity={0.88}
                        >
                            <View style={styles.inAppBannerIconBox}>
                                <Ionicons name="sparkles" size={16} color={colors.sandstone} />
                            </View>
                            <View style={styles.inAppBannerTextBox}>
                                <View style={styles.inAppBannerHeaderRow}>
                                    <Text style={styles.inAppBannerKicker}>SERENITY TELEMETRY</Text>
                                    <View style={styles.inAppBannerDot} />
                                    <Text style={styles.inAppBannerActionHint}>TAP TO VIEW →</Text>
                                </View>
                                <Text style={styles.inAppBannerTitle} numberOfLines={1}>{inAppNotification.title}</Text>
                                <Text style={styles.inAppBannerBody} numberOfLines={2}>{inAppNotification.body}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={dismissInAppBanner}
                                style={styles.inAppBannerCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Ionicons name="close" size={16} color={colors.bone.muted} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Animated.View>
                )}

                {/* Top Minimalist Header */}
                <View style={styles.topHeader}>
                    <View style={styles.brandTitles}>
                        <View style={styles.brandRow}>
                            <Text style={styles.brandTitle}>SERENITY</Text>
                            <View style={styles.brandAccentDot} />
                            <Text style={styles.brandStudioTag}>STUDIO</Text>
                        </View>
                        <Text style={styles.brandSubtitle}>
                            {TAB_SUBTITLES[activeTab] ?? 'Studio Engine'}
                        </Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.settingsButton}
                            onPress={() => setShowSettings(true)}
                            activeOpacity={0.7}
                            accessibilityLabel="Settings"
                        >
                            <Ionicons name="options-outline" size={18} color={colors.sandstoneLight} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Screen Content */}
                <View style={styles.contentContainer}>
                    <NavigationContainer
                        ref={navigationRef}
                        onReady={handleNavigationReady}
                        onStateChange={(state) => {
                            const index = state?.index;
                            if (index !== undefined) {
                                // Prevent initial top-tab layout from resetting activeTab back to 0 during active jump
                                if (Date.now() < suppressStateSyncUntilRef.current && index === 0 && activeTab !== 0) {
                                    console.log('[Push] Suppressing onStateChange reset to index 0 during active jump');
                                    return;
                                }
                                setActiveTab(index);
                            }
                        }}
                    >
                        <Tab.Navigator
                            id="main-tabs"
                            initialRouteName="Ideas"
                            screenOptions={{
                                swipeEnabled: true,
                                tabBarStyle: { height: 0 },
                                tabBarIndicatorStyle: { height: 0 },
                            }}
                        >
                            <Tab.Screen name="Ideas" component={IdeasScreen} />
                            <Tab.Screen name="Series" component={SeriesScreen} />
                            <Tab.Screen name="Schedule" component={ScheduleTimesScreen} />
                            <Tab.Screen name="Pipeline" component={PipelineStatusScreen} />
                            <Tab.Screen name="Comments" component={CommentsScreen} />
                        </Tab.Navigator>
                    </NavigationContainer>
                </View>

                {/* Serenity Studio 5-Tab Bottom Bar */}
                <View style={styles.bottomBarContainer}>
                    <View style={styles.bottomBarInner}>
                        <BottomNavItem
                            icon="bulb-outline"
                            activeIcon="bulb"
                            label="Ideas"
                            isActive={activeTab === 0}
                            onPress={() => handleTabPress(0, 'Ideas')}
                        />
                        <BottomNavItem
                            icon="book-outline"
                            activeIcon="book"
                            label="Series"
                            isActive={activeTab === 1}
                            onPress={() => handleTabPress(1, 'Series')}
                        />
                        <BottomNavItem
                            icon="calendar-outline"
                            activeIcon="calendar"
                            label="Schedule"
                            isActive={activeTab === 2}
                            onPress={() => handleTabPress(2, 'Schedule')}
                        />
                        <BottomNavItem
                            icon="git-network-outline"
                            activeIcon="git-network"
                            label="Pipeline"
                            isActive={activeTab === 3}
                            onPress={() => handleTabPress(3, 'Pipeline')}
                        />
                        <BottomNavItem
                            icon="chatbubbles-outline"
                            activeIcon="chatbubbles"
                            label="Audience"
                            isActive={activeTab === 4}
                            onPress={() => handleTabPress(4, 'Comments')}
                        />
                    </View>
                </View>

                {/* Settings Full Modal Sheet */}
                <Modal
                    visible={showSettings}
                    animationType="slide"
                    transparent={false}
                    onRequestClose={() => setShowSettings(false)}
                >
                    <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
                        <StatusBar style="light" />
                        <View style={styles.modalHeader}>
                            <TouchableOpacity
                                style={styles.modalCloseButton}
                                onPress={() => setShowSettings(false)}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="chevron-back" size={20} color={colors.sandstone} />
                                <Text style={styles.modalCloseText}>Back</Text>
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>System Settings</Text>
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
    topHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === 'ios' ? spacing.xs : spacing.sm + 2,
        paddingBottom: spacing.sm + 4,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    brandTitles: {
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
    },
    brandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    brandTitle: {
        fontSize: 18,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        letterSpacing: 2.8,
    },
    brandAccentDot: {
        width: 3.5,
        height: 3.5,
        borderRadius: 2,
        backgroundColor: colors.sandstone,
        marginHorizontal: 1,
    },
    brandStudioTag: {
        fontSize: 10,
        fontWeight: typography.fontWeightBold,
        color: colors.sandstone,
        letterSpacing: 1.6,
        textTransform: 'uppercase',
    },
    brandSubtitle: {
        fontSize: 12,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenMuted,
        letterSpacing: 0.2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    settingsButton: {
        width: 38,
        height: 38,
        borderRadius: borderRadius.md,
        backgroundColor: colors.cardElevated,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.subtle,
    },
    contentContainer: {
        flex: 1,
    },
    bottomBarContainer: {
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
        paddingBottom: Platform.OS === 'ios' ? 2 : spacing.xs,
        paddingTop: spacing.xs,
    },
    bottomBarInner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: spacing.xs,
    },
    bottomNavButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xs + 2,
    },
    bottomNavContent: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    bottomNavLabel: {
        fontSize: 10,
        fontWeight: typography.fontWeightMedium,
        color: colors.linenWhisper,
        marginTop: 3,
        letterSpacing: 0.3,
    },
    bottomNavLabelActive: {
        color: colors.sandstone,
        fontWeight: typography.fontWeightBold,
    },
    activeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.sandstone,
        position: 'absolute',
        bottom: -6,
    },
    modalSafeArea: {
        flex: 1,
        backgroundColor: colors.background,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
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
        fontSize: typography.fontSizeSm,
        color: colors.sandstone,
        fontWeight: typography.fontWeightSemibold,
    },
    modalTitle: {
        fontSize: typography.fontSizeLg,
        fontWeight: typography.fontWeightBold,
        color: colors.linen,
        textAlign: 'center',
    },
    inAppBannerContainer: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 44 : 12,
        left: spacing.md,
        right: spacing.md,
        zIndex: 9999,
        elevation: 10,
    },
    inAppBannerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.obsidian[900],
        borderWidth: 1,
        borderColor: colors.sandstone,
        borderRadius: borderRadius.lg,
        padding: spacing.sm + 4,
        gap: 10,
        ...shadows.md,
    },
    inAppBannerIconBox: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: colors.obsidian[800],
        borderWidth: 1,
        borderColor: colors.sandstone,
        alignItems: 'center',
        justifyContent: 'center',
    },
    inAppBannerTextBox: {
        flex: 1,
    },
    inAppBannerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    inAppBannerKicker: {
        fontSize: 9,
        fontWeight: '800',
        color: colors.sandstone,
        letterSpacing: 1,
    },
    inAppBannerDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: colors.sandstone,
    },
    inAppBannerActionHint: {
        fontSize: 9,
        fontWeight: '700',
        color: colors.bone.muted,
        letterSpacing: 0.5,
    },
    inAppBannerTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.bone.DEFAULT,
        letterSpacing: -0.2,
    },
    inAppBannerBody: {
        fontSize: 11,
        color: colors.bone.muted,
        lineHeight: 15,
        marginTop: 1,
    },
    inAppBannerCloseBtn: {
        padding: 4,
    },
});

