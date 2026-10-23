'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import { SERIES_COLOR } from './constants';
import { HBarList } from './HBarList';
import { SegmentedToggle } from './SegmentedToggle';
import type { SalesBreakdown } from './types';

type By = 'byColor' | 'bySize';

/** Units sold by colour or by size in the range. */
export function SalesBreakdownList({ data }: { data: SalesBreakdown }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const [by, setBy] = useState<By>('byColor');
  const rows = data[by];

  return (
    <div className="space-y-4">
      <SegmentedToggle
        label={t('breakdown.groupBy')}
        value={by}
        onChange={setBy}
        options={[
          { value: 'byColor', label: t('breakdown.color') },
          { value: 'bySize', label: t('breakdown.size') },
        ]}
      />
      {rows.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noSalesDataYet')}</p>
      ) : (
        <HBarList
          color={SERIES_COLOR}
          rows={rows.map((r) => ({
            key: r.value,
            label: r.value,
            value: r.units,
            valueLabel: `${formatCount(r.units, locale)} ${t('units')}`,
            note: formatWholeShekels(r.revenue),
          }))}
        />
      )}
    </div>
  );
}
