// Storage keys and default configuration for the mobile app
// Zero hardcoded backend URLs — user connects their own backend on first launch (BYOK)

export const STORAGE_KEYS = {
    API_BASE_URL: '@channel_pilot:api_base_url',
    CHANNEL_GENRE: '@channel_pilot:channel_genre',
    CUSTOM_GENRE_PROMPT: '@channel_pilot:custom_genre_prompt',
    AUTH_TOKEN: '@channel_pilot:auth_token',
    SETUP_COMPLETED: '@channel_pilot:setup_completed',
};

export const GENRE_PRESETS = [
    {
        id: 'tech',
        label: 'Software & Tech Forensics',
        icon: 'code-slash-outline',
        description: 'Systems architecture, OS primitives, database internals & engineering deep-dives',
    },
    {
        id: 'space',
        label: 'Space, Cosmology & Physics',
        icon: 'planet-outline',
        description: 'Black holes, astrophysics, quantum enigmas & deep space exploration',
    },
    {
        id: 'history',
        label: 'History & Ancient Mysteries',
        icon: 'hourglass-outline',
        description: 'Lost civilizations, ancient tactical masterstrokes & declassified cold war files',
    },
    {
        id: 'finance',
        label: 'Finance, Markets & Economy',
        icon: 'trending-up-outline',
        description: 'Macroeconomics, market collapses, corporate scandals & liquidity cycles',
    },
    {
        id: 'crime',
        label: 'True Crime & Psychological Enigmas',
        icon: 'finger-print-outline',
        description: 'Baffling unsolved disappearances, cognitive traps & forensic investigation',
    },
    {
        id: 'science',
        label: 'Biology, Neuroscience & Nature',
        icon: 'flask-outline',
        description: 'Human cognition, biological marvels & awe-inspiring scientific phenomena',
    },
    {
        id: 'custom',
        label: 'Custom Niche',
        icon: 'create-outline',
        description: 'Enter your own custom channel audience and storytelling persona',
    },
];
