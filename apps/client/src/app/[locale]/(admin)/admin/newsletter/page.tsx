'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import { api } from '@/lib/api';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useListQuery } from '@/hooks/admin/useListQuery';
import { useFileDownload } from '@/hooks/admin/useFileDownload';
import type { ListPage } from '@/hooks/admin/admin-list';
import { Button } from '@/components/ui/button';
import { NoticeBanner } from '@/components/admin/common/NoticeBanner';
import { Pagination } from '@/components/admin/common/Pagination';
import { SearchField } from '@/components/admin/common/SearchField';
import { SubscribersTable, type Subscriber } from '@/components/admin/newsletter/SubscribersTable';

const PAGE_SIZE = 50;

type NewsletterResponse = { subscribers: Subscriber[]; total: number; totalPages: number; activeCount: number };
type NewsletterMeta = { activeCount: number };

const selectSubscribers = (data: NewsletterResponse): ListPage<Subscriber, NewsletterMeta> => ({
  items: data.subscribers,
  total: data.total,
  totalPages: data.totalPages,
  meta: { activeCount: data.activeCount },
});

/** Newsletter subscribers (explicit opt-ins), with search, active filter and CSV export. */
export default function AdminNewsletterPage() {
  const t = useTranslations('admin.newsletter');
  // The filter is "active subscribers only".
  const [query, { setSearch, setFilter: setActiveOnly, setPage }] = useListQuery(true);
  const filterParams = { search: query.appliedSearch || undefined, active: query.filter ? 'true' : undefined };
  const list = useAdminList({
    url: '/admin/newsletter',
    params: { ...filterParams, page: query.page, limit: PAGE_SIZE },
    select: selectSubscribers,
  });
  const { downloading, download } = useFileDownload();
  const [exportFailed, setExportFailed] = useState(false);

  const error = exportFailed ? t('exportFailed') : list.error ? t('loadFailed') : null;
  const dismissError = () => {
    setExportFailed(false);
    list.dismissError();
  };

  const exportCsv = async () => {
    const ok = await download(
      () =>
        api
          .get<Blob>('/admin/newsletter/export.csv', { params: filterParams, responseType: 'blob' })
          .then((res) => res.data),
      `baia-newsletter-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    if (!ok) setExportFailed(true);
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          <p className="mt-2 text-sm font-medium text-ocean-700">{t('activeCount', { count: list.meta?.activeCount ?? 0 })}</p>
        </div>
        <Button
          type="button"
          onClick={exportCsv}
          disabled={downloading}
          className="gap-2 bg-ocean-700 px-4 text-white hover:bg-ocean-800"
        >
          <Download size={16} aria-hidden="true" />
          {downloading ? t('exporting') : t('export')}
        </Button>
      </div>

      {error && (
        <NoticeBanner notice={{ kind: 'error', text: error }} onDismiss={dismissError} dismissLabel={t('dismiss')} className="mb-6" />
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField value={query.search} onChange={setSearch} placeholder={t('searchPlaceholder')} className="w-full" />
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={query.filter}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 accent-ocean-700"
          />
          {t('activeOnly')}
        </label>
      </div>

      <SubscribersTable
        rows={list.items}
        loading={list.loading}
        emptyText={query.appliedSearch ? t('noMatches') : t('empty')}
      />

      <Pagination
        page={query.page}
        totalPages={list.totalPages}
        onPageChange={setPage}
        previousLabel={t('previousPage')}
        nextLabel={t('nextPage')}
        extra={` · ${list.total}`}
      />
    </div>
  );
}
