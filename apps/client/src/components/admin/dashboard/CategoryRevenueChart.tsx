'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatCount } from '@/lib/admin/analytics-format';
import { formatWholeShekels } from '@/lib/admin/format';
import { SERIES_COLOR } from './constants';
import { HBarList } from './HBarList';
import { SegmentedToggle } from './SegmentedToggle';
import type { RevenueByCategory } from './types';

type Level = 'topLevel' | 'byType';

/** Line revenue of the range by audience (top-level category) or by product type. */
export function CategoryRevenueChart({ data }: { data: RevenueByCategory }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const [level, setLevel] = useState<Level>('topLevel');
  const rows = data[level];

  return (
    <div className="space-y-4">
      <SegmentedToggle
        label={t('category.groupBy')}
        value={level}
        onChange={setLevel}
        options={[
          { value: 'topLevel', label: t('category.audience') },
          { value: 'byType', label: t('category.type') },
        ]}
      />
      {rows.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noRevenueData')}</p>
      ) : (
        <HBarList
          color={SERIES_COLOR}
          rows={rows.map((r) => ({
            key: r.categoryId,
            label: locale === 'he' ? r.nameHe : r.nameEn,
            sublabel: level === 'byType' ? (locale === 'he' ? r.parentNameHe : r.parentNameEn) ?? undefined : undefined,
            value: r.revenue,
            valueLabel: formatWholeShekels(r.revenue),
            note: `${formatCount(r.units, locale)} ${t('units')} · ${formatCount(r.orders, locale)} ${t('top.orders')}`,
          }))}
        />
      )}
    </div>
  );
}
