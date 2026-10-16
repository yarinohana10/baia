export const STORE_TIME_ZONE = 'Asia/Jerusalem';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Offset (ms) of `timeZone` from UTC at the given instant, e.g. +3h in Israeli summer. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Last millisecond of the given calendar day (`YYYY-MM-DD`) in the store's
 * time zone, so a coupon "valid until 2026-08-31" works all of that day in
 * Israel. DST-safe: the offset is re-read at the computed instant.
 */
export function endOfStoreDay(date: string, timeZone = STORE_TIME_ZONE): Date {
  const m = DATE_ONLY.exec(date);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got "${date}"`);
  const nextMidnightWall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1);
  let instant = nextMidnightWall - zoneOffsetMs(nextMidnightWall, timeZone);
  instant = nextMidnightWall - zoneOffsetMs(instant, timeZone);
  return new Date(instant - 1);
}

/** Date-only strings mean "until the end of that day in Israel"; full timestamps are kept as-is. */
export function parseCouponExpiry(value: string | null | undefined): Date | null {
  if (!value) return null;
  return DATE_ONLY.test(value) ? endOfStoreDay(value) : new Date(value);
}
