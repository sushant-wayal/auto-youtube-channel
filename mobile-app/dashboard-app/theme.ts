// shadcn New York theme colors and styling constants
export const colors = {
    // Background
    background: '#FFFFFF',
    backgroundSecondary: '#F8F9FA',

    // Foreground
    foreground: '#09090B',
    foregroundMuted: '#71717A',

    // Primary (slate)
    primary: '#18181B',
    primaryForeground: '#FAFAFA',

    // Secondary
    secondary: '#F4F4F5',
    secondaryForeground: '#18181B',

    // Accent
    accent: '#F4F4F5',
    accentForeground: '#18181B',

    // Muted
    muted: '#F4F4F5',
    mutedForeground: '#71717A',

    // Border
    border: '#E4E4E7',
    borderLight: '#F4F4F5',

    // Destructive
    destructive: '#EF4444',
    destructiveForeground: '#FAFAFA',

    // Success
    success: '#10B981',

    // Card
    card: '#FFFFFF',
    cardBorder: '#E4E4E7',
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const borderRadius = {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
};

export const typography = {
    fontSizeXs: 12,
    fontSizeSm: 14,
    fontSizeMd: 16,
    fontSizeLg: 18,
    fontSizeXl: 20,
    fontSizeXxl: 24,

    fontWeightNormal: '400' as const,
    fontWeightMedium: '500' as const,
    fontWeightSemibold: '600' as const,
    fontWeightBold: '700' as const,
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
};
