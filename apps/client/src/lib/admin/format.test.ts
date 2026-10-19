import { describe, expect, it } from 'vitest';
import { formatAdminDate, formatWholeShekels, toStoreDay } from './format';

describe('admin formatting', () => {
  // 22:30 UTC on Jan 31st is already Feb 1st in Israel (UTC+2).
  const lateNight = '2026-01-31T22:30:00.000Z';

  it('formats dates in the store time zone', () => {
    expect(toStoreDay(lateNight)).toBe('2026-02-01');
    expect(formatAdminDate(lateNight, 'en', 'short')).toBe('01/02/2026');
    expect(formatAdminDate(lateNight, 'en', 'shortTime')).toMatch(/^01\/02\/2026, 0?0:30$/);
  });

  it('rounds to whole shekels', () => {
    expect(formatWholeShekels(1234.6)).toBe('₪1,235');
  });
});
