'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Send } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Built once, in the store's time zone. */
const EMAIL_TIME_FORMAT = {
  he: new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }),
  en: new Intl.DateTimeFormat('en-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }),
};

type EmailLogRow = {
  id: string;
  template: string;
  to: string;
  subject: string;
  locale: string;
  status: 'SENT' | 'FAILED';
  attempts: number;
  error: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<EmailLogRow['status'], string> = {
  SENT: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-destructive',
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

/**
 * Admin order panel section: every email sent about the order
 * (GET /admin/orders/:id/emails) and a "resend confirmation" button for paid
 * orders (POST /admin/orders/:id/resend-confirmation). Self-contained so the
 * orders page only renders it; `refreshKey` reloads it after a status change.
 */
export function OrderEmailsPanel({
  orderId,
  customerEmail,
  canResend,
  refreshKey,
}: {
  orderId: string;
  customerEmail: string;
  canResend: boolean;
  refreshKey?: string;
}) {
  const t = useTranslations('admin.orderEmails');
  const locale = useLocale();
  const [data, setData] = useState<{ orderId: string; rows: EmailLogRow[] } | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<EmailLogRow[]>(`/admin/orders/${encodeURIComponent(orderId)}/emails`)
      .then((res) => {
        if (cancelled) return;
        setData({ orderId, rows: res.data });
        setFailedFor(null);
      })
      .catch(() => !cancelled && setFailedFor(orderId));
    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey, reloadKey]);

  // A different order starts with a clean slate.
  useEffect(() => setNotice(null), [orderId]);

  const resend = useCallback(async () => {
    if (sending || !confirm(t('confirmResend', { email: customerEmail }))) return;
    setSending(true);
    setNotice(null);
    try {
      const res = await api.post<{ status: 'SENT' | 'FAILED' }>(
        `/admin/orders/${encodeURIComponent(orderId)}/resend-confirmation`,
      );
      setNotice(
        res.data.status === 'SENT'
          ? { kind: 'success', text: t('resent', { email: customerEmail }) }
          : { kind: 'error', text: t('resendFailed') },
      );
    } catch (err) {
      const notAllowed = isAxiosError(err) && err.response?.status === 409;
      setNotice({ kind: 'error', text: notAllowed ? t('resendNotAllowed') : t('resendFailed') });
    } finally {
      setSending(false);
      setReloadKey((k) => k + 1);
    }
  }, [sending, t, customerEmail, orderId]);

  const dateTimeFormat = EMAIL_TIME_FORMAT[locale === 'he' ? 'he' : 'en'];
  const rows = data?.orderId === orderId ? data.rows : null;
  const templateLabel = (name: string) => (t.has(`templates.${name}`) ? t(`templates.${name}`) : name);

  return (
    <div className="border-t border-border pt-3 space-y-2 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <Send size={14} className="text-ocean-700" aria-hidden="true" /> {t('title')}
      </p>
      {failedFor === orderId && !rows ? (
        <p className="text-xs text-destructive">{t('loadFailed')}</p>
      ) : !rows ? (
        <div className="h-10 rounded-lg bg-muted/60 animate-pulse" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-lg bg-muted/60 px-3 py-2 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5"
            >
              <span
                className={cn('rounded-full px-2 py-0.5 font-medium', STATUS_COLORS[row.status])}
                title={row.error ?? undefined}
              >
                {row.status === 'SENT' ? t('sent') : t('failed')}
              </span>
              <span className="font-medium">{templateLabel(row.template)}</span>
              <span className="text-muted-foreground break-all" dir="ltr">
                {row.to}
              </span>
              <span className="text-muted-foreground">{dateTimeFormat.format(new Date(row.createdAt))}</span>
              {row.attempts > 1 && <span className="text-muted-foreground">({t('attempts', { count: row.attempts })})</span>}
              {row.error && (
                <span className="basis-full truncate text-destructive" title={row.error}>
                  {t('errorLabel', { error: row.error })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {canResend && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={resend} disabled={sending}>
            {sending ? t('resending') : t('resend')}
          </Button>
        </div>
      )}
      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn('text-xs', notice.kind === 'error' ? 'text-destructive' : 'text-green-700')}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
