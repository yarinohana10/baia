import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  // Ignore the browser language and the last-used-locale cookie: "/" always opens in
  // English. Visitors switch to Hebrew with the language button (the /he URLs).
  localeDetection: false,
});
