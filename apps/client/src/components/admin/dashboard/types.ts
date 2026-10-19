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

export type SalesDay = {
  date: string;
  orders: number;
  revenue: number;
};

export type OrderByStatus = {
  status: string;
  count: number;
};

export type TopProduct = {
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

export type CategoryRevenue = {
  categoryId: string;
  nameHe: string;
  nameEn: string;
  revenue: number;
  orders: number;
};

export type AOVData = {
  overallAverage: number;
  totalOrders: number;
  days: { date: string; averageOrderValue: number; orderCount: number }[];
};

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

export type InventoryData = {
  totalVariants: number;
  /** Sizes sold without stock tracking (left out of the stock counts). */
  unlimitedVariants?: number;
  totalStock: number;
  outOfStockCount: number;
  lowStockCount: number;
  lowStockThreshold: number;
  lowStockItems: LowStockItem[];
};

export type DashboardData = {
  overview: Overview | null;
  salesDays: SalesDay[];
  ordersByStatus: OrderByStatus[];
  topProducts: TopProduct[];
  categoryRevenue: CategoryRevenue[];
  aovData: AOVData | null;
  inventoryData: InventoryData | null;
};
