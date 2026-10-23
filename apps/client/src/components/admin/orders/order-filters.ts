/** Everything the admin can narrow the orders list by. */
export type OrdersFilters = {
  status: string;
  /** Trimmed search term (order number, email, name, phone). */
  search: string;
  /** Inclusive Israel calendar day, `YYYY-MM-DD`, or ''. */
  from: string;
  to: string;
};

export type OrdersParams = Record<string, string | number | undefined>;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written as `YYYY-MM-DD`. */
export function isValidDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** The day range to send: unusable days are dropped, and a reversed range is flagged instead of sent. */
export function normalizeRange(from: string, to: string): { from: string; to: string; reversed: boolean } {
  const start = isValidDay(from) ? from : '';
  const end = isValidDay(to) ? to : '';
  if (start && end && start > end) return { from: '', to: '', reversed: true };
  return { from: start, to: end, reversed: false };
}

/** Query string params shared by the list and the CSV export (empty values are left out). */
export function filterParams(filters: OrdersFilters): OrdersParams {
  const range = normalizeRange(filters.from, filters.to);
  return {
    status: filters.status || undefined,
    search: filters.search.trim() || undefined,
    from: range.from || undefined,
    to: range.to || undefined,
  };
}

/** Params of GET /admin/orders for a page. */
export function listParams(filters: OrdersFilters, page: number, limit: number): OrdersParams {
  return { ...filterParams(filters), page, limit };
}

/** Name of the downloaded CSV, e.g. `baia-orders-2026-10-01_2026-10-31.csv`. */
export function exportFileName(filters: OrdersFilters): string {
  const range = normalizeRange(filters.from, filters.to);
  const status = filters.status ? `-${filters.status.toLowerCase()}` : '';
  return `baia-orders${status}-${range.from || 'start'}_${range.to || 'today'}.csv`;
}
