'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatShekels } from '@/components/admin/order-status';

type CustomerRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};

const PAGE_SIZE = 20;

/** Reads ?q=&page= once on mount so the list survives going to a customer and back. */
function initialQuery() {
  if (typeof window === 'undefined') return { q: '', page: 1 };
  const params = new URLSearchParams(window.location.search);
  const page = parseInt(params.get('page') ?? '1', 10);
  return { q: params.get('q') ?? '', page: Number.isFinite(page) && page > 0 ? page : 1 };
}

export default function AdminCustomersPage() {
  const t = useTranslations('admin.customers');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { dateStyle: 'medium' }),
    [locale],
  );

  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const skipPageReset = useRef(true);

  useEffect(() => {
    const init = initialQuery();
    setSearch(init.q);
    setDebouncedSearch(init.q.trim());
    setPage(init.page);
    setReady(true);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // A new search term starts from the first page (but not the one restored from the URL).
  useEffect(() => {
    if (!ready) return;
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, ready]);

  // Keep ?q=&page= in the URL so Back from a customer restores the list.
  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('q', debouncedSearch);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [ready, debouncedSearch, page, pathname, router]);

  const fetchCustomers = useCallback(
    async (isCancelled: () => boolean) => {
      setLoading(true);
      try {
        const res = await api.get('/admin/customers', {
          params: { search: debouncedSearch || undefined, page, limit: PAGE_SIZE },
        });
        if (isCancelled()) return;
        setCustomers(res.data.customers);
        setTotal(res.data.total);
        setTotalPages(Math.max(1, res.data.totalPages));
        setError(null);
      } catch {
        if (!isCancelled()) setError(t('loadFailed'));
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [debouncedSearch, page, t],
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchCustomers(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [ready, fetchCustomers]);

  const detailHref = (id: string) => `/admin/customers/${id}`;
  const th = 'text-start px-4 py-3 font-medium text-muted-foreground';

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${total})`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('paidNote')}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-destructive"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded p-1 opacity-70 hover:opacity-100"
            aria-label={t('dismiss')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="ps-9"
        />
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm" aria-busy={loading}>
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className={th}>{t('name')}</th>
                <th className={th}>{t('email')}</th>
                <th className={th}>{t('registered')}</th>
                <th className={th}>{t('orders')}</th>
                <th className={th}>{t('totalSpent')}</th>
                <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {loading ? '…' : debouncedSearch ? t('noMatches') : t('noCustomers')}
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={detailHref(c.id)} className="font-medium text-foreground hover:text-ocean-600">
                        {c.name || <span className="text-muted-foreground">{t('noName')}</span>}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span dir="ltr">{c.email}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {dateFormat.format(new Date(c.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.orderCount}</td>
                    <td className="px-4 py-3 font-medium">{formatShekels(c.totalSpent)}</td>
                    <td className="px-4 py-3 text-end">
                      <Link
                        href={detailHref(c.id)}
                        aria-label={t('view')}
                        className={buttonVariants({
                          variant: 'ghost',
                          size: 'icon-sm',
                          className: 'text-muted-foreground hover:text-ocean-600',
                        })}
                      >
                        <Eye size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
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
            {page} / {totalPages}
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
