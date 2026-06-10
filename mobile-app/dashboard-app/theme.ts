// Premium Sci-Fi / Cyberpunk theme colors and styling constants
export const colors = {
    // Background
    background: '#040711',           // Deep space obsidian
    backgroundSecondary: '#090E1F',  // Elegant midnight navy

    // Foreground
    foreground: '#F8FAFC',           // High contrast slate white
    foregroundMuted: '#94A3B8',      // Slate gray for secondary text

    // Primary (Violet/Indigo Accent)
    primary: '#8B5CF6',              // Neon violet
    primaryForeground: '#FFFFFF',

    // Secondary
    secondary: '#111827',            // Charcoal dark blue
    secondaryForeground: '#E5E7EB',

    // Accent
    accent: '#1E1B4B',               // Dark violet inset
    accentForeground: '#E0E7FF',

    // Muted
    muted: '#0F172A',                // Slate dark blue
    mutedForeground: '#64748B',      // Dusty slate gray

    // Border
    border: '#1E293B',               // Subtle slate border
    borderLight: '#111827',          // Very soft divider

    // Destructive
    destructive: '#F43F5E',          // Rose-red destructive state
    destructiveForeground: '#FFF1F2',

    // Success / Progress
    success: '#10B981',              // Cyber emerald success state
    successGlow: '#34D399',

    // Card styling
    card: '#0D1527',                 // High-tech glass card background
    cardBorder: '#23304D',           // Pronounced card border for glass effect

    glow: '#A78BFA',                 // Soft purple glow
    glowStrong: '#7C3AED',           // Strong purple glow
    gradientFrom: '#8B5CF6',         // Violet
    gradientMid: '#6366F1',          // Indigo
    gradientTo: '#06B6D4',           // Cyber Cyan
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
    sm: 14,
    md: 20,
    lg: 26,
    xl: 32,
};

export const typography = {
    fontSizeXs: 12,
    fontSizeSm: 14,
    fontSizeMd: 16,
    fontSizeLg: 18,
    fontSizeXl: 21,
    fontSizeXxl: 26,

    fontWeightNormal: '400' as const,
    fontWeightMedium: '500' as const,
    fontWeightSemibold: '600' as const,
    fontWeightBold: '700' as const,
};

export const shadows = {
    sm: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    },
    md: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 8,
    },
    lg: {
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 14,
    },
    glowSuccess: {
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 6,
    },
    glowPrimary: {
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
        elevation: 6,
    }
};

export const gradients = {
    primary: [colors.gradientFrom, colors.gradientMid, colors.gradientTo] as const,
    subtle: ['#090E1F', '#11102A', '#090E1F'] as const,
    card: ['#0D1527', '#121A30'] as const,
    success: ['#065F46', '#10B981'] as const,
    danger: ['#9F1239', '#F43F5E'] as const,
};

export const motion = {
    fast: 220,
    springConfig: {
        tension: 180,
        friction: 12,
    }
};

