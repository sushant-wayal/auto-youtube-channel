import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Animated, Dimensions, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import IdeasScreen from './screens/IdeasScreen';
import ScheduleTimesScreen from './screens/ScheduleTimesScreen';
import PipelineStatusScreen from './screens/PipelineStatusScreen';
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
    return (
        <TouchableOpacity style={styles.tabButton} onPress={onPress} activeOpacity={0.82}>
            <View style={[styles.iconShell, isActive && styles.iconShellActive]}>
                <LinearGradient
                    colors={gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.iconGradient}
                >
                    <Ionicons
                        name={icon}
                        size={16}
                        color={isActive ? colors.primaryForeground : colors.foregroundMuted}
                    />
                </LinearGradient>
            </View>
            <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : styles.tabLabelInactive]}>{label}</Text>
        </TouchableOpacity>
    );
}

export default function App() {
    const navigationRef = useNavigationContainerRef();
    const [activeTab, setActiveTab] = React.useState(0);
    const indicatorPosition = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.timing(indicatorPosition, {
            toValue: activeTab,
            useNativeDriver: true,
            duration: motion.fast,
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
    const tabWidth = screenWidth / NUM_TABS;

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
                    <View style={styles.headerInner}>
                        <TabItem label="Ideas" icon="bulb" isActive={activeTab === 0} onPress={() => handleTabPress(0, 'Ideas')} />
                        <TabItem label="Schedule" icon="time" isActive={activeTab === 1} onPress={() => handleTabPress(1, 'Schedule')} />
                        <TabItem label="Pipeline" icon="git-branch" isActive={activeTab === 2} onPress={() => handleTabPress(2, 'Pipeline')} />
                    </View>
                    <Animated.View
                        style={[
                            styles.indicator,
                            {
                                width: `${100 / NUM_TABS}%`,
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
                            colors={gradients.primary}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.indicatorGradient}
                        />
                    </Animated.View>
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
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerInner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.card,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        ...shadows.md,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xs,
    },
    iconShell: {
        width: 24,
        height: 24,
        borderRadius: 12,
        overflow: 'hidden',
        opacity: 0.75,
    },
    iconShellActive: {
        opacity: 1,
        ...shadows.sm,
    },
    iconGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabLabel: {
        fontSize: typography.fontSizeSm,
        fontWeight: typography.fontWeightSemibold,
    },
    tabLabelActive: {
        color: colors.foreground,
    },
    tabLabelInactive: {
        color: colors.foregroundMuted,
    },
    indicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        paddingHorizontal: spacing.md,
    },
    indicatorGradient: {
        height: 3,
        borderRadius: 999,
        marginHorizontal: spacing.md,
        shadowColor: colors.glowStrong,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 8,
    },
});
