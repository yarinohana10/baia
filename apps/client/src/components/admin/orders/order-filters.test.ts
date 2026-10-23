import { describe, expect, it } from 'vitest';
import { exportFileName, filterParams, isValidDay, listParams, normalizeRange } from './order-filters';

const none = { status: '', search: '', from: '', to: '' };

describe('isValidDay', () => {
  it('accepts real YYYY-MM-DD days only', () => {
    expect(isValidDay('2026-10-23')).toBe(true);
    expect(isValidDay('2028-02-29')).toBe(true);
    expect(isValidDay('2026-02-29')).toBe(false);
    expect(isValidDay('2026-13-01')).toBe(false);
    expect(isValidDay('23/10/2026')).toBe(false);
    expect(isValidDay('')).toBe(false);
  });
});

describe('normalizeRange', () => {
  it('keeps a valid range and drops unusable days', () => {
    expect(normalizeRange('2026-10-01', '2026-10-31')).toEqual({ from: '2026-10-01', to: '2026-10-31', reversed: false });
    expect(normalizeRange('2026-10-01', 'oops')).toEqual({ from: '2026-10-01', to: '', reversed: false });
    expect(normalizeRange('', '')).toEqual({ from: '', to: '', reversed: false });
  });

  it('allows a single day and flags a reversed range', () => {
    expect(normalizeRange('2026-10-05', '2026-10-05').reversed).toBe(false);
    expect(normalizeRange('2026-10-06', '2026-10-05')).toEqual({ from: '', to: '', reversed: true });
  });
});

describe('filterParams / listParams', () => {
  it('leaves empty filters out', () => {
    expect(filterParams(none)).toEqual({ status: undefined, search: undefined, from: undefined, to: undefined });
  });

  it('carries every filter, trimming the search', () => {
    const filters = { status: 'CANCELLED', search: ' BA-1001 ', from: '2026-10-01', to: '2026-10-31' };
    expect(filterParams(filters)).toEqual({ status: 'CANCELLED', search: 'BA-1001', from: '2026-10-01', to: '2026-10-31' });
    expect(listParams(filters, 3, 20)).toEqual({
      status: 'CANCELLED',
      search: 'BA-1001',
      from: '2026-10-01',
      to: '2026-10-31',
      page: 3,
      limit: 20,
    });
  });

  it('does not send a reversed range', () => {
    const params = filterParams({ ...none, from: '2026-10-31', to: '2026-10-01' });
    expect(params.from).toBeUndefined();
    expect(params.to).toBeUndefined();
  });
});

describe('exportFileName', () => {
  it('names the export after its filters', () => {
    expect(exportFileName(none)).toBe('baia-orders-start_today.csv');
    expect(exportFileName({ ...none, status: 'SHIPPED', from: '2026-10-01', to: '2026-10-31' })).toBe(
      'baia-orders-shipped-2026-10-01_2026-10-31.csv',
    );
  });
});
