'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ORDER_STATUSES } from '@/components/admin/orders/types';
import { isValidDay, normalizeRange, type OrdersFilters } from '@/components/admin/orders/order-filters';
import { useListQuery } from './useListQuery';

type Range = { from: string; to: string };

/**
 * Filters of the admin orders list: status, search (applied 300ms after typing stops),
 * Israel-day range and page. Starts from the page's URL, so deep links work:
 * `?q=BA-1001` (order emails), `?status=CONFIRMED` (alerts), `?from=2026-10-01&to=2026-10-31`.
 */
export function useOrdersFilters() {
  const [query, { setSearch, setFilter, setPage, restore }] = useListQuery<string>('');
  const [range, setRange] = useState<Range>({ from: '', to: '' });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    if (isValidDay(from) || isValidDay(to)) setRange({ from: isValidDay(from) ? from : '', to: isValidDay(to) ? to : '' });
    restore({
      search: params.get('q') || undefined,
      filter: status && ORDER_STATUSES.includes(status) ? status : undefined,
    });
  }, [restore]);

  const setFrom = useCallback(
    (from: string) => {
      setRange((r) => ({ ...r, from }));
      setPage(1);
    },
    [setPage],
  );
  const setTo = useCallback(
    (to: string) => {
      setRange((r) => ({ ...r, to }));
      setPage(1);
    },
    [setPage],
  );

  const filters: OrdersFilters = {
    status: query.filter,
    search: query.appliedSearch,
    from: range.from,
    to: range.to,
  };
  const reversed = normalizeRange(range.from, range.to).reversed;
  const controls = useMemo(
    () => ({ setSearch, setStatus: setFilter, setPage, setFrom, setTo }),
    [setSearch, setFilter, setPage, setFrom, setTo],
  );

  return { filters, search: query.search, page: query.page, restored: query.restored, reversed, ...controls, controls };
}
