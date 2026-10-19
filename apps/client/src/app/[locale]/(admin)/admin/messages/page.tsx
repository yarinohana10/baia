'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminList } from '@/hooks/admin/useAdminList';
import { useListQuery } from '@/hooks/admin/useListQuery';
import type { ListPage } from '@/hooks/admin/admin-list';
import { Card } from '@/components/ui/card';
import { NoticeBanner } from '@/components/admin/common/NoticeBanner';
import { Pagination } from '@/components/admin/common/Pagination';
import { SearchField } from '@/components/admin/common/SearchField';
import { MessageFilters } from '@/components/admin/messages/MessageFilters';
import { MessageItem } from '@/components/admin/messages/MessageItem';
import type { ContactMessage, MessageFilter, MessageStatus } from '@/components/admin/messages/types';

const PAGE_SIZE = 20;

type MessagesResponse = { messages: ContactMessage[]; total: number; totalPages: number; newCount: number };
type InboxMeta = { newCount: number };

const selectMessages = (data: MessagesResponse): ListPage<ContactMessage, InboxMeta> => ({
  items: data.messages,
  total: data.total,
  totalPages: data.totalPages,
  meta: { newCount: data.newCount },
});

/** Contact-form inbox: new first, expand to read, reply via mailto, mark handled. */
export default function AdminMessagesPage() {
  const t = useTranslations('admin.messages');
  const [query, { setSearch, setFilter, setPage }] = useListQuery<MessageFilter>('ALL');
  const list = useAdminList({
    url: '/admin/contact-messages',
    params: {
      status: query.filter === 'ALL' ? undefined : query.filter,
      search: query.appliedSearch || undefined,
      page: query.page,
      limit: PAGE_SIZE,
    },
    select: selectMessages,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updateFailed, setUpdateFailed] = useState(false);

  const error = updateFailed ? t('updateFailed') : list.error ? t('loadFailed') : null;
  const dismissError = () => {
    setUpdateFailed(false);
    list.dismissError();
  };

  const onStatusChanged = (id: string, status: MessageStatus) =>
    list.patch({
      items: (messages) => messages.map((m) => (m.id === id ? { ...m, status } : m)),
      meta: ({ newCount }) => ({ newCount: Math.max(0, newCount + (status === 'NEW' ? 1 : -1)) }),
    });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${list.total})`}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        <p className="mt-2 text-sm font-medium text-ocean-700" aria-live="polite">
          {t('newCount', { count: list.meta?.newCount ?? 0 })}
        </p>
      </div>

      {error && (
        <NoticeBanner notice={{ kind: 'error', text: error }} onDismiss={dismissError} dismissLabel={t('dismiss')} className="mb-6" />
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MessageFilters value={query.filter} onChange={setFilter} />
        <SearchField value={query.search} onChange={setSearch} placeholder={t('searchPlaceholder')} className="w-full" />
      </div>

      <Card className="divide-y divide-border overflow-hidden p-0" aria-busy={list.loading}>
        {list.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {list.loading ? '…' : query.appliedSearch || query.filter !== 'ALL' ? t('noMatches') : t('empty')}
          </p>
        ) : (
          list.items.map((m) => (
            <MessageItem
              key={m.id}
              message={m}
              open={expanded === m.id}
              onToggle={(id) => setExpanded(expanded === id ? null : id)}
              onStatusChanged={onStatusChanged}
              onError={() => setUpdateFailed(true)}
            />
          ))
        )}
      </Card>

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
