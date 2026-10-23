'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banknote } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { NoticeBanner, type Notice } from '@/components/admin/common/NoticeBanner';
import { Pagination } from '@/components/admin/common/Pagination';
import { OrderDetailDialog } from '@/components/admin/orders/OrderDetailDialog';
import { OrdersCards } from '@/components/admin/orders/OrdersCards';
import { OrdersFilters } from '@/components/admin/orders/OrdersFilters';
import { PendingRefundsPanel } from '@/components/admin/orders/PendingRefundsPanel';
import { exportFileName, filterParams, listParams } from '@/components/admin/orders/order-filters';
import type {
  AdminOrder,
  AdminOrdersResponse,
  AdminRefundRow,
  AdminRefundsResponse,
} from '@/components/admin/orders/types';
import type { ListPage } from '@/hooks/admin/admin-list';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useFileDownload } from '@/hooks/admin/useFileDownload';
import { useOrderActions } from '@/hooks/admin/useOrderActions';
import { useOrderDetail } from '@/hooks/admin/useOrderDetail';
import { useOrdersFilters } from '@/hooks/admin/useOrdersFilters';

const PAGE_SIZE = 20;
const PENDING_REFUNDS = { status: 'PENDING', limit: 50 };

function selectOrdersPage(data: AdminOrdersResponse): ListPage<AdminOrder> {
  return { items: data.orders, total: data.total, totalPages: data.totalPages, meta: undefined };
}

function selectRefundsPage(data: AdminRefundsResponse): ListPage<AdminRefundRow, { pendingCount: number }> {
  return { items: data.refunds, total: data.total, totalPages: data.totalPages, meta: { pendingCount: data.pendingCount } };
}

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders');
  const tc = useTranslations('admin.orderCards');
  const f = useOrdersFilters();
  const orders = useAdminList({
    url: '/admin/orders',
    params: listParams(f.filters, f.page, PAGE_SIZE),
    select: selectOrdersPage,
    enabled: f.restored,
  });
  const refunds = useAdminList({ url: '/admin/refunds', params: PENDING_REFUNDS, select: selectRefundsPage });
  const [notice, setNotice] = useState<Notice | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const { downloading, download } = useFileDownload();
  const detail = useOrderDetail({ setNotice });

  const { reload: reloadOrders } = orders;
  const { reload: reloadRefunds } = refunds;
  const reloadAll = useCallback(() => {
    reloadOrders();
    reloadRefunds();
  }, [reloadOrders, reloadRefunds]);
  const actions = useOrderActions({ setNotice, onChanged: reloadAll });

  const exportOrders = async () => {
    setExportFailed(false);
    const ok = await download(
      () => api.get('/admin/orders/export', { params: filterParams(f.filters), responseType: 'blob' }).then((res) => res.data as Blob),
      exportFileName(f.filters),
    );
    if (!ok) setExportFailed(true);
  };

  const showOrder = (orderNumber: string) => {
    f.setSearch(orderNumber);
    setShowQueue(false);
  };

  const shownNotice: Notice | null = orders.error ? { kind: 'error', text: t('loadFailed') } : notice;
  const pendingCount = refunds.meta?.pendingCount ?? 0;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${orders.total})`}</h1>
        {pendingCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={showQueue}
            onClick={() => setShowQueue((open) => !open)}
            className="gap-1.5 border-amber-300 text-amber-800"
          >
            <Banknote size={14} aria-hidden="true" /> {tc('queue.toggle', { count: pendingCount })}
          </Button>
        )}
      </div>

      {shownNotice && (
        <NoticeBanner
          notice={shownNotice}
          onDismiss={() => {
            setNotice(null);
            orders.dismissError();
          }}
          dismissLabel={t('dismiss')}
          className="mb-6"
        />
      )}

      {showQueue && pendingCount > 0 && (
        <PendingRefundsPanel refunds={refunds.items} actions={actions} onShowOrder={showOrder} />
      )}

      <OrdersFilters
        filters={f.filters}
        search={f.search}
        reversed={f.reversed}
        controls={f.controls}
        onExport={exportOrders}
        exporting={downloading}
        exportFailed={exportFailed}
      />

      {detail.order && <OrderDetailDialog order={detail.order} onClose={detail.closeDetail} />}

      <OrdersCards orders={orders.items} loaded={orders.loaded} actions={actions} onDetails={detail.openDetail} />

      <Pagination
        page={f.page}
        totalPages={orders.totalPages}
        onPageChange={f.setPage}
        previousLabel={t('previousPage')}
        nextLabel={t('nextPage')}
      />
    </div>
  );
}
