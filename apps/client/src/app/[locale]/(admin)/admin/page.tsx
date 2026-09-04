'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';

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

function formatCurrency(amount: number) {
  return `₪${amount.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SalesChart({ days }: { days: SalesDay[] }) {
  const width = 560;
  const height = 200;
  const padding = { top: 16, right: 16, bottom: 28, left: 48 };
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
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="#eeeeee"
              strokeWidth={1}
            />
            <text
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-[#3f484c] text-[10px] font-body"
            >
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
    <div className="rounded-xl border border-[#eeeeee] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3f3f4] text-[#005d72]">
          <Icon size={20} />
        </div>
        {trend !== undefined && trend > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-[#e7e2d9] px-2 py-1">
            <TrendingUp size={12} className="text-[#005d72]" />
            <span className="font-body text-xs font-medium text-[#005d72]">+{trend}</span>
          </div>
        )}
      </div>
      <p className="font-body text-xs font-medium uppercase tracking-[0.08em] text-[#3f484c]">
        {title}
      </p>
      <p className="mt-1 font-serif text-3xl text-[#1a1c1c]">{value}</p>
      {trendLabel && (
        <p className="mt-1 font-body text-xs text-[#3f484c]">{trendLabel}</p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [salesDays, setSalesDays] = useState<SalesDay[]>([]);
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
        // Fallback: derive basic stats from orders + products if analytics unavailable
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
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="font-body text-sm text-[#3f484c]">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-[32px] leading-tight text-[#1a1c1c]">Dashboard</h1>
        <p className="mt-1 font-body text-sm text-[#3f484c]">
          Overview of your store performance
        </p>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Total Orders"
          value={String(overview?.totalOrders ?? 0)}
          trend={overview?.todayOrders}
          trendLabel={`${overview?.todayOrders ?? 0} today`}
          icon={ShoppingBag}
        />
        <KpiCard
          title="Revenue"
          value={formatCurrency(overview?.totalRevenue ?? 0)}
          trend={overview?.todayRevenue ? Math.round(overview.todayRevenue) : undefined}
          trendLabel={`${formatCurrency(overview?.todayRevenue ?? 0)} today`}
          icon={DollarSign}
        />
        <KpiCard
          title="New Signups"
          value={String(overview?.totalCustomers ?? 0)}
          trend={overview?.newCustomersToday}
          trendLabel={`${overview?.newCustomersToday ?? 0} today`}
          icon={UserPlus}
        />
        <KpiCard
          title="Products"
          value={String(overview?.totalProducts ?? 0)}
          icon={Package}
        />
      </div>

      {/* Chart + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Overview */}
        <div className="rounded-xl border border-[#eeeeee] bg-white p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl text-[#1a1c1c]">Sales Overview</h2>
              <p className="font-body text-xs text-[#3f484c]">Last 30 days revenue</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-[#bec8cd] px-4 py-2 font-body text-xs font-medium text-[#3f484c] transition-colors hover:bg-[#f3f3f4]"
            >
              <Download size={14} />
              Export
            </button>
          </div>
          {salesDays.length > 0 ? (
            <SalesChart days={salesDays} />
          ) : (
            <div className="flex h-48 items-center justify-center">
              <p className="font-body text-sm text-[#3f484c]">No sales data yet</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-[#eeeeee] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-serif text-xl text-[#1a1c1c]">Recent Activity</h2>
            <Link
              href="/admin/orders"
              className="flex items-center gap-1 font-body text-xs font-medium text-[#005d72] hover:text-[#007791]"
            >
              View All
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="space-y-4">
            {(overview?.recentOrders ?? []).length === 0 ? (
              <p className="py-8 text-center font-body text-sm text-[#3f484c]">
                No recent orders
              </p>
            ) : (
              overview?.recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start justify-between gap-3 border-b border-[#f3f3f4] pb-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-body text-sm font-medium text-[#1a1c1c]">
                      {order.orderNumber}
                    </p>
                    <p className="truncate font-body text-xs text-[#3f484c]">
                      {order.customerEmail}
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="font-body text-sm font-semibold text-[#1a1c1c]">
                      {formatCurrency(order.total)}
                    </p>
                    <p className="font-body text-[11px] text-[#3f484c]">
                      {timeAgo(order.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <Link
            href="/admin/orders"
            className="mt-6 flex w-full items-center justify-center rounded-full bg-[#f3f3f4] py-2.5 font-body text-xs font-medium text-[#3f484c] transition-colors hover:bg-[#eeeeee]"
          >
            View All Activity
          </Link>
        </div>
      </div>
    </div>
  );
}
