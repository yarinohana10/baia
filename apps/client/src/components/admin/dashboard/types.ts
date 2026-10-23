import type { Bucket } from '@/lib/admin/analytics-format';

export type RecentOrder = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  total: number;
  status: string;
  createdAt: string;
};

export type Overview = {
  totalOrders: number;
  todayOrders: number;
  totalRevenue: number;
  todayRevenue: number;
  totalCustomers: number;
  newCustomersToday: number;
  totalProducts: number;
  recentOrders: RecentOrder[];
};

export type PeriodInfo = { fromDay: string; toDay: string; days: number };

/** The range the server resolved (Israel days). */
export type RangeInfo = PeriodInfo & {
  preset: string;
  bucket: Bucket;
  timeZone: string;
  previous: PeriodInfo | null;
};

export type Metrics = {
  orders: number;
  placed: number;
  pendingPayment: number;
  revenue: number;
  averageOrderValue: number;
  unitsSold: number;
  discountTotal: number;
  shippingRevenue: number;
  couponOrders: number;
  delivered: number;
  deliveredRevenue: number;
  shipped: number;
  cancelled: number;
  cancelledValue: number;
  refunded: number;
  refundedValue: number;
  newCustomers: number;
  returningCustomers: number;
  newAccounts: number;
};

export type Summary = {
  range: RangeInfo;
  current: Metrics;
  previous: Metrics | null;
  /** % change per metric against the previous period; null where it cannot be computed. */
  change: Record<keyof Metrics, number | null> | null;
};

export type SalesPoint = {
  date: string;
  orders: number;
  revenue: number;
  units: number;
  delivered: number;
  deliveredRevenue: number;
};

export type Sales = { range: RangeInfo; bucket: Bucket; points: SalesPoint[] };

export type StatusRow = { status: string; count: number; value: number };
export type OrdersByStatus = { range: RangeInfo; statuses: StatusRow[] };

export type TopProduct = {
  productId: string;
  nameHe: string;
  nameEn: string;
  units: number;
  revenue: number;
  orders: number;
  image: string | null;
};
export type TopProducts = { range: RangeInfo; byUnits: TopProduct[]; byRevenue: TopProduct[] };

export type CategoryRevenue = {
  categoryId: string;
  nameHe: string;
  nameEn: string;
  revenue: number;
  units: number;
  orders: number;
  parentNameHe?: string | null;
  parentNameEn?: string | null;
};
export type RevenueByCategory = { range: RangeInfo; topLevel: CategoryRevenue[]; byType: CategoryRevenue[] };

export type BreakdownRow = { value: string; units: number; revenue: number };
export type SalesBreakdown = { range: RangeInfo; byColor: BreakdownRow[]; bySize: BreakdownRow[] };

export type LowStockItem = {
  variantId: string;
  productId: string;
  productNameHe: string;
  productNameEn: string;
  productSlug: string;
  color: string;
  size: string;
  stockQuantity: number;
  image: string | null;
};

/** Work waiting on the admin, whatever the selected range. */
export type Attention = {
  ordersToProcess: number;
  pendingRefunds: { count: number; amount: number };
  pendingCancellations: number;
  lowStockThreshold: number;
  lowStockCount: number;
  outOfStockCount: number;
  stockItems: LowStockItem[];
};

/** Each section is null when its request failed, so one failure never blanks the page. */
export type DashboardData = {
  summary: Summary | null;
  sales: Sales | null;
  statuses: OrdersByStatus | null;
  topProducts: TopProducts | null;
  categories: RevenueByCategory | null;
  breakdown: SalesBreakdown | null;
  attention: Attention | null;
  overview: Overview | null;
};
