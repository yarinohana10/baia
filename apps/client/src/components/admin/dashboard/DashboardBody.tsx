'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, BarChart3, Layers, Package, PieChart } from 'lucide-react';
import type { RangeSelection } from '@/lib/admin/analytics-range';
import { rangeParams } from '@/lib/admin/analytics-range';
import { Button } from '@/components/ui/button';
import { CategoryRevenueChart } from './CategoryRevenueChart';
import { DashboardKpis } from './DashboardKpis';
import { DashboardSectionCard } from './DashboardSectionCard';
import { DeliveredCard } from './DeliveredCard';
import { InventoryAlerts } from './InventoryAlerts';
import { OrdersByStatusChart } from './OrdersByStatusChart';
import { RecentActivityCard } from './RecentActivityCard';
import { SalesBreakdownList } from './SalesBreakdownCard';
import { SalesOverviewCard } from './SalesOverviewCard';
import { TopProductsList } from './TopProductsList';
import type { DashboardData } from './types';

type DashboardBodyProps = {
  data: DashboardData;
  selection: RangeSelection;
  loading: boolean;
  onRetry: () => void;
};

function SectionFailed({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('admin.dashboard');
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <p role="alert" className="font-body text-sm text-muted-foreground">
        {t('sectionFailed')}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {t('retry')}
      </Button>
    </div>
  );
}

/** Every card that follows the selected range. A failed request only blanks its own card. */
export function DashboardBody({ data, selection, loading, onRetry }: DashboardBodyProps) {
  const t = useTranslations('admin.dashboard');
  const { summary, sales, statuses, topProducts, categories, breakdown, attention, overview } = data;
  const failed = <SectionFailed onRetry={onRetry} />;
  const hasStockAlerts = attention !== null && (attention.outOfStockCount > 0 || attention.lowStockCount > 0);

  return (
    <div>
      <DashboardKpis summary={summary} loading={loading} />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SalesOverviewCard sales={sales} params={rangeParams(selection)} loading={loading} />
        <RecentActivityCard orders={overview?.recentOrders ?? []} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DeliveredCard sales={sales} summary={summary} loading={loading} />
        <DashboardSectionCard icon={BarChart3} title={t('ordersByStatus')}>
          {statuses === null ? (
            failed
          ) : statuses.statuses.length > 0 ? (
            <OrdersByStatusChart data={statuses.statuses} />
          ) : (
            <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noOrderData')}</p>
          )}
        </DashboardSectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardSectionCard icon={Package} title={t('topProducts')}>
          {topProducts ? <TopProductsList data={topProducts} /> : failed}
        </DashboardSectionCard>
        <DashboardSectionCard icon={PieChart} title={t('revenueByCategory')}>
          {categories ? <CategoryRevenueChart data={categories} /> : failed}
        </DashboardSectionCard>
        <DashboardSectionCard icon={Layers} title={t('breakdown.title')}>
          {breakdown ? <SalesBreakdownList data={breakdown} /> : failed}
        </DashboardSectionCard>
      </div>

      {hasStockAlerts && (
        <div className="mt-6">
          <DashboardSectionCard icon={AlertTriangle} iconClassName="text-amber-600" title={t('inventory')}>
            <InventoryAlerts data={attention} />
          </DashboardSectionCard>
        </div>
      )}
    </div>
  );
}
