'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { formatPrice } from '@/lib/catalog/pricing';
import { errorCode, shopErrorMessage, type ErrorMessage } from '@/lib/shop-errors';
import { AlertTriangle, CheckCircle2, Clock, CreditCard, Package, SearchX, XCircle } from 'lucide-react';

type OrderItem = {
  id: string;
  productName: string;
  productNameHe?: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: string;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  userId: string | null;
  customerEmail: string;
  recipientName: string | null;
  phone: string | null;
  trackingNumber: string | null;
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
  const tOrders = useTranslations('orders');
  const tErrors = useTranslations('checkout.errors');
  const locale = useLocale();
  const { data: session } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  // The guest token from the fragment, kept in memory for this page view only:
  // the exchanged cookie is scoped to /orders/:id, so paying needs the header.
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<ErrorMessage | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = takeToken(id);
    if (token) setGuestToken(token);
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

  const reload = useCallback(async () => {
    try {
      const res = await api.get(`/orders/${encodeURIComponent(id)}`);
      setOrder(res.data);
    } catch {
      // Keep showing what we have; the error banner explains what happened.
    }
  }, [id]);

  // Same endpoint the checkout uses; the server computes the amount from the order.
  const completePayment = async () => {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      // Under /orders/:id so the guest's order cookie is sent after a refresh.
      await api.post(
        `/orders/${encodeURIComponent(id)}/pay`,
        {},
        guestToken ? { headers: { 'X-Order-Token': guestToken } } : undefined,
      );
      await reload();
    } catch (err) {
      setPayError(shopErrorMessage(err, locale));
      // e.g. ORDER_NOT_PAYABLE: the order was cancelled meanwhile — show its real status.
      if (errorCode(err)) await reload();
    } finally {
      setPaying(false);
    }
  };

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

  const pending = order.status === 'PENDING_PAYMENT';
  // Cancelled / refunded orders (e.g. unpaid for 60 minutes) are neither "placed" nor payable.
  const closed = order.status === 'CANCELLED' || order.status === 'REFUNDED';
  const paid = !pending && !closed;
  const money = (v: string | number) => formatPrice(Number(v));
  const statusLabel = t.has(`status.${order.status}`) ? t(`status.${order.status}`) : order.status;
  const itemName = (item: OrderItem) => (locale === 'he' && item.productNameHe) || item.productName;
  const isOwner = !!session?.user && order.userId === session.user.id;
  // A guest order only loads with its token or cookie, which also authorise paying.
  const canPay = pending && (isOwner || !!guestToken || !order.userId);

  return (
    <div className="max-w-2xl mx-auto py-16 px-4 text-center">
      {paid ? (
        <CheckCircle2 size={64} className="mx-auto text-green-500 mb-6" />
      ) : closed ? (
        <XCircle size={64} className="mx-auto text-gray-400 mb-6" />
      ) : (
        <Clock size={64} className="mx-auto text-amber-500 mb-6" />
      )}
      <h1 className="text-3xl font-bold tracking-normal mb-2">{t('thankYou')}</h1>
      <p className="text-gray-500 mb-2">{paid ? t('placed') : closed ? statusLabel : t('pending')}</p>
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
              paid ? 'bg-green-50 text-green-600' : closed ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'
            }`}
          >
            {statusLabel}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 text-sm">
              <span>
                {itemName(item)} ({item.color}/{item.size}) ×{item.quantity}
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
          {order.recipientName && <p className="font-medium">{order.recipientName}</p>}
          <p>
            {order.shippingStreet} {order.shippingNumber}
            {order.shippingApartment ? `, ${t('apt')} ${order.shippingApartment}` : ''}
          </p>
          <p>
            {order.shippingCity} {order.shippingZip}
          </p>
          {order.phone && (
            <p className="mt-1">
              <span className="text-gray-400">{tOrders('phone')}: </span>
              <span dir="ltr">{order.phone}</span>
            </p>
          )}
        </div>

        {order.trackingNumber && (
          <div className="border-t border-gray-100 pt-4 text-sm">
            <p className="text-xs text-gray-400 mb-1">{tOrders('tracking')}</p>
            <p className="font-mono" dir="ltr">{order.trackingNumber}</p>
          </div>
        )}
      </div>

      {payError && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6 flex items-center gap-2 rounded-lg text-start"
        >
          <AlertTriangle size={14} className="shrink-0" /> {tErrors(payError.key, payError.values)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-4">
        {canPay && (
          <button
            type="button"
            onClick={completePayment}
            disabled={paying}
            aria-busy={paying}
            className="flex items-center gap-2 px-6 py-2.5 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CreditCard size={14} /> {paying ? tOrders('paying') : tOrders('completePayment')}
          </button>
        )}
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
