import { useTranslations } from 'next-intl';
import { DollarSign, Receipt, ShoppingBag, UserPlus } from 'lucide-react';
import { formatWholeShekels } from '@/lib/admin/format';
import { KpiCard } from './KpiCard';
import type { AOVData, Overview } from './types';

type DashboardKpisProps = {
  overview: Overview | null;
  aovData: AOVData | null;
};

export function DashboardKpis({ overview, aovData }: DashboardKpisProps) {
  const t = useTranslations('admin.dashboard');

  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title={t('totalOrders')}
        value={String(overview?.totalOrders ?? 0)}
        trend={overview?.todayOrders}
        trendLabel={`${overview?.todayOrders ?? 0} ${t('today')}`}
        icon={ShoppingBag}
      />
      <KpiCard
        title={t('revenue')}
        value={formatWholeShekels(overview?.totalRevenue ?? 0)}
        trend={overview?.todayRevenue ? Math.round(overview.todayRevenue) : undefined}
        trendLabel={`${formatWholeShekels(overview?.todayRevenue ?? 0)} ${t('today')}`}
        icon={DollarSign}
      />
      <KpiCard
        title={t('customers')}
        value={String(overview?.totalCustomers ?? 0)}
        trend={overview?.newCustomersToday}
        trendLabel={`${overview?.newCustomersToday ?? 0} ${t('newToday')}`}
        icon={UserPlus}
      />
      <KpiCard
        title={t('avgOrderValue')}
        value={formatWholeShekels(aovData?.overallAverage ?? 0)}
        trendLabel={`${aovData?.totalOrders ?? 0} ${t('orders30d')}`}
        icon={Receipt}
      />
    </div>
  );
}
