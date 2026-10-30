import type { SizeGuide } from '@/lib/catalog/size-guides';

/**
 * Admin editor state for one size guide. Lists carry a client-only `key` so
 * React keeps inputs stable while rows move; `guidePayload` strips it.
 */

export type RowDraft = { key: string; labelHe: string; labelEn: string; values: string[] };
export type TableDraft = {
  key: string;
  titleHe: string;
  titleEn: string;
  noteHe: string;
  noteEn: string;
  columns: string[];
  rows: RowDraft[];
};
export type StepDraft = { key: string; titleHe: string; titleEn: string; bodyHe: string; bodyEn: string };
export type TipDraft = { key: string; he: string; en: string };

export type GuideDraft = {
  slug: string;
  nameHe: string;
  nameEn: string;
  introHe: string;
  introEn: string;
  imageAltHe: string;
  imageAltEn: string;
  isActive: boolean;
  sortOrder: number;
  tables: TableDraft[];
  steps: StepDraft[];
  tips: TipDraft[];
};

let seq = 0;
/** Stable list key for a new draft item. */
export const newKey = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;

export const DEFAULT_COLUMNS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export const emptyRow = (columns: number): RowDraft => ({ key: newKey(), labelHe: '', labelEn: '', values: Array(columns).fill('') });

export const emptyTable = (): TableDraft => ({
  key: newKey(),
  titleHe: '',
  titleEn: '',
  noteHe: '',
  noteEn: '',
  columns: [...DEFAULT_COLUMNS],
  rows: [emptyRow(DEFAULT_COLUMNS.length)],
});

export const emptyStep = (): StepDraft => ({ key: newKey(), titleHe: '', titleEn: '', bodyHe: '', bodyEn: '' });
export const emptyTip = (): TipDraft => ({ key: newKey(), he: '', en: '' });

export const EMPTY_GUIDE: GuideDraft = {
  slug: '',
  nameHe: '',
  nameEn: '',
  introHe: '',
  introEn: '',
  imageAltHe: '',
  imageAltEn: '',
  isActive: true,
  sortOrder: 0,
  tables: [],
  steps: [],
  tips: [],
};

export function guideToDraft(g: SizeGuide): GuideDraft {
  return {
    slug: g.slug,
    nameHe: g.nameHe,
    nameEn: g.nameEn,
    introHe: g.introHe ?? '',
    introEn: g.introEn ?? '',
    imageAltHe: g.imageAltHe ?? '',
    imageAltEn: g.imageAltEn ?? '',
    isActive: g.isActive,
    sortOrder: g.sortOrder,
    tables: g.tables.map((t) => ({
      key: newKey(),
      titleHe: t.titleHe,
      titleEn: t.titleEn,
      noteHe: t.noteHe ?? '',
      noteEn: t.noteEn ?? '',
      columns: [...t.columns],
      rows: t.rows.map((r) => ({ key: newKey(), labelHe: r.labelHe, labelEn: r.labelEn, values: t.columns.map((_, i) => r.values[i] ?? '') })),
    })),
    steps: g.steps.map((s) => ({ key: newKey(), ...s })),
    tips: g.tips.map((tip) => ({ key: newKey(), ...tip })),
  };
}

const omitKey = <T extends { key: string }>({ key: _key, ...rest }: T) => rest;

/** API body (PUT/POST /admin/size-guides). Empty optional texts become null on the server. */
export function guidePayload(d: GuideDraft) {
  return {
    ...d,
    tables: d.tables.map((t) => ({ ...omitKey(t), rows: t.rows.map(omitKey) })),
    steps: d.steps.map(omitKey),
    tips: d.tips.map(omitKey),
  };
}

// ─── Table edits (all return a new table) ─────────────────────

export function addColumn(t: TableDraft, label = ''): TableDraft {
  return { ...t, columns: [...t.columns, label], rows: t.rows.map((r) => ({ ...r, values: [...r.values, ''] })) };
}

export function removeColumn(t: TableDraft, index: number): TableDraft {
  if (t.columns.length <= 1) return t;
  return {
    ...t,
    columns: t.columns.filter((_, i) => i !== index),
    rows: t.rows.map((r) => ({ ...r, values: r.values.filter((_, i) => i !== index) })),
  };
}

export function renameColumn(t: TableDraft, index: number, label: string): TableDraft {
  return { ...t, columns: t.columns.map((c, i) => (i === index ? label : c)) };
}

export function addRow(t: TableDraft): TableDraft {
  return { ...t, rows: [...t.rows, emptyRow(t.columns.length)] };
}

export function removeRow(t: TableDraft, key: string): TableDraft {
  return t.rows.length <= 1 ? t : { ...t, rows: t.rows.filter((r) => r.key !== key) };
}

export function updateRow(t: TableDraft, key: string, changes: Partial<Omit<RowDraft, 'key'>>): TableDraft {
  return { ...t, rows: t.rows.map((r) => (r.key === key ? { ...r, ...changes } : r)) };
}

export function setCell(t: TableDraft, rowKey: string, column: number, value: string): TableDraft {
  return {
    ...t,
    rows: t.rows.map((r) => (r.key === rowKey ? { ...r, values: r.values.map((v, i) => (i === column ? value : v)) } : r)),
  };
}

// ─── List helpers ─────────────────────────────────────────────

/** Moves the item with `key` one place up (-1) or down (+1); no-op at the ends. */
export function moveItem<T extends { key: string }>(list: T[], key: string, direction: -1 | 1): T[] {
  const from = list.findIndex((item) => item.key === key);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function replaceItem<T extends { key: string }>(list: T[], key: string, changes: Partial<T>): T[] {
  return list.map((item) => (item.key === key ? { ...item, ...changes } : item));
}

export const removeItem = <T extends { key: string }>(list: T[], key: string): T[] => list.filter((item) => item.key !== key);

// ─── Validation (mirrors the API rules, so mistakes show before saving) ──

export type GuideIssue =
  | 'name'
  | 'slug'
  | 'tableTitle'
  | 'columnLabel'
  | 'duplicateColumn'
  | 'rowLabel'
  | 'stepText'
  | 'tipText';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const blank = (s: string) => s.trim() === '';

/** Problems that would make the API reject the guide, each reported once. */
export function guideIssues(d: GuideDraft): GuideIssue[] {
  const issues = new Set<GuideIssue>();
  if (blank(d.nameHe) || blank(d.nameEn)) issues.add('name');
  if (!SLUG.test(d.slug.trim())) issues.add('slug');
  for (const t of d.tables) {
    if (blank(t.titleHe) || blank(t.titleEn)) issues.add('tableTitle');
    if (t.columns.some(blank)) issues.add('columnLabel');
    const labels = t.columns.map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (new Set(labels).size !== labels.length) issues.add('duplicateColumn');
    if (t.rows.some((r) => blank(r.labelHe) || blank(r.labelEn))) issues.add('rowLabel');
  }
  if (d.steps.some((s) => blank(s.titleHe) || blank(s.titleEn) || blank(s.bodyHe) || blank(s.bodyEn))) issues.add('stepText');
  if (d.tips.some((tip) => blank(tip.he) || blank(tip.en))) issues.add('tipText');
  return [...issues];
}
