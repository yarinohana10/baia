'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Check, ChevronLeft, ChevronRight, Clock, Phone, RotateCcw, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatShekels as money, ORDER_STATUS_COLORS, ORDER_STATUS_LABEL_KEYS } from '@/components/admin/order-status';

type RequestStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'AUTO_CANCELLED';

type AdminCancellation = {
  id: string;
  status: RequestStatus;
  reason: string;
  details: string | null;
  contactPhone: string | null;
  adminNote: string | null;
  feeAmount: string;
  refundAmount: string | null;
  createdAt: string;
  resolvedAt: string | null;
  insideWindow: boolean;
  requiresReturn: boolean;
  suggestedFee: number;
  windowDeadline: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    customerEmail: string;
    recipientName: string | null;
    phone: string | null;
    total: string;
    deliveryMethod: 'COURIER' | 'PICKUP_POINT';
    createdAt: string;
    paidAt: string | null;
    shippedAt: string | null;
    paid: boolean;
    hasPaymentRef: boolean;
  };
};

type ListResponse = { requests: AdminCancellation[]; total: number; totalPages: number; windowHours: number };

const FILTERS: (RequestStatus | '')[] = ['REQUESTED', 'APPROVED', 'REJECTED', 'AUTO_CANCELLED', ''];

const STATUS_STYLES: Record<RequestStatus, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-muted text-muted-foreground',
  AUTO_CANCELLED: 'bg-blue-50 text-blue-700',
};

function elapsed(fromIso: string, t: (key: 'hours' | 'days', values: { count: number }) => string) {
  const hours = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 3_600_000));
  return hours < 48 ? t('hours', { count: hours }) : t('days', { count: Math.floor(hours / 24) });
}

export default function AdminCancellationsPage() {
  const t = useTranslations('admin.cancellations');
  const tOrders = useTranslations('admin.orders');
  const tReasons = useTranslations('cancellation.reasons');
  const locale = useLocale();
  const dateTime = useMemo(
    () => new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { dateStyle: 'short', timeStyle: 'short' }),
    [locale],
  );

  const [filter, setFilter] = useState<RequestStatus | ''>('REQUESTED');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ListResponse>('/admin/cancellations', {
        params: { status: filter || undefined, page, limit: 20 },
      });
      setData(res.data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [filter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const reasonLabel = (reason: string) => (tReasons.has(reason) ? tReasons(reason) : reason);

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{t('title')}</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          {t('subtitle', { hours: data?.windowHours ?? 48 })}
        </p>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={cn(
            'mb-6 flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm',
            notice.kind === 'error' ? 'bg-red-50 text-destructive' : 'bg-green-50 text-green-700',
          )}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="rounded p-1 opacity-70 hover:opacity-100" aria-label={tOrders('dismiss')}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f || 'all'}
            variant={filter === f ? 'default' : 'outline'}
            size="xs"
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={cn(filter === f && 'bg-ocean-700 hover:bg-ocean-800')}
          >
            {f ? t(`status.${f}`) : t('all')}
          </Button>
        ))}
      </div>

      {loadError ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-destructive">
          {t('loadFailed')}
        </p>
      ) : !data ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('loading')}</p>
      ) : data.requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {filter === 'REQUESTED' ? t('emptyOpen') : t('empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.requests.map((request) => (
            <CancellationCard
              key={request.id}
              request={request}
              windowHours={data.windowHours}
              reasonLabel={reasonLabel}
              dateTime={dateTime}
              elapsedText={(iso) => elapsed(iso, (key, values) => t(`elapsed.${key}`, values))}
              orderStatusLabel={(s) =>
                s in ORDER_STATUS_LABEL_KEYS
                  ? tOrders(ORDER_STATUS_LABEL_KEYS[s as keyof typeof ORDER_STATUS_LABEL_KEYS])
                  : s
              }
              onResolved={(text, kind) => {
                setNotice({ kind, text });
                void load();
              }}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label={tOrders('previousPage')}>
            <ChevronLeft size={14} className="rtl:rotate-180" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {data.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => setPage(Math.min(data.totalPages, page + 1))}
            disabled={page === data.totalPages}
            aria-label={tOrders('nextPage')}
          >
            <ChevronRight size={14} className="rtl:rotate-180" />
          </Button>
        </div>
      )}
    </div>
  );
}

