'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDashboardData } from '@/hooks/admin/useDashboardData';
import { isDashboardEmpty } from '@/hooks/admin/dashboard-data';
import { DEFAULT_RANGE, type RangeSelection } from '@/lib/admin/analytics-range';
import { Button } from '@/components/ui/button';
import { DashboardBody } from '@/components/admin/dashboard/DashboardBody';
import { DashboardRangeBar } from '@/components/admin/dashboard/DashboardRangeBar';
import { NeedsAttention } from '@/components/admin/dashboard/NeedsAttention';

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const [selection, setSelection] = useState<RangeSelection>(DEFAULT_RANGE);
  const { data, loading, counts, reload } = useDashboardData(selection);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-[32px] leading-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <NeedsAttention attention={data.attention} counts={counts} />

      <DashboardRangeBar
        selection={selection}
        onChange={setSelection}
        resolved={data.summary?.range ?? data.sales?.range ?? null}
        loading={loading}
      />

      {isDashboardEmpty(data) ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <p role="alert" className="font-body text-sm text-muted-foreground">
            {t('sectionFailed')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={reload}>
            {t('retry')}
          </Button>
        </div>
      ) : (
        <DashboardBody data={data} selection={selection} loading={loading} onRetry={reload} />
      )}
    </div>
  );
}
