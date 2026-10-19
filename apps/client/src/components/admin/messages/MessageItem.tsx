'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { formatAdminDate } from '@/lib/admin/format';
import { MessageDetails } from './MessageDetails';
import type { ContactMessage, MessageStatus } from './types';

/** One inbox row: a summary button that expands to the full message. */
export function MessageItem({
  message: m,
  open,
  onToggle,
  onStatusChanged,
  onError,
}: {
  message: ContactMessage;
  open: boolean;
  onToggle: (id: string) => void;
  onStatusChanged: (id: string, status: MessageStatus) => void;
  onError: () => void;
}) {
  const t = useTranslations('admin.messages');
  const locale = useLocale();
  const isNew = m.status === 'NEW';

  return (
    <article className={isNew ? 'bg-ocean-50/40' : undefined}>
      <button
        type="button"
        onClick={() => onToggle(m.id)}
        aria-expanded={open}
        aria-controls={`msg-${m.id}`}
        aria-label={`${open ? t('collapse') : t('expand')}: ${m.name}`}
        className="flex w-full items-start gap-3 px-4 py-4 text-start hover:bg-muted/50"
      >
        <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isNew ? 'bg-ocean-600' : 'bg-transparent'}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={`text-sm ${isNew ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>{m.name}</span>
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
          {formatAdminDate(m.createdAt, locale, 'mediumTime')}
        </span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`mt-0.5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && <MessageDetails message={m} onStatusChanged={onStatusChanged} onError={onError} />}
    </article>
  );
}
