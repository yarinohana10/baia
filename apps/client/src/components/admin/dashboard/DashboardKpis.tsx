import { useLocale, useTranslations } from 'next-intl';
import { Ban, DollarSign, PackageCheck, Percent, Receipt, ShoppingBag, Shirt, Truck, UserPlus, Wallet } from 'lucide-react';
import { formatWholeShekels } from '@/lib/admin/format';
import { formatCount } from '@/lib/admin/analytics-format';
import { KpiCard } from './KpiCard';
import type { Metrics, Summary } from './types';

const money = (v: number | undefined) => formatWholeShekels(v ?? 0);

/** Headline numbers for the selected range, each compared with the previous equal-length period. */
export function DashboardKpis({ summary, loading }: { summary: Summary | null; loading: boolean }) {
  const t = useTranslations('admin.dashboard.kpi');
  const locale = useLocale();
  const m: Metrics | null = summary?.current ?? null;
  const prev = summary?.previous ?? null;
  const change = summary?.change ?? null;
  const n = (v: number | undefined) => formatCount(v ?? 0, locale);
  const was = (format: (v: number) => string, key: keyof Metrics) =>
    prev ? t('was', { value: format(prev[key]) }) : undefined;

  return (
    <div
      className={`mb-8 grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-5 ${loading ? 'opacity-60' : ''}`}
      aria-busy={loading}
    >
      <KpiCard title={t('revenue')} value={money(m?.revenue)} sub={t('revenueSub')} icon={DollarSign}
        change={change?.revenue} previousLabel={was(money, 'revenue')} />
      <KpiCard title={t('orders')} value={n(m?.orders)} sub={t('ordersSub')} icon={ShoppingBag}
        change={change?.orders} previousLabel={was(n, 'orders')} />
      <KpiCard title={t('averageOrder')} value={money(m?.averageOrderValue)} icon={Receipt}
        change={change?.averageOrderValue} previousLabel={was(money, 'averageOrderValue')} />
      <KpiCard title={t('units')} value={n(m?.unitsSold)} icon={Shirt}
        change={change?.unitsSold} previousLabel={was(n, 'unitsSold')} />
      <KpiCard title={t('delivered')} value={n(m?.delivered)} sub={t('deliveredSub', { amount: money(m?.deliveredRevenue) })} icon={PackageCheck}
        change={change?.delivered} previousLabel={was(n, 'delivered')} />
      <KpiCard title={t('shipped')} value={n(m?.shipped)} icon={Truck}
        change={change?.shipped} previousLabel={was(n, 'shipped')} />
      <KpiCard title={t('cancelled')} value={n((m?.cancelled ?? 0) + (m?.refunded ?? 0))}
        sub={t('cancelledSub', { cancelled: n(m?.cancelled), refunded: n(m?.refunded), amount: money((m?.cancelledValue ?? 0) + (m?.refundedValue ?? 0)) })}
        icon={Ban} risingIsBad
        change={summary && prev ? combinedChange((m?.cancelled ?? 0) + (m?.refunded ?? 0), prev.cancelled + prev.refunded) : null}
        previousLabel={prev ? t('was', { value: n(prev.cancelled + prev.refunded) }) : undefined} />
      <KpiCard title={t('discounts')} value={money(m?.discountTotal)} sub={t('discountsSub', { count: n(m?.couponOrders) })} icon={Percent}
        change={change?.discountTotal} previousLabel={was(money, 'discountTotal')} />
      <KpiCard title={t('shippingRevenue')} value={money(m?.shippingRevenue)} icon={Wallet}
        change={change?.shippingRevenue} previousLabel={was(money, 'shippingRevenue')} />
      <KpiCard title={t('newCustomers')} value={n(m?.newCustomers)} sub={t('newCustomersSub', { count: n(m?.returningCustomers) })} icon={UserPlus}
        change={change?.newCustomers} previousLabel={was(n, 'newCustomers')} />
    </div>
  );
}

function combinedChange(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 1000) / 10;
}
