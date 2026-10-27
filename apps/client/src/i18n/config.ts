export const locales = ['he', 'en'] as const;
export type Locale = (typeof locales)[number];
/** The site always opens in English; Hebrew is one click away in the language switcher. */
export const defaultLocale: Locale = 'en';
