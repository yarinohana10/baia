'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FilterChips } from '@/components/admin/common/FilterChips';
import { NoticeBanner, type Notice } from '@/components/admin/common/NoticeBanner';
import { Pagination } from '@/components/admin/common/Pagination';
import { SearchField } from '@/components/admin/common/SearchField';
import { OrderDetailDialog } from '@/components/admin/orders/OrderDetailDialog';
import { OrderStatusForm } from '@/components/admin/orders/OrderStatusForm';
import { OrdersTable } from '@/components/admin/orders/OrdersTable';
import { ORDER_STATUSES, type AdminOrder, type AdminOrdersResponse } from '@/components/admin/orders/types';
import type { ListPage } from '@/hooks/admin/admin-list';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useListQuery } from '@/hooks/admin/useListQuery';
import { useOrderDetail } from '@/hooks/admin/useOrderDetail';
import { useOrderStatusLabel } from '@/hooks/admin/useOrderStatusLabel';

function selectOrdersPage(data: AdminOrdersResponse): ListPage<AdminOrder> {
  return { items: data.orders, total: data.total, totalPages: data.totalPages, meta: undefined };
}

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders');
  const statusLabel = useOrderStatusLabel();
  const [query, { setSearch, setFilter, setPage, restore }] = useListQuery<string>('');
  const list = useAdminList({
    url: '/admin/orders',
    params: {
      status: query.filter || undefined,
      search: query.appliedSearch || undefined,
      page: query.page,
      limit: 20,
    },
    select: selectOrdersPage,
    enabled: query.restored,
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const detail = useOrderDetail({ setNotice, onUpdated: list.reload });

  // Deep links: /admin/orders?q=<order number> (customer page, emails) and ?status=CONFIRMED (alerts).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    restore({
      search: params.get('q') || undefined,
      filter: status && ORDER_STATUSES.includes(status) ? status : undefined,
    });
  }, [restore]);

  const shownNotice: Notice | null = list.error ? { kind: 'error', text: t('loadFailed') } : notice;
  const filterOptions = [{ value: '', label: t('all') }, ...ORDER_STATUSES.map((s) => ({ value: s, label: statusLabel(s) }))];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${list.total})`}</h1>
      </div>

      {shownNotice && (
        <NoticeBanner
          notice={shownNotice}
          onDismiss={() => {
            setNotice(null);
            list.dismissError();
          }}
          dismissLabel={t('dismiss')}
          className="mb-6"
        />
      )}

      <SearchField value={query.search} onChange={setSearch} placeholder={t('searchPlaceholder')} className="mb-4" />
      <FilterChips options={filterOptions} selected={query.filter} onSelect={setFilter} />

      {detail.state.order && (
        <OrderDetailDialog order={detail.state.order} onClose={detail.closeDetail}>
          <OrderStatusForm order={detail.state.order} detail={detail} />
        </OrderDetailDialog>
      )}

      <OrdersTable orders={list.items} onView={detail.openDetail} />

      <Pagination
        page={query.page}
        totalPages={list.totalPages}
        onPageChange={setPage}
        previousLabel={t('previousPage')}
        nextLabel={t('nextPage')}
      />
    </div>
  );
}
