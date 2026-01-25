/**
 * UI-related constants
 */

export const UI_CONSTANTS = {
  // Viewport modes
  VIEWPORT_MODES: {
    AUTO: 'auto',
    MOBILE: 'mobile',
    DESKTOP: 'desktop',
  } as const,
  
  // Time ranges for events (in hours)
  EVENT_TIME_RANGES: {
    ONE_HOUR: 1,
    SIX_HOURS: 6,
    TWENTY_FOUR_HOURS: 24,
    SEVEN_DAYS: 168,
    THIRTY_DAYS: 720,
  } as const,
  
  // Default dashboard days
  DEFAULT_DASHBOARD_DAYS: 14,
  
  // Refresh intervals (in milliseconds)
  REFRESH_INTERVALS: {
    STATUS_BADGES: 10000, // 10 seconds
    SYSTEM_RESOURCES: 30000, // 30 seconds
    EVENTS: 30000, // 30 seconds
  } as const,
  
  // Breakpoints (matching Tailwind)
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536,
  } as const,
} as const;
