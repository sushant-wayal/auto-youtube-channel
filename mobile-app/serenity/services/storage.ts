import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const getNotifications = () => {
    try {
        if (isExpoGo) return null;
        return require('expo-notifications') as typeof import('expo-notifications');
    } catch {
        return null;
    }
};

const CONFIG_NOTIF_ID = '__serenity_config_storage__';
const TEN_YEARS_SECONDS = 315360000;

// 1. In-memory storage: always fast, always reliable in-session
const memoryStore = new Map<string, string>();

let hasNativeAsyncStorage: boolean | null = null;

// Probe AsyncStorage safely without throwing
async function isAsyncStorageAvailable(): Promise<boolean> {
    if (hasNativeAsyncStorage !== null) return hasNativeAsyncStorage;
    try {
        if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') {
            hasNativeAsyncStorage = false;
            return false;
        }
        await AsyncStorage.setItem('__probe__', '1');
        const probe = await AsyncStorage.getItem('__probe__');
        await AsyncStorage.removeItem('__probe__');
        hasNativeAsyncStorage = probe === '1';
    } catch (err) {
        console.warn('[safeStorage] Native AsyncStorage is not linked in this binary:', err);
        hasNativeAsyncStorage = false;
    }
    return hasNativeAsyncStorage;
}

// Read backup data from scheduled notification
async function readFromNotificationBackup(): Promise<Record<string, string>> {
    try {
        const Notifications = getNotifications();
        if (!Notifications || typeof Notifications.getAllScheduledNotificationsAsync !== 'function') {
            return {};
        }
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const configItem = scheduled.find((n) => n.identifier === CONFIG_NOTIF_ID);
        if (configItem?.content?.data) {
            return (configItem.content.data as Record<string, string>) || {};
        }
    } catch (err) {
        console.warn('[safeStorage] Notification backup read error:', err);
    }
    return {};
}

// Save backup data to scheduled notification
async function writeToNotificationBackup(key: string, value: string | null): Promise<void> {
    try {
        const Notifications = getNotifications();
        if (!Notifications || typeof Notifications.scheduleNotificationAsync !== 'function') {
            return;
        }
        const existingData = await readFromNotificationBackup();
        const updatedData = { ...existingData };
        if (value === null) {
            delete updatedData[key];
        } else {
            updatedData[key] = value;
        }

        await Notifications.scheduleNotificationAsync({
            identifier: CONFIG_NOTIF_ID,
            content: {
                title: '',
                body: '',
                data: updatedData,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: TEN_YEARS_SECONDS,
            } as any,
        });
    } catch (err) {
        console.warn('[safeStorage] Notification backup write error:', err);
    }
}

export const safeStorage = {
    async getItem(key: string): Promise<string | null> {
        // 1. Check in-memory store
        if (memoryStore.has(key)) {
            return memoryStore.get(key) || null;
        }

        // 2. Try native AsyncStorage
        try {
            const available = await isAsyncStorageAvailable();
            if (available) {
                const val = await AsyncStorage.getItem(key);
                if (val !== null) {
                    memoryStore.set(key, val);
                    return val;
                }
            }
        } catch (err) {
            console.warn(`[safeStorage] AsyncStorage.getItem failed for ${key}:`, err);
        }

        // 3. Fallback to notification backup (persists across app restarts in pre-existing APKs)
        try {
            const backup = await readFromNotificationBackup();
            if (backup && backup[key] !== undefined) {
                const val = backup[key];
                memoryStore.set(key, val);
                return val;
            }
        } catch (err) {
            console.warn(`[safeStorage] Backup read failed for ${key}:`, err);
        }

        return null;
    },

    async setItem(key: string, value: string): Promise<void> {
        // 1. Always set memory first
        memoryStore.set(key, value);

        // 2. Try native AsyncStorage
        try {
            const available = await isAsyncStorageAvailable();
            if (available) {
                await AsyncStorage.setItem(key, value);
            }
        } catch (err) {
            console.warn(`[safeStorage] AsyncStorage.setItem failed for ${key}:`, err);
        }

        // 3. Always mirror to notification backup for APKs without native AsyncStorage
        try {
            await writeToNotificationBackup(key, value);
        } catch (err) {
            console.warn(`[safeStorage] Backup write failed for ${key}:`, err);
        }
    },

    async removeItem(key: string): Promise<void> {
        memoryStore.delete(key);

        try {
            const available = await isAsyncStorageAvailable();
            if (available) {
                await AsyncStorage.removeItem(key);
            }
        } catch (err) {
            console.warn(`[safeStorage] AsyncStorage.removeItem failed for ${key}:`, err);
        }

        try {
            await writeToNotificationBackup(key, null);
        } catch (err) {
            console.warn(`[safeStorage] Backup remove failed for ${key}:`, err);
        }
    },

    async clear(): Promise<void> {
        memoryStore.clear();

        try {
            const available = await isAsyncStorageAvailable();
            if (available) {
                await AsyncStorage.clear();
            }
        } catch (err) {
            console.warn('[safeStorage] AsyncStorage.clear failed:', err);
        }

        try {
            const Notifications = getNotifications();
            if (Notifications && typeof Notifications.cancelScheduledNotificationAsync === 'function') {
                await Notifications.cancelScheduledNotificationAsync(CONFIG_NOTIF_ID);
            }
        } catch (err) {
            console.warn('[safeStorage] Backup cancel failed:', err);
        }
    },
};
