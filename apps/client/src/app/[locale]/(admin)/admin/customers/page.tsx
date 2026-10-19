'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useListQuery } from '@/hooks/admin/useListQuery';
import type { ListPage } from '@/hooks/admin/admin-list';
import { CUSTOMERS_LIST_QUERY_KEY } from '@/components/admin/customers-list';
import { CustomersTable, type CustomerRow } from '@/components/admin/customers/CustomersTable';
import { NoticeBanner } from '@/components/admin/common/NoticeBanner';
import { Pagination } from '@/components/admin/common/Pagination';
import { SearchField } from '@/components/admin/common/SearchField';

const PAGE_SIZE = 20;

type CustomersResponse = { customers: CustomerRow[]; total: number; totalPages: number };

const selectCustomers = (data: CustomersResponse): ListPage<CustomerRow> => ({
  items: data.customers,
  total: data.total,
  totalPages: data.totalPages,
  meta: undefined,
});

/** ?q=&page= of the current URL, so the list survives going to a customer and back. */
function queryFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page') ?? '1', 10);
  return { search: params.get('q') ?? '', page: Number.isFinite(page) && page > 0 ? page : 1 };
}

/** Keeps ?q=&page= in the URL (and session storage) so Back from a customer restores the list. */
function rememberQuery(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  const { pathname } = window.location;
  window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname);
  try {
    sessionStorage.setItem(CUSTOMERS_LIST_QUERY_KEY, qs);
  } catch {
    // Storage unavailable: the detail page's back link just loses the filters.
  }
}

export default function AdminCustomersPage() {
  const t = useTranslations('admin.customers');
  const [query, { setSearch, setPage, restore }] = useListQuery(null);
  const list = useAdminList({
    url: '/admin/customers',
    params: { search: query.appliedSearch || undefined, page: query.page, limit: PAGE_SIZE },
    select: selectCustomers,
    enabled: query.restored,
  });

  useEffect(() => restore(queryFromUrl()), [restore]);

  useEffect(() => {
    if (query.restored) rememberQuery(query.appliedSearch, query.page);
  }, [query.restored, query.appliedSearch, query.page]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${list.total})`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('paidNote')}</p>
      </div>

      {list.error && (
        <NoticeBanner
          notice={{ kind: 'error', text: t('loadFailed') }}
          onDismiss={list.dismissError}
          dismissLabel={t('dismiss')}
          className="mb-6"
        />
      )}

      <SearchField value={query.search} onChange={setSearch} placeholder={t('searchPlaceholder')} className="mb-6" />

      <CustomersTable
        customers={list.items}
        loading={list.loading}
        emptyText={query.appliedSearch ? t('noMatches') : t('noCustomers')}
      />

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
