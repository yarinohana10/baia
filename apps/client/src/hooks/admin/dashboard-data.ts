import { api } from '@/lib/api';
import type {
  AOVData,
  CategoryRevenue,
  DashboardData,
  InventoryData,
  OrderByStatus,
  Overview,
  RecentOrder,
  SalesDay,
  TopProduct,
} from '@/components/admin/dashboard/types';

type OrdersPage = {
  orders?: (Omit<RecentOrder, 'total'> & { total: string | number })[];
  total?: number;
};

type ExtendedAnalytics = Pick<
  DashboardData,
  'ordersByStatus' | 'topProducts' | 'categoryRevenue' | 'aovData' | 'inventoryData'
>;

const NO_EXTENDED_ANALYTICS: ExtendedAnalytics = {
  ordersByStatus: [],
  topProducts: [],
  categoryRevenue: [],
  aovData: null,
  inventoryData: null,
};

/** Rough overview from the latest 100 orders, for when the analytics endpoints fail. */
async function loadOverviewFromOrders(): Promise<Overview | null> {
  try {
    const { data } = await api.get<OrdersPage>('/admin/orders', { params: { limit: 100 } });
    const orders = data.orders ?? [];
    return {
      totalOrders: data.total ?? orders.length,
      todayOrders: 0,
      totalRevenue: orders.reduce((sum, o) => sum + Number(o.total), 0),
      todayRevenue: 0,
      totalCustomers: 0,
      newCustomersToday: 0,
      totalProducts: 0,
      recentOrders: orders.slice(0, 10).map((o) => ({ ...o, total: Number(o.total) })),
    };
  } catch {
    return null;
  }
}

async function loadOverview(): Promise<Pick<DashboardData, 'overview' | 'salesDays'>> {
  try {
    // The overview already includes totalProducts; no need to download the product list.
    const [overviewRes, salesRes] = await Promise.all([
      api.get<Overview>('/admin/analytics/overview'),
      api.get<{ days: SalesDay[] }>('/admin/analytics/sales', { params: { days: 30 } }),
    ]);
    return { overview: overviewRes.data, salesDays: salesRes.data.days };
  } catch {
    return { overview: await loadOverviewFromOrders(), salesDays: [] };
  }
}

/** Extended analytics are optional: any failure leaves all of them empty. */
async function loadExtendedAnalytics(): Promise<ExtendedAnalytics> {
  try {
    const [statusRes, topRes, catRes, aovRes, inventoryRes] = await Promise.all([
      api.get<OrderByStatus[]>('/admin/analytics/orders-by-status'),
      api.get<TopProduct[]>('/admin/analytics/top-products', { params: { limit: 5 } }),
      api.get<CategoryRevenue[]>('/admin/analytics/revenue-by-category'),
      api.get<AOVData>('/admin/analytics/average-order-value', { params: { days: 30 } }),
      api.get<InventoryData>('/admin/analytics/inventory'),
    ]);
    return {
      ordersByStatus: statusRes.data,
      topProducts: topRes.data,
      categoryRevenue: catRes.data,
      aovData: aovRes.data,
      inventoryData: inventoryRes.data,
    };
  } catch {
    return NO_EXTENDED_ANALYTICS;
  }
}

/** Everything the admin dashboard shows except the notification counts. Never rejects. */
export async function loadDashboard(): Promise<DashboardData> {
  // Independent of each other (and neither rejects), so they load in parallel.
  const [base, extended] = await Promise.all([loadOverview(), loadExtendedAnalytics()]);
  return { ...base, ...extended };
}
