'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { CheckCircle2, Clock, Package, SearchX } from 'lucide-react';

type OrderItem = {
  id: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: string;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  customerEmail: string;
  subtotal: string;
  shippingCost: string;
  discountAmount: string;
  total: string;
  shippingCity: string;
  shippingStreet: string;
  shippingNumber: string;
  shippingApartment: string | null;
  shippingZip: string | null;
  items: OrderItem[];
};

// Held in memory only until the exchange succeeds (survives StrictMode's
// double effect run, which would otherwise see the already-stripped hash).
const tokenInFlight = new Map<string, string>();

/** Reads `#token=...` and removes it from the address bar (and history). */
function takeToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token) {
    tokenInFlight.set(orderId, token);
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  return tokenInFlight.get(orderId) ?? null;
}

/**
 * Access rules are enforced by the API (owner session, guest token, or admin;
 * 404 otherwise). Guests arrive with the token in the URL fragment, which is
 * exchanged once for an httpOnly cookie scoped to this order, so a refresh
 * keeps working without the token ever sitting in the URL or in JS storage.
 */
export default function OrderConfirmationPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('orderConfirmation');
  const { data: session } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const token = takeToken(id);
    const request = token
      ? api.post(`/orders/${encodeURIComponent(id)}/access`, { token }).finally(() => tokenInFlight.delete(id))
      : api.get(`/orders/${encodeURIComponent(id)}`);
    request
      .then((res) => !cancelled && setOrder(res.data))
      .catch(() => !cancelled && setNotFound(true));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <SearchX size={56} className="mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold tracking-normal mb-2">{t('notFoundTitle')}</h1>
        <p className="text-gray-500 mb-8">{t('notFoundBody')}</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('continueShopping')}
        </Link>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center animate-pulse" aria-busy="true">
        <span className="sr-only">{t('loading')}</span>
        <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto mb-4" />
        <div className="h-6 bg-gray-200 w-1/2 mx-auto mb-2" />
        <div className="h-4 bg-gray-200 w-1/3 mx-auto" />
      </div>
    );
  }

  const paid = order.status !== 'PENDING_PAYMENT';
  const money = (v: string | number) => `₪${Number(v).toFixed(2)}`;
  const statusLabel = t.has(`status.${order.status}`) ? t(`status.${order.status}`) : order.status;

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      {paid ? (
        <CheckCircle2 size={64} className="mx-auto text-green-500 mb-6" />
      ) : (
        <Clock size={64} className="mx-auto text-amber-500 mb-6" />
      )}
      <h1 className="text-3xl font-bold tracking-normal mb-2">{t('thankYou')}</h1>
      <p className="text-gray-500 mb-2">{paid ? t('placed') : t('pending')}</p>
      <p className="text-sm text-gray-400 mb-8">
        {t('sentTo', { email: order.customerEmail })}
      </p>

      <div className="bg-white border border-gray-200 rounded-xl p-6 text-start space-y-4 mb-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400">{t('orderNumber')}</p>
            <p className="font-mono font-medium" dir="ltr">{order.orderNumber}</p>
          </div>
          <span
            className={`text-xs px-3 py-1 uppercase tracking-wider rounded-full ${
              paid ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 text-sm">
              <span>
                {item.productName} ({item.color}/{item.size}) ×{item.quantity}
              </span>
              <span>{money(Number(item.unitPrice) * item.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">{t('subtotal')}</span>
            <span>{money(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">{t('shipping')}</span>
            <span>{Number(order.shippingCost) === 0 ? t('free') : money(order.shippingCost)}</span>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>{t('discount')}</span>
              <span>-{money(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-medium text-base pt-2 border-t border-gray-100">
            <span>{t('total')}</span>
            <span>{money(order.total)}</span>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 text-sm">
          <p className="text-xs text-gray-400 mb-1">{t('shippingTo')}</p>
          <p>
            {order.shippingStreet} {order.shippingNumber}
            {order.shippingApartment ? `, ${t('apt')} ${order.shippingApartment}` : ''}
          </p>
          <p>
            {order.shippingCity} {order.shippingZip}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/"
          className="px-6 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('continueShopping')}
        </Link>
        {session?.user && (
          <Link
            href="/account/orders"
            className="flex items-center gap-2 px-6 py-2.5 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors"
          >
            <Package size={14} /> {t('myOrders')}
          </Link>
        )}
      </div>
    </div>
  );
}
