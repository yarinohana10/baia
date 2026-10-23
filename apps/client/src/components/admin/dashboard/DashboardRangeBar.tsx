'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarRange } from 'lucide-react';
import { formatDay } from '@/lib/admin/analytics-format';
import {
  RANGE_PRESETS,
  customRangeProblem,
  rangeKey,
  type RangeSelection,
} from '@/lib/admin/analytics-range';
import { toStoreDay } from '@/lib/admin/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PRESET_LABEL_KEYS } from './constants';
import type { Summary } from './types';

type DashboardRangeBarProps = {
  selection: RangeSelection;
  onChange: (selection: RangeSelection) => void;
  /** The range the server resolved, shown under the buttons. */
  resolved: Summary['range'] | null;
  loading: boolean;
};

const chip = (selected: boolean) =>
  `rounded-full border px-3 py-1.5 font-body text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
    selected ? 'border-ocean-700 bg-ocean-700 text-white' : 'border-border bg-card text-foreground hover:bg-muted'
  }`;

/** Sticky date-range filter: presets first, a custom from/to behind "Custom". Everything below follows it. */
export function DashboardRangeBar({ selection, onChange, resolved, loading }: DashboardRangeBarProps) {
  const t = useTranslations('admin.dashboard.range');
  const locale = useLocale();
  const today = toStoreDay(new Date());
  const [customOpen, setCustomOpen] = useState(selection.kind === 'custom');
  const [from, setFrom] = useState(selection.kind === 'custom' ? selection.from : '');
  const [to, setTo] = useState(selection.kind === 'custom' ? selection.to : today);
  const problem = customRangeProblem(from, to);
  const showCustom = customOpen || selection.kind === 'custom';

  const pick = (next: RangeSelection) => {
    if (rangeKey(next) !== rangeKey(selection)) onChange(next);
  };

  const summary = resolved
    ? resolved.fromDay === resolved.toDay
      ? formatDay(resolved.fromDay, locale)
      : t('showing', { from: formatDay(resolved.fromDay, locale), to: formatDay(resolved.toDay, locale) })
    : null;

  return (
    <div className="sticky top-16 z-20 -mx-4 mb-6 border-b border-border bg-muted/90 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('label')}>
        <CalendarRange size={16} className="text-ocean-700" aria-hidden="true" />
        {RANGE_PRESETS.map((preset) => {
          const selected = selection.kind === 'preset' && selection.preset === preset;
          return (
            <button key={preset} type="button" aria-pressed={selected} className={chip(selected)} onClick={() => pick({ kind: 'preset', preset })}>
              {t(PRESET_LABEL_KEYS[preset])}
            </button>
          );
        })}
        <button type="button" aria-pressed={selection.kind === 'custom'} aria-expanded={showCustom} className={chip(selection.kind === 'custom')} onClick={() => setCustomOpen(!showCustom)}>
          {t('custom')}
        </button>
      </div>

      {showCustom && (
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!problem) pick({ kind: 'custom', from, to });
          }}
        >
          <label className="flex flex-col gap-1 font-body text-xs text-muted-foreground">
            {t('from')}
            <Input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="w-40 bg-card" />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-muted-foreground">
            {t('to')}
            <Input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="w-40 bg-card" />
          </label>
          <Button type="submit" size="sm" disabled={problem !== null}>
            {t('apply')}
          </Button>
          {problem && from !== '' && (
            <p role="alert" className="font-body text-xs text-destructive">
              {t(`invalid.${problem}`)}
            </p>
          )}
        </form>
      )}

      <p className="mt-2 font-body text-xs text-muted-foreground" aria-live="polite">
        {summary}
        {summary && resolved && ` · ${t(`bucket.${resolved.bucket}`)}`}
        {resolved?.previous
          ? ` · ${t('comparedWith', { from: formatDay(resolved.previous.fromDay, locale), to: formatDay(resolved.previous.toDay, locale) })}`
          : resolved
            ? ` · ${t('noComparison')}`
            : null}
        {loading && ` · ${t('updating')}`}
      </p>
    </div>
  );
}
