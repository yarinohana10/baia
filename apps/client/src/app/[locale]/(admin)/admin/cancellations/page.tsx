'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useListQuery } from '@/hooks/admin/useListQuery';
import type { ListPage } from '@/hooks/admin/admin-list';
import { Card, CardContent } from '@/components/ui/card';
import { FilterChips } from '@/components/admin/common/FilterChips';
import { NoticeBanner, type Notice } from '@/components/admin/common/NoticeBanner';
import { Pagination } from '@/components/admin/common/Pagination';
import { CancellationCard } from '@/components/admin/cancellations/CancellationCard';
import type { AdminCancellation, RequestStatus } from '@/components/admin/cancellations/types';

type ListResponse = { requests: AdminCancellation[]; total: number; totalPages: number; windowHours: number };
type CancellationsMeta = { windowHours: number };
type Filter = RequestStatus | '';

const FILTERS: Filter[] = ['REQUESTED', 'APPROVED', 'REJECTED', 'AUTO_CANCELLED', ''];

const selectRequests = (data: ListResponse): ListPage<AdminCancellation, CancellationsMeta> => ({
  items: data.requests,
  total: data.total,
  totalPages: data.totalPages,
  meta: { windowHours: data.windowHours },
});

export default function AdminCancellationsPage() {
  const t = useTranslations('admin.cancellations');
  const tOrders = useTranslations('admin.orders');
  const [query, { setFilter, setPage }] = useListQuery<Filter>('REQUESTED');
  const list = useAdminList({
    url: '/admin/cancellations',
    params: { status: query.filter || undefined, page: query.page, limit: 20 },
    select: selectRequests,
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  const windowHours = list.meta?.windowHours ?? 48;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">{t('subtitle', { hours: windowHours })}</p>
      </div>

      {notice && (
        <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} dismissLabel={tOrders('dismiss')} className="mb-6" />
      )}

      <FilterChips
        options={FILTERS.map((f) => ({ value: f, label: f ? t(`status.${f}`) : t('all') }))}
        selected={query.filter}
        onSelect={setFilter}
      />

      {list.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-destructive">
          {t('loadFailed')}
        </p>
      ) : !list.loaded ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('loading')}</p>
      ) : list.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {query.filter === 'REQUESTED' ? t('emptyOpen') : t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {list.items.map((request) => (
            <CancellationCard
              key={request.id}
              request={request}
              windowHours={windowHours}
              onResolved={(text, kind) => {
                setNotice({ kind, text });
                list.reload();
              }}
            />
          ))}
        </div>
      )}

      {list.loaded && (
        <Pagination
          page={query.page}
          totalPages={list.totalPages}
          onPageChange={setPage}
          previousLabel={tOrders('previousPage')}
          nextLabel={tOrders('nextPage')}
        />
      )}
    </div>
  );
}
