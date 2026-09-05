'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';

const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-50 text-yellow-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  PROCESSING: 'bg-indigo-50 text-indigo-600',
  SHIPPED: 'bg-purple-50 text-purple-600',
  DELIVERED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-muted text-muted-foreground',
  REFUNDED: 'bg-red-50 text-destructive',
};

function selectClassName() {
  return cn(
    'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}/${d.getFullYear()}`;
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  return `${formatDate(dateStr)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function AdminOrdersPage() {
  const t = useTranslations('admin.orders');
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
  const [orders, setOrders] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [updating, setUpdating] = useState(false);
  const updatingRef = useRef(false);
  const loadingDetailRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrders() {
      const res = await api.get('/admin/orders', {
        params: { status: statusFilter || undefined, page, limit: 20 },
      });
      if (!cancelled) {
        setOrders(res.data.orders);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      }
    }

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [page, statusFilter]);

  const fetchOrders = async () => {
    const res = await api.get('/admin/orders', {
      params: { status: statusFilter || undefined, page, limit: 20 },
    });
    setOrders(res.data.orders);
    setTotal(res.data.total);
    setTotalPages(res.data.totalPages);
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !newStatus || updatingRef.current) return;
    updatingRef.current = true;
    setUpdating(true);

    try {
      await api.put(`/admin/orders/${selectedOrder.id}/status`, {
        status: newStatus,
        trackingNumber: trackingNumber || undefined,
      });
      setSelectedOrder(null);
      setNewStatus('');
      setTrackingNumber('');
      fetchOrders();
    } finally {
      updatingRef.current = false;
      setUpdating(false);
    }
  };

  const openDetail = async (id: string) => {
    if (loadingDetailRef.current) return;
    loadingDetailRef.current = true;

    try {
      const res = await api.get(`/admin/orders/${id}`);
      setSelectedOrder(res.data);
      setNewStatus(res.data.status);
      setTrackingNumber(res.data.trackingNumber || '');
    } finally {
      loadingDetailRef.current = false;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">{`${t('title')} (${total})`}</h1>
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
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="font-mono">{selectedOrder.orderNumber}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                  className="text-muted-foreground"
                  aria-label={t('close')}
                >
                  {t('close')}
                </Button>
              </div>

              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">{t('email')}:</span> {selectedOrder.customerEmail}</p>
                <p><span className="text-muted-foreground">{t('date')}:</span> {formatDateTime(selectedOrder.createdAt)}</p>
                <p>
                  <span className="text-muted-foreground">{t('address')}:</span>{' '}
                  {selectedOrder.shippingStreet} {selectedOrder.shippingNumber}
                  {selectedOrder.shippingApartment ? `, ${t('apt')} ${selectedOrder.shippingApartment}` : ''},{' '}
                  {selectedOrder.shippingCity} {selectedOrder.shippingZip}
                </p>
                {selectedOrder.paymentRef && (
                  <p><span className="text-muted-foreground">{t('payment')}:</span> {selectedOrder.paymentRef}</p>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1 text-sm">
                {selectedOrder.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between">
                    <span>{item.productName} ({item.color}/{item.size}) x{item.quantity}</span>
                    <span>₪{(parseFloat(item.unitPrice) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 font-medium flex justify-between">
                  <span>{t('total')}</span>
                  <span>₪{parseFloat(selectedOrder.total).toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="order-status">{t('updateStatus')}</Label>
                  <select
                    id="order-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className={selectClassName()}
                  >
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {statusLabel(s)}
                      </option>
                    ))}
                  </select>
                </div>
                {(newStatus === 'SHIPPED' || selectedOrder.trackingNumber) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="order-tracking-number">{t('trackingNumber')}</Label>
                    <Input
                      id="order-tracking-number"
                      type="text"
                      value={trackingNumber}
                      onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="IL123456789"
                    />
                  </div>
                )}
                <Button
                  type="button"
                  onClick={handleStatusUpdate}
                  disabled={updating}
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
        <table className="w-full text-sm">
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
                  <td className="px-4 py-3 text-muted-foreground">{order.customerEmail}</td>
                  <td className="px-4 py-3 text-muted-foreground">{order.items.length}</td>
                  <td className="px-4 py-3 font-medium">₪{parseFloat(order.total).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider ${statusColors[order.status] || ''}`}>
                      {statusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openDetail(order.id)}
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
            <ChevronLeft size={14} />
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
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
