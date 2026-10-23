export type Bucket = 'day' | 'week' | 'month';
type Locale = 'he' | 'en';

const tag = (locale: Locale) => (locale === 'he' ? 'he-IL' : 'en-IL');

// Bucket keys are plain calendar dates, so they are formatted in UTC to keep the date as written.
const DAY: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-IL', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
};
const DAY_FULL: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-IL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
};
const MONTH: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-IL', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
};
const MONTH_FULL: Record<Locale, Intl.DateTimeFormat> = {
  he: new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
  en: new Intl.DateTimeFormat('en-IL', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
};

const asDate = (key: string) => new Date(`${key}T00:00:00Z`);

/** Short axis label for a bucket start (`20 Oct`, `Oct 26`). */
export function formatBucketAxis(key: string, bucket: Bucket, locale: string): string {
  const l: Locale = locale === 'he' ? 'he' : 'en';
  return (bucket === 'month' ? MONTH[l] : DAY[l]).format(asDate(key));
}

/** Full label for tooltips and tables; weeks are named by their first day via `weekOf`. */
export function formatBucketFull(key: string, bucket: Bucket, locale: string, weekOf: (date: string) => string): string {
  const l: Locale = locale === 'he' ? 'he' : 'en';
  if (bucket === 'month') return MONTH_FULL[l].format(asDate(key));
  const day = DAY_FULL[l].format(asDate(key));
  return bucket === 'week' ? weekOf(day) : day;
}

/** A plain calendar day (`2026-10-19`) as `19 Oct 2026`. */
export function formatDay(key: string, locale: string): string {
  return DAY_FULL[locale === 'he' ? 'he' : 'en'].format(asDate(key));
}

export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(tag(locale === 'he' ? 'he' : 'en')).format(value);
}
