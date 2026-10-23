import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
import { mergeMessages } from './merge-messages';

/**
 * Messages = the base file (messages/<locale>.json) deep-merged with the
 * per-feature files in messages/<locale>/, so features can own their strings.
 */
const FEATURE_FILES = ['legal', 'orders', 'catalog', 'analytics'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  const base = (await import(`../../messages/${locale}.json`)).default;
  const features = await Promise.all(
    FEATURE_FILES.map(async (name) => (await import(`../../messages/${locale}/${name}.json`)).default),
  );

  return {
    locale,
    messages: features.reduce(mergeMessages, base),
  };
});
