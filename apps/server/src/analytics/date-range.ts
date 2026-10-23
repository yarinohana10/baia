import { BadRequestException } from '@nestjs/common';

/**
 * Date-range model shared by every analytics endpoint. All calendar logic is in
 * the store's time zone (Asia/Jerusalem, weeks start on Sunday) whatever the
 * server's own time zone is, and is DST-safe: a day is a calendar date, never "24 hours".
 */
export const STORE_TIME_ZONE = 'Asia/Jerusalem';

export const RANGE_PRESETS = [
  'today',
  'yesterday',
  'this_week',
  'last_7_days',
  'this_month',
  'last_30_days',
  'this_year',
  'all_time',
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type Bucket = 'day' | 'week' | 'month';

/** Longest custom range accepted (keeps series and CSV exports bounded). */
export const MAX_RANGE_DAYS = 1100;

/** A run of whole Israel calendar days. */
export type DayRange = {
  /** First day, YYYY-MM-DD, inclusive. */
  fromDay: string;
  /** Last day, YYYY-MM-DD, inclusive. */
  toDay: string;
  days: number;
  /** Instant the first day starts (inclusive). */
  from: Date;
  /** Instant the day after the last day starts (exclusive). */
  to: Date;
};

export type ResolvedRange = DayRange & {
  /** The preset used, or 'custom'. */
  preset: RangePreset | 'custom';
  bucket: Bucket;
  /** The immediately preceding period of equal length; null for all time. */
  previous: DayRange | null;
};

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: STORE_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** The Israel calendar day (YYYY-MM-DD) an instant falls on. */
export function dayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

function keyToUtcMs(key: string): number {
  const m = DAY_KEY.exec(key);
  if (!m) throw new Error(`Invalid day key: ${key}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function utcMsToKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** `key` moved by `delta` calendar days (negative = earlier). */
export function addDays(key: string, delta: number): string {
  return utcMsToKey(keyToUtcMs(key) + delta * MS_PER_DAY);
}

/** Calendar days from `a` to `b` (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((keyToUtcMs(b) - keyToUtcMs(a)) / MS_PER_DAY);
}

/** Israel's UTC offset in minutes at an instant (+120 winter, +180 summer). */
function offsetMinutes(instant: Date): number {
  const p: Record<string, number> = {};
  for (const part of partsFormat.formatToParts(instant)) {
    if (part.type !== 'literal') p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** The instant a calendar day starts (00:00 Israel time). */
export function startOfDay(key: string): Date {
  const local = keyToUtcMs(key);
  // The offset in force at midnight; re-checked once because the guess can sit on the other side of a switch.
  let instant = local - offsetMinutes(new Date(local - 3 * 3_600_000)) * 60_000;
  const second = offsetMinutes(new Date(instant)) * 60_000;
  if (local - second !== instant) instant = local - second;
  return new Date(instant);
}

/** Sunday of the week containing `key`. */
export function startOfWeek(key: string): string {
  const dow = new Date(keyToUtcMs(key)).getUTCDay(); // 0 = Sunday
  return addDays(key, -dow);
}

export function startOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

function startOfYear(key: string): string {
  return `${key.slice(0, 4)}-01-01`;
}

function dayRange(fromDay: string, toDay: string): DayRange {
  return {
    fromDay,
    toDay,
    days: diffDays(fromDay, toDay) + 1,
    from: startOfDay(fromDay),
    to: startOfDay(addDays(toDay, 1)),
  };
}

/** Day buckets up to ~2 months, week buckets up to ~a year, month buckets beyond. */
export function bucketFor(days: number): Bucket {
  if (days <= 62) return 'day';
  if (days <= 370) return 'week';
  return 'month';
}

function isRealDay(key: string): boolean {
  if (!DAY_KEY.test(key)) return false;
  return utcMsToKey(keyToUtcMs(key)) === key;
}

export type RangeInput = { preset?: string; from?: string; to?: string };

/**
 * Turns a request into a concrete range. `from`/`to` (YYYY-MM-DD, inclusive,
 * Israel days) win over `preset`; with neither the default is the last 30 days.
 * `earliest` (first order) anchors "all time".
 */
export function resolveRange(input: RangeInput, now = new Date(), earliest?: Date | null): ResolvedRange {
  const today = dayKey(now);

  if (input.from !== undefined || input.to !== undefined) {
    if (input.from === undefined) throw new BadRequestException('`to` needs `from`');
    const fromDay = input.from;
    const toDay = input.to ?? today;
    if (!isRealDay(fromDay) || !isRealDay(toDay)) throw new BadRequestException('Dates must be real YYYY-MM-DD days');
    if (fromDay > toDay) throw new BadRequestException('`from` must not be after `to`');
    const range = dayRange(fromDay, toDay);
    if (range.days > MAX_RANGE_DAYS) throw new BadRequestException(`Range is limited to ${MAX_RANGE_DAYS} days`);
    return withPrevious(range, 'custom');
  }

  const preset = (input.preset ?? 'last_30_days') as RangePreset;
  if (!RANGE_PRESETS.includes(preset)) throw new BadRequestException('Unknown preset');

  switch (preset) {
    case 'today':
      return withPrevious(dayRange(today, today), preset);
    case 'yesterday': {
      const y = addDays(today, -1);
      return withPrevious(dayRange(y, y), preset);
    }
    case 'this_week':
      return withPrevious(dayRange(startOfWeek(today), today), preset);
    case 'last_7_days':
      return withPrevious(dayRange(addDays(today, -6), today), preset);
    case 'this_month':
      return withPrevious(dayRange(startOfMonth(today), today), preset);
    case 'last_30_days':
      return withPrevious(dayRange(addDays(today, -29), today), preset);
    case 'this_year':
      return withPrevious(dayRange(startOfYear(today), today), preset);
    case 'all_time': {
      const first = earliest ? dayKey(earliest) : today;
      return { ...dayRange(first > today ? today : first, today), preset, bucket: bucketFor(diffDays(first, today) + 1), previous: null };
    }
  }
}

function withPrevious(range: DayRange, preset: ResolvedRange['preset']): ResolvedRange {
  const previous = dayRange(addDays(range.fromDay, -range.days), addDays(range.fromDay, -1));
  return { ...range, preset, bucket: bucketFor(range.days), previous };
}

/** The bucket a day belongs to, named by its first day (Sunday for weeks, the 1st for months). */
export function bucketKey(day: string, bucket: Bucket): string {
  if (bucket === 'week') return startOfWeek(day);
  if (bucket === 'month') return startOfMonth(day);
  return day;
}

/** Every bucket key covering the range, oldest first (empty buckets included). */
export function bucketKeys(range: Pick<DayRange, 'fromDay' | 'toDay'>, bucket: Bucket): string[] {
  const keys: string[] = [];
  let key = bucketKey(range.fromDay, bucket);
  while (key <= range.toDay) {
    keys.push(key);
    if (bucket === 'day') key = addDays(key, 1);
    else if (bucket === 'week') key = addDays(key, 7);
    else {
      const y = Number(key.slice(0, 4));
      const m = Number(key.slice(5, 7));
      key = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    }
  }
  return keys;
}

/** % change from `previous` to `current`; null when there is nothing to compare against. */
export function changePct(current: number, previous: number): number | null {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
