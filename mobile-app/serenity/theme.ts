export const obsidianScale = {
    950: '#110e08',
    900: '#16130d',
    850: '#1c1811',
    800: '#26221a',
    750: '#2d2720',
    700: '#322c22',
};

export const boneScale = {
    DEFAULT: '#f5f0eb',
    muted: '#a89f91',
    subtle: '#736b5e',
    hairline: 'rgba(200, 178, 155, 0.12)',
};

export const sandstoneScale = {
    50: '#fbf9f6',
    100: '#f7f4ee',
    200: '#ebe3d5',
    300: '#d8c4ad',
    400: '#c8b29b',
    500: '#b59e85',
    600: '#947e67',
    700: '#73614e',
};

// Serenity Studio — Luxury Obsidian & Warm Sandstone Theme System
export const colors = {
    // Scales
    obsidian: obsidianScale,
    bone: boneScale,
    sandstoneScale: sandstoneScale,

    // Backgrounds & Canvas
    background: '#110e08',           // Deep space obsidian canvas
    backgroundSecondary: '#16130d',  // Subtle dark surface
    surface: '#16130d',              // Subtle dark surface
    card: '#191610',                 // Card background
    cardHover: '#23201c',            // Card hover / active
    cardElevated: '#221e17',         // Elevated containers & pills
    surfaceCanvas: '#110e08',
    surfaceRecessed: '#0c0a07',      // Deepest black inset
    cardBorder: '#2e281f',

    // Foreground & Typography (Linen / Bone / Ivory)
    linen: '#f7f3ee',                // Primary high contrast linen text
    linenDim: '#eae1d7',             // Secondary warm linen
    linenMuted: '#9c958c',           // Muted caption stone
    linenWhisper: '#736d64',         // Very subtle footer whisper text
    foreground: '#f7f3ee',
    foregroundMuted: '#9c958c',

    // Primary Accents (Warm Sandstone & Gold)
    sandstone: '#c8b29b',            // Warm sandstone gold primary
    sandstoneLight: '#d8c4ad',       // Highlight sandstone
    sandstoneHover: '#dfd0be',
    sandstoneDark: '#b59e85',
    sandstoneTint: 'rgba(200, 178, 155, 0.12)',
    sandstoneBorder: 'rgba(200, 178, 155, 0.25)',
    primary: '#c8b29b',
    primaryForeground: '#110e08',

    // Secondary & Dark Accents
    secondary: '#221e17',
    secondaryForeground: '#eae1d7',
    accent: '#262119',
    accentForeground: '#f7f3ee',

    // Muted
    muted: '#16130d',
    mutedForeground: '#9c958c',

    // Borders & Dividers
    border: '#2e281f',               // Hairline stone border
    borderLight: '#3f3931',          // Subtle divider
    borderHairline: 'rgba(200, 178, 155, 0.12)',

    // Status Colors (Editorial & Tech Clean)
    success: '#4ade80',              // Mint / Emerald success
    successGlow: '#4ade80',
    running: '#fbbf24',              // Amber running state
    failed: '#f87171',               // Coral / Red error
    destructive: '#f87171',
    destructiveForeground: '#fff1f2',
    skipped: '#71717a',              // Zinc gray skipped

    // Glows & Gradients
    glow: '#c8b29b',
    glowStrong: '#dfd0be',
    gradientFrom: '#c8b29b',
    gradientMid: '#dfd0be',
    gradientTo: '#e5cdb5',

    // Sage / Community / YouTube Accents
    sage: '#7a9e7e',
    sageGlow: '#4f7259',
    amber: '#d4a359',
    youtubeRed: '#ef4444',
};

export const spacing = {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
};

export const borderRadius = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    full: 9999,
};

export const typography = {
    fontSizeXs: 10,
    fontSizeSm: 12,
    fontSizeMd: 14,
    fontSizeLg: 16,
    fontSizeXl: 18,
    fontSizeXxl: 22,
    fontSizeDisplay: 26,

    fontWeightNormal: '400' as const,
    fontWeightMedium: '500' as const,
    fontWeightSemibold: '600' as const,
    fontWeightBold: '700' as const,
    fontWeightBlack: '800' as const,
};

export const shadows = {
    subtle: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        elevation: 3,
    },
    sm: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 5,
        elevation: 2,
    },
    md: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 5,
    },
    lg: {
        shadowColor: '#c8b29b',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    glowSandstone: {
        shadowColor: '#c8b29b',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 6,
    },
    glowPrimary: {
        shadowColor: '#c8b29b',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 6,
    },
    glowSuccess: {
        shadowColor: '#4ade80',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
    glowRunning: {
        shadowColor: '#fbbf24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 5,
    },
};

export const gradients = {
    primary: ['#c8b29b', '#dfd0be', '#c8b29b'] as const,
    subtle: ['#16130d', '#110e08'] as const,
    card: ['#1c1811', '#16130d'] as const,
    cardActive: ['#221e17', '#191610'] as const,
    sandstone: ['#c8b29b', '#d9c4af'] as const,
    hero: ['#1c1811', '#14110b'] as const,
    success: ['#065f46', '#4ade80'] as const,
    danger: ['#991b1b', '#f87171'] as const,
};

export const motion = {
    fast: 200,
    springConfig: {
        tension: 180,
        friction: 12,
    }
};


