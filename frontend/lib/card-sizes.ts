/**
 * Unified card size system
 * Provides consistent sizing for card components across the application
 */

export type CardSize = 'compact' | 'default' | 'spacious';

export interface CardSizeClasses {
  padding: string;
  gap?: string;
  minHeight?: string;
}

export const cardSizeClasses: Record<CardSize, CardSizeClasses> = {
  compact: {
    padding: 'p-3',
    gap: 'gap-2',
  },
  default: {
    padding: 'p-4',
    gap: 'gap-3',
  },
  spacious: {
    padding: 'p-6',
    gap: 'gap-4',
    minHeight: 'min-h-[200px]',
  },
};

/**
 * Get size classes for a card
 */
export function getCardSizeClasses(size: CardSize = 'default'): CardSizeClasses {
  return cardSizeClasses[size];
}

/**
 * Standard card heights for consistent layout
 */
export const cardHeights = {
  compact: 'h-[90px]',
  default: 'h-[110px]',
  spacious: 'h-[140px]',
  auto: 'h-auto',
} as const;
