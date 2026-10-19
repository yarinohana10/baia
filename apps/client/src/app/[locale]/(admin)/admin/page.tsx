'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, BarChart3, Package, PieChart } from 'lucide-react';
import { useDashboardData } from '@/hooks/admin/useDashboardData';
import { CategoryRevenueChart } from '@/components/admin/dashboard/CategoryRevenueChart';
import { DashboardKpis } from '@/components/admin/dashboard/DashboardKpis';
import { DashboardSectionCard } from '@/components/admin/dashboard/DashboardSectionCard';
import { InventoryAlerts } from '@/components/admin/dashboard/InventoryAlerts';
import { NeedsAttention } from '@/components/admin/dashboard/NeedsAttention';
import { OrdersByStatusChart } from '@/components/admin/dashboard/OrdersByStatusChart';
import { RecentActivityCard } from '@/components/admin/dashboard/RecentActivityCard';
import { SalesOverviewCard } from '@/components/admin/dashboard/SalesOverviewCard';
import { TopProductsList } from '@/components/admin/dashboard/TopProductsList';

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const { data, counts } = useDashboardData();

  if (!data) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  const { overview, salesDays, ordersByStatus, topProducts, categoryRevenue, aovData, inventoryData } = data;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-[32px] leading-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <NeedsAttention counts={counts} />

      <DashboardKpis overview={overview} aovData={aovData} />

      {/* Row 1: Sales Chart + Recent Activity */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SalesOverviewCard days={salesDays} />
        <RecentActivityCard orders={overview?.recentOrders ?? []} />
      </div>

      {/* Row 2: Orders by Status + Top Products + Revenue by Category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DashboardSectionCard icon={BarChart3} title={t('ordersByStatus')}>
          {ordersByStatus.length > 0 ? (
            <OrdersByStatusChart data={ordersByStatus} />
          ) : (
            <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noOrderData')}</p>
          )}
        </DashboardSectionCard>

        <DashboardSectionCard icon={Package} title={t('topProducts')}>
          <TopProductsList products={topProducts} />
        </DashboardSectionCard>

        <DashboardSectionCard icon={PieChart} title={t('revenueByCategory')}>
          <CategoryRevenueChart data={categoryRevenue} />
        </DashboardSectionCard>
      </div>

      {/* Row 3: Inventory Alerts */}
      {inventoryData && (inventoryData.outOfStockCount > 0 || inventoryData.lowStockCount > 0) && (
        <div className="mt-6">
          <DashboardSectionCard icon={AlertTriangle} iconClassName="text-amber-600" title={t('inventory')}>
            <InventoryAlerts data={inventoryData} />
          </DashboardSectionCard>
        </div>
      )}
    </div>
  );
}