function CancellationCard({
  request,
  windowHours,
  reasonLabel,
  dateTime,
  elapsedText,
  orderStatusLabel,
  onResolved,
}: {
  request: AdminCancellation;
  windowHours: number;
  reasonLabel: (reason: string) => string;
  dateTime: Intl.DateTimeFormat;
  elapsedText: (iso: string) => string;
  orderStatusLabel: (status: string) => string;
  onResolved: (text: string, kind: 'success' | 'error') => void;
}) {
  const t = useTranslations('admin.cancellations');
  const [fee, setFee] = useState(String(request.suggestedFee));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { order } = request;
  const total = parseFloat(order.total);
  const feeValue = Number(fee);
  const feeValid = fee.trim() !== '' && Number.isFinite(feeValue) && feeValue >= 0 && feeValue <= total;
  const phone = request.contactPhone || order.phone;
  const open = request.status === 'REQUESTED';

  const resolve = async (action: 'approve' | 'reject') => {
    if (busy) return;
    if (action === 'approve' && !feeValid) return;
    const question =
      action === 'approve'
        ? order.paid
          ? t('confirmApprove', { refund: money(Math.max(0, total - feeValue)), number: order.orderNumber })
          : t('confirmApproveUnpaid', { number: order.orderNumber })
        : t('confirmReject', { number: order.orderNumber });
    if (!window.confirm(question)) return;
    setBusy(action);
    setError(null);
    try {
      const res = await api.put(`/admin/cancellations/${request.id}`, {
        action,
        feeAmount: action === 'approve' ? Math.round(feeValue * 100) / 100 : undefined,
        adminNote: note.trim() || undefined,
      });
      if (action === 'approve' && res.data?.refundFailed) {
        onResolved(t('approvedRefundFailed', { number: order.orderNumber }), 'error');
      } else {
        onResolved(t(action === 'approve' ? 'approved' : 'rejected', { number: order.orderNumber }), 'success');
      }
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setError(status === 409 ? t('alreadyHandled') : t('actionFailed'));
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                className="font-mono text-sm font-semibold text-foreground hover:text-ocean-700 hover:underline"
                dir="ltr"
              >
                {order.orderNumber}
              </Link>
              <span className={cn('rounded-full px-2 py-0.5 text-xs', STATUS_STYLES[request.status])}>{t(`status.${request.status}`)}</span>
              <span className={cn('rounded-full px-2 py-0.5 text-xs uppercase tracking-wider', ORDER_STATUS_COLORS[order.status] || '')}>
                {orderStatusLabel(order.status)}
              </span>
            </div>
            <p className="text-sm text-foreground">
              {order.recipientName ?? order.customerEmail}
              {order.recipientName && <span className="text-muted-foreground"> · {order.customerEmail}</span>}
            </p>
            {phone && (
              <a href={`tel:${phone}`} dir="ltr" className="inline-flex items-center gap-1 text-sm text-ocean-700 hover:underline">
                <Phone size={12} /> {phone}
              </a>
            )}
          </div>
          <div className="text-end">
            <p className="font-serif text-xl text-foreground">{money(order.total)}</p>
            <p className="text-xs text-muted-foreground">
              {t('orderedAgo', { time: elapsedText(order.paidAt ?? order.createdAt) })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1',
              request.insideWindow ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700',
            )}
          >
            <Clock size={12} />
            {request.insideWindow ? t('insideWindow', { hours: windowHours }) : t('outsideWindow', { hours: windowHours })}
          </span>
          {request.requiresReturn && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-purple-700">
              <RotateCcw size={12} /> {t('requiresReturn')}
            </span>
          )}
          {!order.paid && <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{t('unpaid')}</span>}
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {t('requestedAt', { date: dateTime.format(new Date(request.createdAt)) })}
          </span>
        </div>

        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <p>
            <span className="text-muted-foreground">{t('reason')}: </span>
            <span className="font-medium">{reasonLabel(request.reason)}</span>
          </p>
          {request.details && <p className="mt-1 whitespace-pre-line text-foreground">{request.details}</p>}
        </div>

        {open ? (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor={`fee-${request.id}`}>{t('fee')}</Label>
              <Input
                id={`fee-${request.id}`}
                type="number"
                inputMode="decimal"
                min={0}
                max={total}
                step="0.01"
                dir="ltr"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                aria-invalid={!feeValid}
              />
              <p className="text-xs text-muted-foreground">
                {request.insideWindow ? t('feeHintInside') : t('feeHintOutside', { amount: money(request.suggestedFee) })}
              </p>
              {order.paid && feeValid && (
                <p className="text-xs text-foreground">{t('refundPreview', { amount: money(Math.max(0, total - feeValue)) })}</p>
              )}
              {order.paid && !order.hasPaymentRef && <p className="text-xs text-amber-700">{t('manualRefund')}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`note-${request.id}`}>{t('note')}</Label>
              <Textarea
                id={`note-${request.id}`}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={t('notePlaceholder')}
              />
            </div>
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive sm:col-span-2">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                type="button"
                onClick={() => resolve('approve')}
                disabled={!!busy || !feeValid}
                className="gap-1.5 bg-ocean-700 text-white hover:bg-ocean-800"
              >
                <Check size={14} /> {busy === 'approve' ? t('working') : t('approve')}
              </Button>
              <Button type="button" variant="outline" onClick={() => resolve('reject')} disabled={!!busy} className="gap-1.5">
                <X size={14} /> {busy === 'reject' ? t('working') : t('reject')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
            {request.resolvedAt && <p>{t('resolvedAt', { date: dateTime.format(new Date(request.resolvedAt)) })}</p>}
            {request.status !== 'REJECTED' && (
              <p>
                {request.refundAmount ? t('refunded', { amount: money(request.refundAmount) }) : t('noRefund')}
                {Number(request.feeAmount) > 0 && ` · ${t('feeKept', { amount: money(request.feeAmount) })}`}
              </p>
            )}
            {request.adminNote && <p className="whitespace-pre-line">{t('noteLabel', { note: request.adminNote })}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
