// shadcn New York theme colors and styling constants
export const colors = {
    // Background
    background: '#05070A',
    backgroundSecondary: '#0A0E14',

    // Foreground
    foreground: '#F5F7FF',
    foregroundMuted: '#A3AEC5',

    // Primary (purple)
    primary: '#7C3AED',
    primaryForeground: '#F8F5FF',

    // Secondary
    secondary: '#151A23',
    secondaryForeground: '#E4E9F8',

    // Accent
    accent: '#1A1330',
    accentForeground: '#EDE9FE',

    // Muted
    muted: '#111723',
    mutedForeground: '#8B97B0',

    // Border
    border: '#252D3F',
    borderLight: '#1C2434',

    // Destructive
    destructive: '#F87171',
    destructiveForeground: '#FDF4F4',

    // Success
    success: '#22D3A5',

    // Card
    card: '#0D111B',
    cardBorder: '#262E42',

    glow: '#A78BFA',
    glowStrong: '#7C3AED',
    gradientFrom: '#A78BFA',
    gradientMid: '#7C3AED',
    gradientTo: '#5B21B6',
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
    sm: 16,
    md: 18,
    lg: 22,
    xl: 28,
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
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 2,
    },
    md: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
        elevation: 6,
    },
    lg: {
        shadowColor: '#A78BFA',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
};

export const gradients = {
    primary: [colors.gradientFrom, colors.gradientMid, colors.gradientTo] as const,
    subtle: ['#0B0F18', '#140F2A', '#0B0F18'] as const,
};

export const motion = {
    fast: 200,
};
