import { describe, expect, it } from 'vitest';
import { csvBlob, csvCell } from './csv';
import { customRangeProblem, formatPercent, rangeKey, rangeParams } from './analytics-range';
import { formatBucketAxis, formatDay } from './analytics-format';

describe('range selection', () => {
  it('turns a selection into API params', () => {
    expect(rangeParams({ kind: 'preset', preset: 'this_week' })).toEqual({ preset: 'this_week' });
    expect(rangeParams({ kind: 'custom', from: '2026-10-01', to: '2026-10-05' })).toEqual({ from: '2026-10-01', to: '2026-10-05' });
    expect(rangeKey({ kind: 'custom', from: 'a', to: 'b' })).not.toBe(rangeKey({ kind: 'preset', preset: 'today' }));
  });

  it('validates custom ranges', () => {
    expect(customRangeProblem('2026-10-01', '2026-10-05')).toBeNull();
    expect(customRangeProblem('2026-10-01', '2026-10-01')).toBeNull();
    expect(customRangeProblem('', '2026-10-05')).toBe('incomplete');
    expect(customRangeProblem('2026-02-30', '2026-03-05')).toBe('incomplete');
    expect(customRangeProblem('2026-10-06', '2026-10-05')).toBe('order');
    expect(customRangeProblem('2020-01-01', '2026-10-05')).toBe('tooLong');
  });

  it('formats percent changes with an explicit sign', () => {
    expect(formatPercent(12.5, 'en')).toBe('+12.5%');
    expect(formatPercent(-3, 'en')).toBe('-3%');
    expect(formatPercent(0, 'en')).toBe('0%');
  });
});

describe('bucket and day labels', () => {
  it('keeps the calendar date as written (no time zone shift)', () => {
    expect(formatDay('2026-10-20', 'en')).toBe('20 Oct 2026');
    expect(formatBucketAxis('2026-10-20', 'day', 'en')).toBe('20 Oct');
    expect(formatBucketAxis('2026-10-01', 'month', 'en')).toMatch(/Oct.*26/);
  });
});

describe('csv', () => {
  it('quotes and defangs fields', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-4)).toBe('-4');
    expect(csvCell(null)).toBe('');
  });

  it('builds a UTF-8 blob with a BOM', async () => {
    const blob = csvBlob([['a', 'ב'], [1, 2]]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blob.text()).toBe('a,ב\r\n1,2\r\n');
  });
});
