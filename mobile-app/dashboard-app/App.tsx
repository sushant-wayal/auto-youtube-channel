import React from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Text, View, Animated, Dimensions, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import IdeasScreen from './screens/IdeasScreen';
import ScheduleTimesScreen from './screens/ScheduleTimesScreen';
import PipelineStatusScreen from './screens/PipelineStatusScreen';
import { colors } from './theme';
import { pipelineApi } from './services/api';

// Hardcoded — avoids any Constants resolution issues in standalone builds
const EXPO_PROJECT_ID = '294f6e06-d643-47b7-92a6-8701a374abf0';

// Show notifications as banners even when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

const Tab = createMaterialTopTabNavigator();

const NUM_TABS = 3;

export default function App() {
    const navigationRef = useNavigationContainerRef();
    const [activeTab, setActiveTab] = React.useState(0);
    const indicatorPosition = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.spring(indicatorPosition, {
            toValue: activeTab,
            useNativeDriver: true,
        }).start();
    }, [activeTab]);

    // Register push token once on mount
    React.useEffect(() => {
        (async () => {
            try {
                if (Platform.OS === 'android') {
                    await Notifications.setNotificationChannelAsync('pipeline', {
                        name: 'Pipeline Status',
                        importance: Notifications.AndroidImportance.MAX,
                        vibrationPattern: [0, 250, 250, 250],
                        lightColor: '#000000',
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
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
                <StatusBar style="dark" />

                {/* Custom header with labels */}
                <View style={{ height: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E0E0E0' }}>
                    <View style={{ flex: 1, flexDirection: 'row' }}>
                        <TouchableOpacity
                            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => handleTabPress(0, 'Ideas')}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="bulb" size={20} color={activeTab === 0 ? '#000000' : '#71717A'} />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === 0 ? '#000000' : '#71717A' }}>
                                    Video Ideas
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => handleTabPress(1, 'Schedule')}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="time" size={20} color={activeTab === 1 ? '#000000' : '#71717A'} />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === 1 ? '#000000' : '#71717A' }}>
                                    Schedule
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
                            onPress={() => handleTabPress(2, 'Pipeline')}
                            activeOpacity={0.7}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="git-branch" size={20} color={activeTab === 2 ? '#000000' : '#71717A'} />
                                <Text style={{ fontSize: 14, fontWeight: '600', color: activeTab === 2 ? '#000000' : '#71717A' }}>
                                    Pipeline
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Animated indicator */}
                    <Animated.View
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            height: 3,
                            width: `${100 / NUM_TABS}%`,
                            backgroundColor: '#000000',
                            transform: [{
                                translateX: indicatorPosition.interpolate({
                                    inputRange: [0, 1, 2],
                                    outputRange: [0, tabWidth, tabWidth * 2],
                                })
                            }]
                        }}
                    />
                </View>

                <NavigationContainer
                    ref={navigationRef}
                    onStateChange={(state) => {
                        const index = state?.index;
                        if (index !== undefined) setActiveTab(index);
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
                        <Tab.Screen
                            name="Ideas"
                            component={IdeasScreen}
                            options={{
                                tabBarLabel: ({ focused }) => (
                                    <View style={{ width: 180, height: 40, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: focused ? '#FFFFFF' : '#000000' }}>
                                            IDEAS
                                        </Text>
                                    </View>
                                ),
                            }}
                        />
                        <Tab.Screen
                            name="Schedule"
                            component={ScheduleTimesScreen}
                            options={{
                                tabBarLabel: ({ focused }) => (
                                    <View style={{ width: 180, height: 40, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: focused ? '#FFFFFF' : '#000000' }}>
                                            SCHEDULE
                                        </Text>
                                    </View>
                                ),
                            }}
                        />
                        <Tab.Screen
                            name="Pipeline"
                            component={PipelineStatusScreen}
                            options={{
                                tabBarLabel: ({ focused }) => (
                                    <View style={{ width: 180, height: 40, backgroundColor: '#FF0000', justifyContent: 'center', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: focused ? '#FFFFFF' : '#000000' }}>
                                            PIPELINE
                                        </Text>
                                    </View>
                                ),
                            }}
                        />
                    </Tab.Navigator>
                </NavigationContainer>
            </SafeAreaView>
        </SafeAreaProvider>
    );
}