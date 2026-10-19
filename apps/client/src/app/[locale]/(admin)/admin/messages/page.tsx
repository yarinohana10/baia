'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Mail, RotateCcw, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type MessageStatus = 'NEW' | 'HANDLED';

type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  orderNumber: string | null;
  subject: string | null;
  message: string;
  locale: string;
  status: MessageStatus;
  createdAt: string;
};

type Filter = 'ALL' | MessageStatus;

const PAGE_SIZE = 20;

/** Contact-form inbox: new first, expand to read, reply via mailto, mark handled. */
export default function AdminMessagesPage() {
  const t = useTranslations('admin.messages');
  const locale = useLocale();
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { dateStyle: 'medium', timeStyle: 'short' }),
    [locale],
  );

  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => setPage(1), [debouncedSearch, filter]);

  const load = useCallback(
    async (isCancelled: () => boolean) => {
      setLoading(true);
      try {
        const res = await api.get('/admin/contact-messages', {
          params: {
            status: filter === 'ALL' ? undefined : filter,
            search: debouncedSearch || undefined,
            page,
            limit: PAGE_SIZE,
          },
        });
        if (isCancelled()) return;
        setMessages(res.data.messages);
        setTotal(res.data.total);
        setNewCount(res.data.newCount);
        setTotalPages(Math.max(1, res.data.totalPages));
        setError(null);
      } catch {
        if (!isCancelled()) setError(t('loadFailed'));
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    [filter, debouncedSearch, page, t],
  );

  useEffect(() => {
    let cancelled = false;
    load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function setStatus(message: ContactMessage, status: MessageStatus) {
    setUpdating(message.id);
    try {
      const res = await api.put(`/admin/contact-messages/${message.id}`, { status });
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: res.data.status } : m)));
      setNewCount((c) => Math.max(0, c + (status === 'NEW' ? 1 : -1)));
    } catch {
      setError(t('updateFailed'));
    } finally {
      setUpdating(null);
    }
  }

  function mailto(m: ContactMessage) {
    const subject = m.subject ? `${t('replySubject')} - ${m.subject}` : t('replySubject');
    const quoted = m.message
      .split('\n')
      .map((l) => `> ${l}`)
      .join('\n');
    return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`\n\n${quoted}`)}`;
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'ALL', label: t('filterAll') },
    { key: 'NEW', label: t('filterNew') },
    { key: 'HANDLED', label: t('filterHandled') },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${total})`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <p className="mt-2 text-sm font-medium text-ocean-700" aria-live="polite">
          {t('newCount', { count: newCount })}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={t('dismiss')}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" className="inline-flex rounded-lg border border-border bg-background p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filter === f.key ? 'bg-ocean-700 text-white' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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
      </div>

      <Card className="divide-y divide-border overflow-hidden p-0" aria-busy={loading}>
        {messages.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {loading ? '…' : debouncedSearch || filter !== 'ALL' ? t('noMatches') : t('empty')}
          </p>
        ) : (
          messages.map((m) => {
            const open = expanded === m.id;
            const isNew = m.status === 'NEW';
            return (
              <article key={m.id} className={isNew ? 'bg-ocean-50/40' : undefined}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : m.id)}
                  aria-expanded={open}
                  aria-controls={`msg-${m.id}`}
                  aria-label={`${open ? t('collapse') : t('expand')}: ${m.name}`}
                  className="flex w-full items-start gap-3 px-4 py-4 text-start hover:bg-muted/50"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew ? 'bg-ocean-600' : 'bg-transparent'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`text-sm ${isNew ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                        {m.name}
                      </span>
                      <span dir="ltr" className="text-xs text-muted-foreground">
                        {m.email}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          isNew ? 'bg-ocean-100 text-ocean-800' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isNew ? t('statusNew') : t('statusHandled')}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-sm text-foreground/80">
                      <span className="font-medium">{m.subject || t('noSubject')}</span>
                      <span className="text-muted-foreground"> — {m.message}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {dateFormat.format(new Date(m.createdAt))}
                  </span>
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`mt-0.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>

                {open && (
                  <div id={`msg-${m.id}`} className="px-4 pb-5 ps-9">
                    <dl className="mb-4 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:hidden">{dateFormat.format(new Date(m.createdAt))}</div>
                      {m.orderNumber && (
                        <div>
                          <dt className="inline">{t('orderNumber')}: </dt>
                          <dd className="inline font-medium text-foreground" dir="ltr">
                            {m.orderNumber}
                          </dd>
                        </div>
                      )}
                      {m.phone && (
                        <div>
                          <dt className="inline">{t('phone')}: </dt>
                          <dd className="inline">
                            <a href={`tel:${m.phone.replace(/[^\d+]/g, '')}`} dir="ltr" className="font-medium text-foreground hover:text-ocean-700">
                              {m.phone}
                            </a>
                          </dd>
                        </div>
                      )}
                      <div>
                        <dt className="inline">{t('language')}: </dt>
                        <dd className="inline font-medium text-foreground">{m.locale === 'en' ? 'English' : 'עברית'}</dd>
                      </div>
                    </dl>
                    <p
                      dir="auto"
                      className="whitespace-pre-wrap break-words rounded-lg border border-border bg-background p-4 text-sm leading-relaxed text-foreground"
                    >
                      {m.message}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={mailto(m)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ocean-700 px-3 text-sm font-medium text-white hover:bg-ocean-800"
                      >
                        <Mail size={14} aria-hidden="true" />
                        {t('reply')}
                      </a>
                      {isNew ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={updating === m.id}
                          onClick={() => setStatus(m, 'HANDLED')}
                          className="gap-1.5"
                        >
                          <Check size={14} aria-hidden="true" />
                          {t('markHandled')}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={updating === m.id}
                          onClick={() => setStatus(m, 'NEW')}
                          className="gap-1.5 text-muted-foreground"
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                          {t('markNew')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })
        )}
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
