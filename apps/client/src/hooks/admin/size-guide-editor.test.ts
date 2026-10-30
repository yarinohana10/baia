import { describe, expect, it } from 'vitest';
import {
  EMPTY_GUIDE,
  addColumn,
  addRow,
  emptyTable,
  guideIssues,
  guidePayload,
  guideToDraft,
  moveItem,
  removeColumn,
  removeRow,
  setCell,
  type GuideDraft,
} from './size-guide-editor';
import type { SizeGuide } from '@/lib/catalog/size-guides';

const valid = (): GuideDraft => ({
  ...EMPTY_GUIDE,
  slug: 'women',
  nameHe: 'נשים',
  nameEn: 'Women',
  tables: [
    {
      ...emptyTable(),
      titleHe: 'מידות גוף',
      titleEn: 'Body',
      columns: ['S', 'M'],
      rows: [{ key: 'r1', labelHe: 'חזה', labelEn: 'Bust', values: ['80', '90'] }],
    },
  ],
});

describe('size guide editor', () => {
  it('keeps every row in step with the columns', () => {
    let t = valid().tables[0];
    t = addColumn(t, 'L');
    expect(t.columns).toEqual(['S', 'M', 'L']);
    expect(t.rows[0].values).toEqual(['80', '90', '']);
    t = removeColumn(t, 0);
    expect(t.columns).toEqual(['M', 'L']);
    expect(t.rows[0].values).toEqual(['90', '']);
    t = addRow(t);
    expect(t.rows[1].values).toEqual(['', '']);
    t = setCell(t, t.rows[1].key, 1, '100');
    expect(t.rows[1].values).toEqual(['', '100']);
  });

  it('never removes the last column or row', () => {
    const t = { ...valid().tables[0], columns: ['M'], rows: [{ key: 'r1', labelHe: 'a', labelEn: 'a', values: ['1'] }] };
    expect(removeColumn(t, 0)).toBe(t);
    expect(removeRow(t, 'r1')).toBe(t);
  });

  it('moves items within bounds', () => {
    const list = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    expect(moveItem(list, 'b', -1).map((i) => i.key)).toEqual(['b', 'a', 'c']);
    expect(moveItem(list, 'c', 1)).toBe(list);
  });

  it('reports what the API would reject', () => {
    expect(guideIssues(valid())).toEqual([]);
    const bad = valid();
    bad.slug = 'Women Size';
    bad.nameHe = ' ';
    bad.tables[0] = { ...bad.tables[0], columns: ['S', 's'] };
    bad.tips = [{ key: 't', he: 'טיפ', en: '' }];
    expect(guideIssues(bad).sort()).toEqual(['duplicateColumn', 'name', 'slug', 'tipText']);
  });

  it('round-trips a guide without the client-only keys', () => {
    const guide: SizeGuide = {
      id: 'g1',
      slug: 'women',
      nameHe: 'נשים',
      nameEn: 'Women',
      introHe: null,
      introEn: 'Intro',
      imageUrl: null,
      imageAltHe: null,
      imageAltEn: null,
      tables: [{ titleHe: 'ט', titleEn: 'T', columns: ['S', 'M'], rows: [{ labelHe: 'ח', labelEn: 'B', values: ['1'] }] }],
      steps: [{ titleHe: 'א', titleEn: 'A', bodyHe: 'ב', bodyEn: 'B' }],
      tips: [{ he: 'ט', en: 'T' }],
      isActive: true,
      sortOrder: 0,
      categories: [],
    };
    const payload = guidePayload(guideToDraft(guide));
    expect(payload.introHe).toBe('');
    // Short rows are padded to the column count.
    expect(payload.tables[0]).toEqual({ titleHe: 'ט', titleEn: 'T', noteHe: '', noteEn: '', columns: ['S', 'M'], rows: [{ labelHe: 'ח', labelEn: 'B', values: ['1', ''] }] });
    expect(payload.steps[0]).toEqual({ titleHe: 'א', titleEn: 'A', bodyHe: 'ב', bodyEn: 'B' });
    expect(payload.tips[0]).toEqual({ he: 'ט', en: 'T' });
  });
});
