'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Eye, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { ORDER_STATUS_COLORS as statusColors, formatShekels as money } from '@/components/admin/order-status';

const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

/** Statuses that return stock to inventory, so they ask for confirmation first. */
const RESTOCK_STATUSES = ['CANCELLED', 'REFUNDED'];

type OrderItem = {
  id: string;
  productName: string;
  productNameHe?: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: string;
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  recipientName?: string | null;
  phone?: string | null;
  status: string;
  subtotal: string;
  shippingCost: string;
  discountAmount: string;
  total: string;
  coupon?: { code: string } | null;
  trackingNumber?: string | null;
  paymentRef?: string | null;
  shippingCity: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment?: string | null;
  shippingZip?: string | null;
  createdAt: string;
  items: OrderItem[];
  allowedTransitions?: string[];
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

function selectClassName() {
  return cn(
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  );
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders');
  const locale = useLocale();
  const intlLocale = locale === 'he' ? 'he-IL' : 'en-IL';
  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short' }),
    [intlLocale],
  );
  const dateTimeFormat = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short', timeStyle: 'short' }),
    [intlLocale],
  );

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      PENDING_PAYMENT: t('pendingPayment'),
      CONFIRMED: t('confirmed'),
      PROCESSING: t('processing'),
      SHIPPED: t('shipped'),
      DELIVERED: t('delivered'),
      CANCELLED: t('cancelled'),
      REFUNDED: t('refunded'),
    };
    return labels[s] || s;
  };
  const itemName = (item: OrderItem) =>
    locale === 'he' && item.productNameHe ? item.productNameHe : item.productName;

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search.trim(), 300);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const updatingRef = useRef(false);
  const loadingDetailRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const fetchOrders = useCallback(
    async (isCancelled: () => boolean = () => false) => {
      try {
        const res = await api.get('/admin/orders', {
          params: { status: statusFilter || undefined, search: debouncedSearch || undefined, page, limit: 20 },
        });
        if (isCancelled()) return;
        setOrders(res.data.orders);
        setTotal(res.data.total);
        setTotalPages(Math.max(1, res.data.totalPages));
      } catch {
        if (!isCancelled()) setNotice({ kind: 'error', text: t('loadFailed') });
      }
    },
    [statusFilter, debouncedSearch, page, t],
  );

  useEffect(() => {
    let cancelled = false;
    fetchOrders(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchOrders]);

  // Deep link from the customer page: /admin/orders?q=<order number>.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearch(q);
  }, []);

  // New search terms start from the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const closeDetail = useCallback(() => {
    setSelectedOrder(null);
    setDialogError(null);
    returnFocusRef.current?.focus();
  }, []);

  // Dialog: focus on open, close on Escape.
  const openOrderId = selectedOrder?.id;
  useEffect(() => {
    if (!openOrderId) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openOrderId, closeDetail]);

  const errorMessage = (err: unknown, fallback: string) => {
    if (!isAxiosError(err) || !err.response) return fallback;
    const { status, data } = err.response;
    const message: unknown = data?.message;
    if (status === 409) {
      return typeof message === 'string' && /reload/i.test(message)
        ? t('statusChangedMeanwhile')
        : t('transitionNotAllowed');
    }
    if (status === 404) return t('orderNotFound');
    if (typeof message === 'string' && message) return `${fallback} (${message})`;
    return fallback;
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus || updatingRef.current) return;
    if (newStatus !== selectedOrder.status && RESTOCK_STATUSES.includes(newStatus)) {
      const ok = confirm(newStatus === 'CANCELLED' ? t('confirmCancel') : t('confirmRefund'));
      if (!ok) return;
    }
    updatingRef.current = true;
    setUpdating(true);
    setDialogError(null);

    try {
      await api.put(`/admin/orders/${selectedOrder.id}/status`, {
        status: newStatus,
        trackingNumber,
      });
      closeDetail();
      setNewStatus('');
      setTrackingNumber('');
      setNotice({ kind: 'success', text: `${t('updated')}: ${selectedOrder.orderNumber}` });
      fetchOrders();
    } catch (err) {
      setDialogError(errorMessage(err, t('updateFailed')));
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  };

  const openDetail = async (id: string, trigger: HTMLElement) => {
    if (loadingDetailRef.current) return;
    loadingDetailRef.current = true;
    returnFocusRef.current = trigger;

    try {
      const res = await api.get(`/admin/orders/${id}`);
      setDialogError(null);
      setSelectedOrder(res.data);
      setNewStatus(res.data.status);
      setTrackingNumber(res.data.trackingNumber || '');
    } catch (err) {
      setNotice({ kind: 'error', text: errorMessage(err, t('detailFailed')) });
    } finally {
      loadingDetailRef.current = false;
    }
  };

  const nextStatuses = selectedOrder?.allowedTransitions ?? [];
  const unchanged =
    !!selectedOrder &&
    newStatus === selectedOrder.status &&
    trackingNumber.trim() === (selectedOrder.trackingNumber || '');

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${total})`}</h1>
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
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="rounded p-1 opacity-70 hover:opacity-100"
            aria-label={t('dismiss')}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 max-w-md">
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

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button
          variant={!statusFilter ? 'default' : 'outline'}
          size="xs"
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={cn(!statusFilter && 'bg-ocean-700 hover:bg-ocean-800')}
        >
          {t('all')}
        </Button>
        {ORDER_STATUSES.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="xs"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn(statusFilter === s && 'bg-ocean-700 hover:bg-ocean-800')}
          >
            {statusLabel(s)}
          </Button>
        ))}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDetail();
          }}
        >
          <Card
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-dialog-title"
            tabIndex={-1}
            className="max-w-lg w-full max-h-[80vh] overflow-y-auto outline-none"
          >
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle id="order-dialog-title" className="font-mono">{selectedOrder.orderNumber}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeDetail}
                  className="text-muted-foreground"
                >
                  {t('close')}
                </Button>
              </div>

              <div className="text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">{t('status')}:</span>{' '}
                  <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider ${statusColors[selectedOrder.status] || ''}`}>
                    {statusLabel(selectedOrder.status)}
                  </span>
                </p>
                {selectedOrder.recipientName && (
                  <p><span className="text-muted-foreground">{t('recipient')}:</span> {selectedOrder.recipientName}</p>
                )}
                {selectedOrder.phone && (
                  <p>
                    <span className="text-muted-foreground">{t('phone')}:</span>{' '}
                    <a href={`tel:${selectedOrder.phone}`} dir="ltr" className="hover:underline">{selectedOrder.phone}</a>
                  </p>
                )}
                <p>
                  <span className="text-muted-foreground">{t('email')}:</span>{' '}
                  <a href={`mailto:${selectedOrder.customerEmail}`} className="hover:underline">{selectedOrder.customerEmail}</a>
                </p>
                <p><span className="text-muted-foreground">{t('date')}:</span> {dateTimeFormat.format(new Date(selectedOrder.createdAt))}</p>
                <p>
                  <span className="text-muted-foreground">{t('address')}:</span>{' '}
                  {selectedOrder.shippingStreet} {selectedOrder.shippingNumber}
                  {selectedOrder.shippingApartment ? `, ${t('apt')} ${selectedOrder.shippingApartment}` : ''},{' '}
                  {selectedOrder.shippingCity}
                  {selectedOrder.shippingZip ? ` ${selectedOrder.shippingZip}` : ''}
                </p>
                {selectedOrder.paymentRef && (
                  <p><span className="text-muted-foreground">{t('payment')}:</span> {selectedOrder.paymentRef}</p>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1 text-sm">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3">
                    <span>{itemName(item)} ({item.color}/{item.size}) x{item.quantity}</span>
                    <span>{money(parseFloat(item.unitPrice) * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('subtotal')}</span>
                    <span>{money(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>{t('shipping')}</span>
                    <span>{money(selectedOrder.shippingCost)}</span>
                  </div>
                  {parseFloat(selectedOrder.discountAmount) > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>
                        {t('discount')}
                        {selectedOrder.coupon?.code && (
                          <>
                            {' '}({t('coupon')}: <span className="font-mono">{selectedOrder.coupon.code}</span>)
                          </>
                        )}
                      </span>
                      <span>-{money(selectedOrder.discountAmount)}</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.discountAmount) <= 0 && selectedOrder.coupon?.code && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>{t('coupon')}</span>
                      <span className="font-mono">{selectedOrder.coupon.code}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-2 font-medium flex justify-between">
                  <span>{t('total')}</span>
                  <span>{money(selectedOrder.total)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-status">{t('updateStatus')}</Label>
                  {nextStatuses.length > 0 ? (
                    <select
                      id="order-status"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className={selectClassName()}
                    >
                      <option value={selectedOrder.status}>
                        {`${statusLabel(selectedOrder.status)} (${t('current')})`}
                      </option>
                      {nextStatuses.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p id="order-status" className="text-sm text-muted-foreground">{t('finalStatus')}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order-tracking-number">{t('trackingNumber')}</Label>
                  <Input
                    id="order-tracking-number"
                    type="text"
                    dir="ltr"
                    maxLength={100}
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    placeholder="IL123456789"
                  />
                </div>
                {dialogError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
                    {dialogError}
                  </p>
                )}
                <Button
                  type="button"
                  onClick={handleStatusUpdate}
                  disabled={updating || unchanged}
                  className="bg-ocean-700 text-white hover:bg-ocean-800"
                >
                  {updating ? t('updating') : t('update')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('order')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('customer')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('items')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('total')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('status')}</th>
                <th className="text-start px-4 py-3 font-medium text-muted-foreground">{t('date')}</th>
                <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t('noOrders')}</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.recipientName && <div className="text-foreground">{order.recipientName}</div>}
                      <div className={cn(order.recipientName && 'text-xs')}>{order.customerEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{order.items.length}</td>
                    <td className="px-4 py-3 font-medium">{money(order.total)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider ${statusColors[order.status] || ''}`}>
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {dateFormat.format(new Date(order.createdAt))}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => openDetail(order.id, e.currentTarget)}
                        className="text-muted-foreground hover:text-ocean-600"
                        aria-label={t('viewDetails')}
                      >
                        <Eye size={14} />
                      </Button>
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
