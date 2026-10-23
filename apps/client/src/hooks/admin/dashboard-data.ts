import { api } from '@/lib/api';
import { rangeParams, type RangeSelection } from '@/lib/admin/analytics-range';
import type {
  Attention,
  DashboardData,
  Overview,
  OrdersByStatus,
  RevenueByCategory,
  Sales,
  SalesBreakdown,
  Summary,
  TopProducts,
} from '@/components/admin/dashboard/types';

const BASE = '/admin/analytics';

/** The value of a settled request, or null when it failed. */
function valueOf<T>(result: PromiseSettledResult<{ data: T }>): T | null {
  return result.status === 'fulfilled' ? result.value.data : null;
}

/** True when every section failed (the page then offers a retry instead of empty cards). */
export function isDashboardEmpty(data: DashboardData): boolean {
  return Object.values(data).every((section) => section === null);
}

/**
 * Everything the dashboard shows for one range. The range sections all use the
 * same params, so every card agrees; a failing request only blanks its own card.
 * Never rejects.
 */
export async function loadDashboard(selection: RangeSelection): Promise<DashboardData> {
  const params = rangeParams(selection);
  const [summary, sales, statuses, topProducts, categories, breakdown, attention, overview] = await Promise.allSettled([
    api.get<Summary>(`${BASE}/summary`, { params }),
    api.get<Sales>(`${BASE}/sales`, { params }),
    api.get<OrdersByStatus>(`${BASE}/orders-by-status`, { params }),
    api.get<TopProducts>(`${BASE}/top-products`, { params: { ...params, limit: 10 } }),
    api.get<RevenueByCategory>(`${BASE}/revenue-by-category`, { params }),
    api.get<SalesBreakdown>(`${BASE}/sales-breakdown`, { params }),
    api.get<Attention>(`${BASE}/needs-attention`),
    api.get<Overview>(`${BASE}/overview`),
  ]);
  return {
    summary: valueOf(summary),
    sales: valueOf(sales),
    statuses: valueOf(statuses),
    topProducts: valueOf(topProducts),
    categories: valueOf(categories),
    breakdown: valueOf(breakdown),
    attention: valueOf(attention),
    overview: valueOf(overview),
  };
}
