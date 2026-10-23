/** Date ranges the admin dashboard can ask the analytics API for (days are Israel calendar days). */
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

export type RangeSelection =
  | { kind: 'preset'; preset: RangePreset }
  | { kind: 'custom'; from: string; to: string };

export const DEFAULT_RANGE: RangeSelection = { kind: 'preset', preset: 'last_30_days' };

/** Longest custom range the API accepts, in days. */
export const MAX_CUSTOM_DAYS = 1100;

/** Query string params for any `/admin/analytics/*` range endpoint. */
export function rangeParams(selection: RangeSelection): Record<string, string> {
  return selection.kind === 'preset' ? { preset: selection.preset } : { from: selection.from, to: selection.to };
}

/** Stable identity of a selection (used to detect that a result belongs to an older one). */
export function rangeKey(selection: RangeSelection): string {
  return selection.kind === 'preset' ? selection.preset : `${selection.from}..${selection.to}`;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function dayMs(key: string): number | null {
  const m = DAY.exec(key);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ms).toISOString().slice(0, 10) === key ? ms : null;
}

export type CustomRangeProblem = 'incomplete' | 'order' | 'tooLong';

/** Why a from/to pair cannot be applied, or null when it can. */
export function customRangeProblem(from: string, to: string): CustomRangeProblem | null {
  const a = dayMs(from);
  const b = dayMs(to);
  if (a === null || b === null) return 'incomplete';
  if (a > b) return 'order';
  if ((b - a) / 86_400_000 + 1 > MAX_CUSTOM_DAYS) return 'tooLong';
  return null;
}

/** "+12.5%" / "-3%" / "0%": one decimal only when needed. */
export function formatPercent(value: number, locale: string): string {
  const abs = new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-IL', { maximumFractionDigits: 1 }).format(Math.abs(value));
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${abs}%`;
}
