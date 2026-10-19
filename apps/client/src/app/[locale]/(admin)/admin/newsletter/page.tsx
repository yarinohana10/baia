'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Download, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type Subscriber = {
  id: string;
  email: string;
  locale: string;
  source: string;
  consentAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
};

const PAGE_SIZE = 50;
const SOURCES = ['footer', 'checkout', 'register', 'account'] as const;

/** Newsletter subscribers (explicit opt-ins), with search, active filter and CSV export. */
export default function AdminNewsletterPage() {
  const t = useTranslations('admin.newsletter');
  const locale = useLocale();
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { dateStyle: 'medium' }),
    [locale],
  );

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, activeOnly]);

  const params = useCallback(
    () => ({ search: debouncedSearch || undefined, active: activeOnly ? 'true' : undefined }),
    [debouncedSearch, activeOnly],
  );

  const load = useCallback(
    async (isCancelled: () => boolean) => {
      setLoading(true);
      try {
        const res = await api.get('/admin/newsletter', { params: { ...params(), page, limit: PAGE_SIZE } });
        if (isCancelled()) return;
        setRows(res.data.subscribers);
        setTotal(res.data.total);
        setActiveCount(res.data.activeCount);
        setTotalPages(Math.max(1, res.data.totalPages));
        setError(null);
      } catch {
        if (!isCancelled()) setError(t('loadFailed'));
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [params, page, t],
  );

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await api.get<Blob>('/admin/newsletter/export.csv', { params: params(), responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `baia-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(t('exportFailed'));
    } finally {
      setExporting(false);
    }
  }

  const sourceLabel = (s: string) => ((SOURCES as readonly string[]).includes(s) ? t(`sources.${s as (typeof SOURCES)[number]}`) : s);
  const th = 'text-start px-4 py-3 font-medium text-muted-foreground';

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
          <p className="mt-2 text-sm font-medium text-ocean-700">{t('activeCount', { count: activeCount })}</p>
        </div>
        <Button
          type="button"
          onClick={exportCsv}
          disabled={exporting}
          className="gap-2 bg-ocean-700 px-4 text-white hover:bg-ocean-800"
        >
          <Download size={16} aria-hidden="true" />
          {exporting ? t('exporting') : t('export')}
        </Button>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-md">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="ps-9"
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="h-4 w-4 accent-ocean-700"
          />
          {t('activeOnly')}
        </label>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm" aria-busy={loading}>
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className={th}>{t('email')}</th>
                <th className={th}>{t('status')}</th>
                <th className={th}>{t('source')}</th>
                <th className={th}>{t('locale')}</th>
                <th className={th}>{t('consentAt')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {loading ? '…' : debouncedSearch ? t('noMatches') : t('empty')}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span dir="ltr">{r.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          r.unsubscribedAt ? 'bg-muted text-muted-foreground' : 'bg-green-50 text-green-700'
                        }`}
                      >
                        {r.unsubscribedAt ? t('unsubscribed') : t('active')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{sourceLabel(r.source)}</td>
                    <td className="px-4 py-3 text-muted-foreground uppercase">{r.locale}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{dateFormat.format(new Date(r.consentAt))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            aria-label={t('previousPage')}
          >
            <ChevronLeft size={14} className="rtl:rotate-180" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages} · {total}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            aria-label={t('nextPage')}
          >
            <ChevronRight size={14} className="rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}
