'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/catalog/pricing';
import { Package, ChevronRight, AlertTriangle } from 'lucide-react';

const statusColors: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-50 text-yellow-600',
  CONFIRMED: 'bg-blue-50 text-blue-600',
  PROCESSING: 'bg-indigo-50 text-indigo-600',
  SHIPPED: 'bg-purple-50 text-purple-600',
  DELIVERED: 'bg-green-50 text-green-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
  REFUNDED: 'bg-red-50 text-red-500',
};

type OrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: { id: string; quantity: number; productName: string; productNameHe?: string | null }[];
};

type OrdersPage = { orders: OrderSummary[]; total: number; page: number; totalPages: number };

const PAGE_SIZE = 20;

export default function MyOrdersPage() {
  const t = useTranslations('orders');
  const tStatus = useTranslations('orderConfirmation.status');
  const locale = useLocale();
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const loadPage = useCallback(async (next: number) => {
    setError(false);
    const res = await api.get<OrdersPage>('/orders/my', { params: { page: next, limit: PAGE_SIZE } });
    setOrders((prev) => (next === 1 ? res.data.orders : [...prev, ...res.data.orders]));
    setPage(res.data.page);
    setTotalPages(res.data.totalPages);
  }, []);

  const loadFirst = useCallback(() => {
    setLoading(true);
    loadPage(1)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [loadPage]);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    loadPage(page + 1)
      .catch(() => setError(true))
      .finally(() => setLoadingMore(false));
  };

  const dateFormat = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-IL', { dateStyle: 'medium' });

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 animate-pulse">
        <div className="h-8 bg-gray-200 w-1/4 mb-8" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl mb-3" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
      <h1 className="text-2xl font-bold tracking-normal mb-8">{t('title')}</h1>

      {error && orders.length === 0 ? (
        <div className="text-center py-20">
          <AlertTriangle size={48} className="mx-auto text-gray-300 mb-4" />
          <p role="alert" className="text-gray-400 mb-6">{t('loadError')}</p>
          <button
            type="button"
            onClick={loadFirst}
            className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider rounded-lg hover:bg-ocean-800 transition-colors"
          >
            {t('retry')}
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-400 mb-6">{t('empty')}</p>
          <Link
            href="/"
            className="inline-block bg-ocean-700 text-white px-8 py-3 text-sm tracking-wider rounded-lg hover:bg-ocean-800 transition-colors"
          >
            {t('startShopping')}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map((order) => {
              const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const names = order.items
                .map((item) => (locale === 'he' && item.productNameHe) || item.productName)
                .join(', ');
              return (
                <Link
                  key={order.id}
                  href={`/order-confirmation/${order.id}`}
                  aria-label={t('viewOrder', { number: order.orderNumber })}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-ocean-300 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-medium" dir="ltr">{order.orderNumber}</p>
                      <p className="text-xs text-gray-400">
                        {dateFormat.format(new Date(order.createdAt))} &middot; {t('itemCount', { count })}
                      </p>
                      {names && <p className="text-xs text-gray-500 line-clamp-1">{names}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{formatPrice(parseFloat(order.total))}</span>
                    <span
                      className={`text-xs px-2 py-0.5 uppercase tracking-wider rounded-full ${
                        statusColors[order.status] || 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {tStatus.has(order.status) ? tStatus(order.status) : order.status}
                    </span>
                    <ChevronRight size={14} className="text-gray-400 rtl:rotate-180" />
                  </div>
                </Link>
              );
            })}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500 text-center mt-6">{t('loadError')}</p>
          )}

          {page < totalPages && (
            <div className="text-center mt-8">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                className="px-6 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                {loadingMore ? t('loadingMore') : t('loadMore')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
