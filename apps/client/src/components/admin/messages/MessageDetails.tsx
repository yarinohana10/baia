'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Mail, RotateCcw } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAdminDate } from '@/lib/admin/format';
import { Button } from '@/components/ui/button';
import { replyMailto, type ContactMessage, type MessageStatus } from './types';

/** The opened message: contact details, full text, reply link and the handled / new toggle. */
export function MessageDetails({
  message: m,
  onStatusChanged,
  onError,
}: {
  message: ContactMessage;
  onStatusChanged: (id: string, status: MessageStatus) => void;
  onError: () => void;
}) {
  const t = useTranslations('admin.messages');
  const locale = useLocale();
  const [updating, setUpdating] = useState(false);
  const isNew = m.status === 'NEW';

  async function setStatus(status: MessageStatus) {
    setUpdating(true);
    try {
      const res = await api.put(`/admin/contact-messages/${m.id}`, { status });
      onStatusChanged(m.id, res.data.status);
    } catch {
      onError();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div id={`msg-${m.id}`} className="px-4 pb-5 ps-9">
      <dl className="mb-4 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:hidden">{formatAdminDate(m.createdAt, locale, 'mediumTime')}</div>
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
          href={replyMailto(m, t('replySubject'))}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-ocean-700 px-3 text-sm font-medium text-white hover:bg-ocean-800"
        >
          <Mail size={14} aria-hidden="true" />
          {t('reply')}
        </a>
        {isNew ? (
          <Button type="button" variant="outline" disabled={updating} onClick={() => setStatus('HANDLED')} className="gap-1.5">
            <Check size={14} aria-hidden="true" />
            {t('markHandled')}
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            disabled={updating}
            onClick={() => setStatus('NEW')}
            className="gap-1.5 text-muted-foreground"
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t('markNew')}
          </Button>
        )}
      </div>
    </div>
  );
}
