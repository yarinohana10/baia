import { BadRequestException } from '@nestjs/common';
import {
  addDays,
  bucketFor,
  bucketKeys,
  changePct,
  dayKey,
  diffDays,
  resolveRange,
  startOfDay,
  startOfWeek,
} from '../src/analytics/date-range';
import { csvCell } from '../src/analytics/analytics.service';

// 2026-10-23 is a Friday. Israel is UTC+3 until the last Sunday of October (25th), then UTC+2.
const FRI = new Date('2026-10-23T09:00:00Z');

describe('Israel calendar days', () => {
  it('dayKey follows Israel time, not UTC', () => {
    expect(dayKey(new Date('2026-10-19T22:30:00Z'))).toBe('2026-10-20'); // 01:30 Israel
    expect(dayKey(new Date('2026-10-19T20:59:59Z'))).toBe('2026-10-19');
    expect(dayKey(new Date('2026-12-31T22:30:00Z'))).toBe('2027-01-01'); // UTC+2 in winter
  });

  it('a day starts at Israel midnight (summer +3, winter +2)', () => {
    expect(startOfDay('2026-07-01').toISOString()).toBe('2026-06-30T21:00:00.000Z');
    expect(startOfDay('2026-01-15').toISOString()).toBe('2026-01-14T22:00:00.000Z');
  });

  it('handles the March spring-forward (Fri 27 Mar 2026): that day is 24h, the next day starts at +3', () => {
    // Switch is at 02:00 on Friday 27 March 2026.
    expect(startOfDay('2026-03-26').toISOString()).toBe('2026-03-25T22:00:00.000Z');
    expect(startOfDay('2026-03-27').toISOString()).toBe('2026-03-26T22:00:00.000Z');
    expect(startOfDay('2026-03-28').toISOString()).toBe('2026-03-27T21:00:00.000Z');
    // 27 Mar is only 23 hours long.
    expect(startOfDay('2026-03-28').getTime() - startOfDay('2026-03-27').getTime()).toBe(23 * 3_600_000);
  });

  it('handles the October fall-back (Sun 25 Oct 2026): that day is 25h', () => {
    expect(startOfDay('2026-10-25').toISOString()).toBe('2026-10-24T21:00:00.000Z');
    expect(startOfDay('2026-10-26').toISOString()).toBe('2026-10-25T22:00:00.000Z');
    expect(startOfDay('2026-10-26').getTime() - startOfDay('2026-10-25').getTime()).toBe(25 * 3_600_000);
    // 23:30 UTC on the 25th is 01:30 on the 26th in winter time.
    expect(dayKey(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
    expect(dayKey(new Date('2026-10-25T21:30:00Z'))).toBe('2026-10-25');
  });

  it('day arithmetic crosses months and years', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(diffDays('2026-10-25', '2026-10-26')).toBe(1);
  });

  it('weeks start on Sunday', () => {
    expect(startOfWeek('2026-10-25')).toBe('2026-10-25'); // Sunday
    expect(startOfWeek('2026-10-24')).toBe('2026-10-18'); // Saturday
    expect(startOfWeek('2026-10-23')).toBe('2026-10-18'); // Friday
  });
});

describe('resolveRange', () => {
  const r = (input: Parameters<typeof resolveRange>[0], now = FRI) => resolveRange(input, now);

  it('defaults to the last 30 days', () => {
    const range = r({});
    expect(range).toMatchObject({ preset: 'last_30_days', fromDay: '2026-09-24', toDay: '2026-10-23', days: 30, bucket: 'day' });
    expect(range.previous).toMatchObject({ fromDay: '2026-08-25', toDay: '2026-09-23', days: 30 });
  });

  it.each([
    ['today', '2026-10-23', '2026-10-23'],
    ['yesterday', '2026-10-22', '2026-10-22'],
    ['this_week', '2026-10-18', '2026-10-23'],
    ['last_7_days', '2026-10-17', '2026-10-23'],
    ['this_month', '2026-10-01', '2026-10-23'],
    ['this_year', '2026-01-01', '2026-10-23'],
  ])('%s', (preset, fromDay, toDay) => {
    expect(r({ preset })).toMatchObject({ preset, fromDay, toDay });
  });

  it('uses the Israel day when UTC is still on the previous one', () => {
    const range = r({ preset: 'today' }, new Date('2026-10-22T22:30:00Z'));
    expect(range.fromDay).toBe('2026-10-23');
    expect(range.from.toISOString()).toBe('2026-10-22T21:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-10-23T21:00:00.000Z');
  });

  it('the previous period is the equal-length block right before', () => {
    const week = r({ preset: 'this_week' }); // Sun 18 .. Fri 23 = 6 days
    expect(week.days).toBe(6);
    expect(week.previous).toMatchObject({ fromDay: '2026-10-12', toDay: '2026-10-17', days: 6 });
    expect(week.previous!.to.getTime()).toBe(week.from.getTime());
    expect(r({ preset: 'yesterday' }).previous).toMatchObject({ fromDay: '2026-10-21', toDay: '2026-10-21' });
  });

  it('a range spanning the October DST change is exact in instants', () => {
    const range = r({ from: '2026-10-24', to: '2026-10-26' }, new Date('2026-11-05T10:00:00Z'));
    expect(range.days).toBe(3);
    expect(range.from.toISOString()).toBe('2026-10-23T21:00:00.000Z');
    expect(range.to.toISOString()).toBe('2026-10-26T22:00:00.000Z'); // 3 days = 73 hours
    expect(range.previous).toMatchObject({ fromDay: '2026-10-21', toDay: '2026-10-23' });
  });

  it('custom ranges: `to` defaults to today, and bad input is rejected', () => {
    expect(r({ from: '2026-10-20' })).toMatchObject({ preset: 'custom', toDay: '2026-10-23', days: 4 });
    expect(() => r({ to: '2026-10-20' })).toThrow(BadRequestException);
    expect(() => r({ from: '2026-10-21', to: '2026-10-20' })).toThrow(BadRequestException);
    expect(() => r({ from: '2026-02-30' })).toThrow(BadRequestException);
    expect(() => r({ from: 'nope' })).toThrow(BadRequestException);
    expect(() => r({ from: '2020-01-01', to: '2026-10-23' })).toThrow(/limited/);
    expect(() => r({ preset: 'forever' })).toThrow(BadRequestException);
  });

  it('all time starts on the first order day and has nothing to compare against', () => {
    const range = resolveRange({ preset: 'all_time' }, FRI, new Date('2025-03-01T10:00:00Z'));
    expect(range).toMatchObject({ preset: 'all_time', fromDay: '2025-03-01', toDay: '2026-10-23', previous: null });
    expect(resolveRange({ preset: 'all_time' }, FRI, null).days).toBe(1);
  });
});

describe('buckets', () => {
  it('chooses day, week or month by length', () => {
    expect(bucketFor(1)).toBe('day');
    expect(bucketFor(62)).toBe('day');
    expect(bucketFor(63)).toBe('week');
    expect(bucketFor(370)).toBe('week');
    expect(bucketFor(371)).toBe('month');
  });

  it('week buckets are named by their Sunday and cover the whole range', () => {
    const keys = bucketKeys({ fromDay: '2026-10-21', toDay: '2026-11-03' }, 'week');
    expect(keys).toEqual(['2026-10-18', '2026-10-25', '2026-11-01']);
  });

  it('month buckets roll over the year', () => {
    expect(bucketKeys({ fromDay: '2026-11-15', toDay: '2027-02-02' }, 'month')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
    ]);
  });

  it('day buckets are one per day', () => {
    expect(bucketKeys({ fromDay: '2026-03-26', toDay: '2026-03-29' }, 'day')).toHaveLength(4);
  });
});

describe('changePct', () => {
  it('computes the % change to one decimal', () => {
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(50, 100)).toBe(-50);
    expect(changePct(101, 300)).toBe(-66.3);
  });
  it('is null when the previous period is empty', () => {
    expect(changePct(10, 0)).toBeNull();
  });
});

describe('csvCell', () => {
  it('quotes, escapes and defangs spreadsheet formulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell(null)).toBe('');
    expect(csvCell(-5)).toBe('-5');
  });
});
