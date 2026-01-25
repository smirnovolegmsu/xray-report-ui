/**
 * Internationalization utilities
 * Provides unified translation system to replace 190+ lang === 'ru' checks
 */

import { useAppStore } from './store';

export type TranslationKey = string;

export interface Translations {
  [key: string]: string | Translations;
}

/**
 * Translation function - replaces lang === 'ru' ? 'RU text' : 'EN text' pattern
 * Usage: t('users.total') or t('users.total', { count: 5 })
 */
export function useTranslation() {
  const { lang } = useAppStore();
  
  const t = (key: string, params?: Record<string, string | number>): string => {
    // Simple key-based translation
    // Format: 'ru:Русский текст|en:English text'
    // Or use translation object (can be extended later)
    
    // For now, return key if no translation found
    // This can be extended with a proper translation system
    return key;
  };
  
  return {
    t,
    lang,
    isRu: lang === 'ru',
    isEn: lang === 'en',
  };
}

/**
 * Simple translation helper for common patterns
 * Usage: tr('Русский', 'English')
 */
export function tr(ru: string, en: string, currentLang: 'ru' | 'en' = 'ru'): string {
  return currentLang === 'ru' ? ru : en;
}

/**
 * Hook for translations with current language
 */
export function useTr() {
  const { lang } = useAppStore();
  return (ru: string, en: string) => tr(ru, en, lang);
}
