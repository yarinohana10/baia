/**
 * Order date formatters, built once in the store's time zone so the server
 * and the browser render the same text (and the 48-hour cancellation window
 * reads in the store's clock wherever the shopper is).
 */

type LocaleFormats = { he: Intl.DateTimeFormat; en: Intl.DateTimeFormat };

const TIME_ZONE = 'Asia/Jerusalem';

/** "14 Oct 2026, 10:32" (order page header). */
export const ORDER_DATE_TIME: LocaleFormats = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE }),
  en: new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE }),
};

/** "14 Oct 2026" (account orders list). */
export const ORDER_DATE: LocaleFormats = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeZone: TIME_ZONE }),
  en: new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeZone: TIME_ZONE }),
};

/** "14.10.2026" (cancellation request date). */
export const SHORT_DATE: LocaleFormats = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: TIME_ZONE }),
  en: new Intl.DateTimeFormat('en-IL', { dateStyle: 'short', timeZone: TIME_ZONE }),
};

/** "14.10" (timeline steps). */
export const DAY_MONTH: LocaleFormats = {
  he: new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', timeZone: TIME_ZONE }),
  en: new Intl.DateTimeFormat('en-IL', { day: 'numeric', month: 'numeric', timeZone: TIME_ZONE }),
};

/** "Sunday 14:30, 3.6" (free-cancellation deadline). */
export const DEADLINE: LocaleFormats = {
  he: new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }),
  en: new Intl.DateTimeFormat('en-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }),
};

/** Formats an ISO timestamp with one of the formatters above in the shopper's locale. */
export function formatOrderDate(formats: LocaleFormats, iso: string, locale: string): string {
  return formats[locale === 'he' ? 'he' : 'en'].format(new Date(iso));
}
