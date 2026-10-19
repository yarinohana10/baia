/**
 * Admin date and money formatting. Formatters are built once, with an explicit
 * locale and the store's time zone, so server and browser render the same text.
 */

export const STORE_TIME_ZONE = 'Asia/Jerusalem';

export type AdminDateStyle = 'short' | 'medium' | 'shortTime' | 'mediumTime';

const tz = STORE_TIME_ZONE;

/** short: 20/10/2026 · medium: 20 Oct 2026 · shortTime: 20/10/2026, 14:05 · mediumTime: 20 Oct 2026, 14:05 */
const DATE_FORMATTERS: Record<'he' | 'en', Record<AdminDateStyle, Intl.DateTimeFormat>> = {
  he: {
    short: new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: tz }),
    medium: new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeZone: tz }),
    shortTime: new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }),
    mediumTime: new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }),
  },
  en: {
    short: new Intl.DateTimeFormat('en-IL', { dateStyle: 'short', timeZone: tz }),
    medium: new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeZone: tz }),
    shortTime: new Intl.DateTimeFormat('en-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: tz }),
    mediumTime: new Intl.DateTimeFormat('en-IL', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }),
  },
};

/** Formats an ISO date (or Date) for the admin UI in the store's time zone. */
export function formatAdminDate(value: string | Date, locale: string, style: AdminDateStyle): string {
  const formatters = locale === 'he' ? DATE_FORMATTERS.he : DATE_FORMATTERS.en;
  return formatters[style].format(typeof value === 'string' ? new Date(value) : value);
}

const STORE_DAY_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` of the instant in Israel time (for `<input type="date">`). */
export function toStoreDay(value: string | Date): string {
  return STORE_DAY_FORMAT.format(typeof value === 'string' ? new Date(value) : value);
}

const WHOLE_SHEKELS = new Intl.NumberFormat('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** `₪1,234` — rounded to whole shekels (dashboard figures). */
export function formatWholeShekels(amount: number): string {
  return `₪${WHOLE_SHEKELS.format(amount)}`;
}
