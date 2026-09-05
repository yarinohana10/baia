'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import {
  ShoppingBag,
  DollarSign,
  UserPlus,
  Package,
  TrendingUp,
  Download,
  ArrowUpRight,
  BarChart3,
  PieChart,
  Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

type Overview = {
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  totalCustomers: number;
  newCustomersToday: number;
  totalProducts: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    customerEmail: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
};

type SalesDay = {
  date: string;
  orders: number;
  revenue: number;
};

type OrderByStatus = {
  status: string;
  count: number;
};

type TopProduct = {
  productName: string;
  totalQuantity: number;
  orderCount: number;
  product: {
    id: string;
    nameHe: string;
    nameEn: string;
    image: string | null;
  } | null;
};

type CategoryRevenue = {
  categoryId: string;
  nameHe: string;
  nameEn: string;
  revenue: number;
  orders: number;
};

type AOVData = {
  overallAverage: number;
  totalOrders: number;
  days: { date: string; averageOrderValue: number; orderCount: number }[];
};

function formatCurrency(amount: number) {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(
  dateStr: string,
  t: (key: 'justNow' | 'minutesAgo' | 'hoursAgo' | 'daysAgo', values?: { count: number }) => string,
) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('justNow');
  if (minutes < 60) return t('minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('daysAgo', { count: days });
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PROCESSING: '#8b5cf6',
  SHIPPED: '#06b6d4',
  DELIVERED: '#10b981',
  CANCELLED: '#ef4444',
  REFUNDED: '#6b7280',
};

const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  PENDING_PAYMENT: 'pendingPayment',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

const SALES_CHART_PADDING = { top: 16, right: 16, bottom: 28, left: 48 };

const CATEGORY_REVENUE_COLORS = ['#005d72', '#007791', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];

function SalesChart({ days }: { days: SalesDay[] }) {
  const width = 560;
  const height = 200;
  const padding = SALES_CHART_PADDING;
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const points = days.map((d, i) => {
    const x = padding.left + (i / Math.max(days.length - 1, 1)) * chartW;
    const y = padding.top + chartH - (d.revenue / maxRevenue) * chartH;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding.left} ${padding.top + chartH} L ${points[0]?.x ?? padding.left} ${padding.top + chartH} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
        const y = padding.top + chartH - tick * chartH;
        const value = Math.round(maxRevenue * tick);
        return (
          <g key={tick}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#eeeeee" strokeWidth={1} />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground text-[10px] font-body">
              {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#chartGradient)" opacity={0.3} />
      <path d={linePath} fill="none" stroke="#005d72" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#005d72" />
      ))}
      <defs>
        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#005d72" />
          <stop offset="100%" stopColor="#005d72" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendLabel,
  icon: Icon,
}: {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-ocean-700">
            <Icon size={20} />
          </div>
          {trend !== undefined && trend > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <TrendingUp size={12} className="text-ocean-700" />
              <span className="font-body text-xs font-medium text-ocean-700">+{trend}</span>
            </div>
          )}
        </div>
        <p className="font-body text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
        <p className="mt-1 font-serif text-3xl text-foreground">{value}</p>
        {trendLabel && (
          <p className="mt-1 font-body text-xs text-muted-foreground">{trendLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersByStatusChart({ data }: { data: OrderByStatus[] }) {
  const t = useTranslations('admin.orders');
  const total = data.reduce((sum, d) => sum + d.count, 0) || 1;

  const getStatusLabel = (status: string) => {
    const key = STATUS_TRANSLATION_KEYS[status];
    return key ? t(key as 'pendingPayment') : status;
  };

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.status}>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-body text-xs text-muted-foreground">
              {getStatusLabel(item.status)}
            </span>
            <span className="font-body text-xs font-semibold text-foreground">{item.count}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.count / total) * 100}%`,
                backgroundColor: STATUS_COLORS[item.status] || '#6b7280',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TopProductsList({ products }: { products: TopProduct[] }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();

  return (
    <div className="space-y-3">
      {products.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noSalesDataYet')}</p>
      ) : (
        products.map((item, idx) => {
          const productName =
            locale === 'he'
              ? item.product?.nameHe ?? item.productName
              : item.product?.nameEn ?? item.productName;

          return (
            <div key={item.product?.id ?? item.productName} className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-body text-xs font-bold text-ocean-700">
                {idx + 1}
              </div>
              {item.product?.image && (
                <Image
                  src={item.product.image}
                  alt={productName}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-medium text-foreground">{productName}</p>
                <p className="font-body text-xs text-muted-foreground">
                  {item.totalQuantity} {t('units')} · {item.orderCount} {t('orderItems')}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function CategoryRevenueChart({ data }: { data: CategoryRevenue[] }) {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noRevenueData')}</p>
      ) : (
        data.map((item, idx) => (
          <div key={item.categoryId}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-body text-sm text-foreground">
                {locale === 'he' ? item.nameHe : item.nameEn}
              </span>
              <span className="font-body text-sm font-semibold text-foreground">
                {formatCurrency(item.revenue)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.revenue / maxRevenue) * 100}%`,
                  backgroundColor: CATEGORY_REVENUE_COLORS[idx % CATEGORY_REVENUE_COLORS.length],
                }}
              />
            </div>
            <p className="mt-0.5 font-body text-xs text-muted-foreground">
              {item.orders} {t('orderItems')}
            </p>
          </div>
        ))
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const t = useTranslations('admin.dashboard');
  const locale = useLocale();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [salesDays, setSalesDays] = useState<SalesDay[]>([]);
  const [ordersByStatus, setOrdersByStatus] = useState<OrderByStatus[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categoryRevenue, setCategoryRevenue] = useState<CategoryRevenue[]>([]);
  const [aovData, setAovData] = useState<AOVData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [overviewRes, salesRes, productsRes] = await Promise.all([
          api.get('/admin/analytics/overview'),
          api.get('/admin/analytics/sales', { params: { days: 30 } }),
          api.get('/admin/products'),
        ]);

        setOverview({
          ...overviewRes.data,
          totalProducts: productsRes.data.length,
        });
        setSalesDays(salesRes.data.days);
      } catch {
        try {
          const [ordersRes, productsRes] = await Promise.all([
            api.get('/admin/orders', { params: { limit: 100 } }),
            api.get('/admin/products'),
          ]);
          const orders = ordersRes.data.orders ?? [];
          const totalRevenue = orders.reduce(
            (sum: number, o: { total: string | number }) => sum + Number(o.total),
            0,
          );
          setOverview({
            totalOrders: ordersRes.data.total ?? orders.length,
            todayOrders: 0,
            totalRevenue,
            todayRevenue: 0,
            totalCustomers: 0,
            newCustomersToday: 0,
            totalProducts: productsRes.data.length,
            recentOrders: orders.slice(0, 10).map((o: Overview['recentOrders'][0]) => ({
              ...o,
              total: Number(o.total),
            })),
          });
        } catch {
          setOverview(null);
        }
      }

      // Fetch extended analytics (non-blocking)
      try {
        const [statusRes, topRes, catRes, aovRes] = await Promise.all([
          api.get('/admin/analytics/orders-by-status'),
          api.get('/admin/analytics/top-products', { params: { limit: 5 } }),
          api.get('/admin/analytics/revenue-by-category'),
          api.get('/admin/analytics/average-order-value', { params: { days: 30 } }),
        ]);
        setOrdersByStatus(statusRes.data);
        setTopProducts(topRes.data);
        setCategoryRevenue(catRes.data);
        setAovData(aovRes.data);
      } catch {
        // Extended analytics are optional
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-muted-foreground">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-[32px] leading-tight text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* KPI Cards */}
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
          value={formatCurrency(overview?.totalRevenue ?? 0)}
          trend={overview?.todayRevenue ? Math.round(overview.todayRevenue) : undefined}
          trendLabel={`${formatCurrency(overview?.todayRevenue ?? 0)} ${t('today')}`}
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
          value={formatCurrency(aovData?.overallAverage ?? 0)}
          trendLabel={`${aovData?.totalOrders ?? 0} ${t('orders30d')}`}
          icon={Receipt}
        />
      </div>

      {/* Row 1: Sales Chart + Recent Activity */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="font-serif text-xl">{t('salesOverview')}</CardTitle>
              <CardDescription>{t('last30days')}</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="gap-2">
              <Download size={14} />
              {t('export')}
            </Button>
          </CardHeader>
          <CardContent>
            {salesDays.length > 0 ? (
              <SalesChart days={salesDays} />
            ) : (
              <div className="flex h-48 items-center justify-center">
                <p className="font-body text-sm text-muted-foreground">{t('noSalesData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="font-serif text-xl">{t('recentActivity')}</CardTitle>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 font-body text-xs font-medium text-ocean-700 hover:text-ocean-600"
            >
              {t('viewAll')}
              <ArrowUpRight size={14} />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(overview?.recentOrders ?? []).length === 0 ? (
                <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noRecentOrders')}</p>
              ) : (
                overview?.recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-body text-sm font-medium text-foreground">{order.orderNumber}</p>
                      <p className="truncate font-body text-xs text-muted-foreground">{order.customerEmail}</p>
                    </div>
                    <div className="shrink-0 text-end">
                      <p className="font-body text-sm font-semibold text-foreground">{formatCurrency(order.total)}</p>
                      <p className="font-body text-[11px] text-muted-foreground">{timeAgo(order.createdAt, t)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/admin/orders"
              className="mt-6 flex w-full items-center justify-center rounded-lg bg-muted py-2.5 font-body text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80"
            >
              {t('viewAllActivity')}
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Orders by Status + Top Products + Revenue by Category */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Orders by Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('ordersByStatus')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {ordersByStatus.length > 0 ? (
              <OrdersByStatusChart data={ordersByStatus} />
            ) : (
              <p className="py-8 text-center font-body text-sm text-muted-foreground">{t('noOrderData')}</p>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('topProducts')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <TopProductsList products={topProducts} />
          </CardContent>
        </Card>

        {/* Revenue by Category */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart size={18} className="text-ocean-700" />
              <CardTitle className="font-serif text-xl">{t('revenueByCategory')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CategoryRevenueChart data={categoryRevenue} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
