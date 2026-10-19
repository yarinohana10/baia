'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { Link, useRouter } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/catalog/pricing';
import { orderPageHref, type CustomerOrder } from '@/lib/orders';
import { releaseOrderToken, takeOrderToken } from '@/lib/order-token';
import { errorCode, shopErrorMessage } from '@/lib/shop-errors';
import type { DeclineCode, PaymentConfig, PaymentMethod, PayRequest } from '@/lib/payment';
import { cn } from '@/lib/utils';
import { ApplePayForm, BitForm, CardForm } from '@/components/storefront/payment/PaymentForms';
import { AlertTriangle, CheckCircle2, CreditCard, FlaskConical, Lock, SearchX, Smartphone, Wallet } from 'lucide-react';

const PAYMENT_TABS: { key: PaymentMethod; icon: React.ReactNode }[] = [
  { key: 'card', icon: <CreditCard size={16} aria-hidden="true" /> },
  { key: 'bit', icon: <Smartphone size={16} aria-hidden="true" /> },
  { key: 'apple_pay', icon: <Wallet size={16} aria-hidden="true" /> },
];

const DECLINE_CODES: DeclineCode[] = ['card_declined', 'insufficient_funds', 'provider_error', 'declined'];
const PAID_STATUSES = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** Used when /payment/config is unreachable: no test UI, no installments. */
const FALLBACK_CONFIG: PaymentConfig = {
  provider: 'unknown',
  testMode: false,
  methods: ['card', 'bit', 'apple_pay'],
  installments: { max: 1, minTotal: 0 },
};

type PayError = { ns: 'payment' | 'checkout'; key: string; values?: Record<string, string | number>; kept?: boolean };

/**
 * Hosted-payment-page step (emulates an Israeli PSP page such as Grow,
 * PayPlus, Tranzila or CardCom). Card details never leave this page: the API
 * only receives the method, installments, brand and last 4 digits, plus the
 * test-card outcome while the mock provider is bound.
 *
 * Guests arrive with `#token=...`, exchanged for the order cookie (scoped to
 * /v1/orders/:id), so a refresh keeps access and paying goes through
 * POST /orders/:id/pay where that cookie is sent.
 */
export default function PaymentPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('payment');
  const tErrors = useTranslations('checkout.errors');
  const locale = useLocale();
  const router = useRouter();

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [paying, setPaying] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [payError, setPayError] = useState<PayError | null>(null);
  // Bumped after a decline so the card form starts clean for another card.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const token = takeOrderToken(id);
    if (token) setGuestToken(token);
    const request = token
      ? api.post(`/orders/${encodeURIComponent(id)}/access`, { token }).finally(() => releaseOrderToken(id))
      : api.get(`/orders/${encodeURIComponent(id)}`);
    request
      .then((res) => !cancelled && setOrder(res.data))
      .catch(() => !cancelled && setNotFound(true));
    api
      .get<PaymentConfig>('/payment/config')
      .then((res) => !cancelled && setConfig(res.data))
      .catch(() => !cancelled && setConfig(FALLBACK_CONFIG));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const alreadyPaid = !!order && PAID_STATUSES.includes(order.status);
  useEffect(() => {
    if (alreadyPaid && !succeeded) router.replace(orderPageHref(id, guestToken));
  }, [alreadyPaid, succeeded, id, guestToken, router]);

  const pay = async (body: PayRequest) => {
    if (paying) return;
    setPaying(true);
    setPayError(null);
    try {
      await api.post(
        `/orders/${encodeURIComponent(id)}/pay`,
        body,
        guestToken ? { headers: { 'X-Order-Token': guestToken } } : undefined,
      );
      setSucceeded(true);
      // The confirmation page exchanges the token again (or uses the cookie).
      router.replace(orderPageHref(id, guestToken));
    } catch (err) {
      setPaying(false);
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 402) {
        const code = (isAxiosError(err) ? err.response?.data?.declineCode : undefined) as DeclineCode | undefined;
        setPayError({ ns: 'payment', key: code && DECLINE_CODES.includes(code) ? code : 'declined', kept: true });
        setAttempt((n) => n + 1);
      } else if (errorCode(err) === 'ORDER_NOT_PAYABLE') {
        setPayError({ ns: 'checkout', key: 'orderNotPayable' });
        api
          .get(`/orders/${encodeURIComponent(id)}`)
          .then((res) => setOrder(res.data))
          .catch(() => undefined);
      } else if (status === 409) {
        setPayError({ ns: 'payment', key: 'inProgress' });
      } else {
        const message = shopErrorMessage(err, locale);
        setPayError({ ns: 'checkout', key: message.key, values: message.values });
      }
    }
  };

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <SearchX size={56} className="mx-auto text-gray-300 mb-6" aria-hidden="true" />
        <p className="text-gray-500 mb-8">{t('notPayable')}</p>
        <Link
          href="/order-status"
          className="inline-block px-6 py-2.5 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors"
        >
          {t('viewOrder')}
        </Link>
      </div>
    );
  }

  if (!order || !config) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 animate-pulse" aria-busy="true">
        <span className="sr-only">{t('loading')}</span>
        <div className="h-8 bg-gray-200 w-1/3 mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 h-96 bg-gray-100 rounded-xl" />
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const total = Number(order.total);
  const amount = formatPrice(total);
  const pending = order.status === 'PENDING_PAYMENT';
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemName = (item: CustomerOrder['items'][number]) => (locale === 'he' && item.productNameHe) || item.productName;
  const busy = paying || succeeded;

  if (!pending) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center" role="status">
        {alreadyPaid ? (
          <CheckCircle2 size={56} className="mx-auto text-green-500 mb-6" aria-hidden="true" />
        ) : (
          <AlertTriangle size={56} className="mx-auto text-gray-300 mb-6" aria-hidden="true" />
        )}
        <p className="text-gray-600 mb-8">{alreadyPaid ? t('alreadyPaid') : t('notPayable')}</p>
        {payError && <p className="text-sm text-red-600 mb-6">{tErrors(payError.key, payError.values)}</p>}
        <Link
          href={orderPageHref(id, guestToken)}
          className="inline-block px-6 py-2.5 text-sm bg-ocean-700 text-white rounded-lg hover:bg-ocean-800 transition-colors"
        >
          {t('viewOrder')}
        </Link>
      </div>
    );
  }

  const availableTabs = PAYMENT_TABS.filter((tab) => config.methods.includes(tab.key));

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      {config.testMode && (
        <div
          role="note"
          className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
        >
          <FlaskConical size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold text-sm">{t('testBanner')}</p>
            <p className="text-xs">{t('testBannerHint')}</p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-normal flex items-center gap-2">
          <Lock size={20} className="text-ocean-700" aria-hidden="true" /> {t('title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t('orderLabel')}{' '}
          <span className="font-mono" dir="ltr">
            {order.orderNumber}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <section className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5 sm:p-6" aria-labelledby="pay-methods">
          <h2 id="pay-methods" className="sr-only">
            {t('methodsLabel')}
          </h2>
          <div role="tablist" aria-label={t('methodsLabel')} className="grid grid-cols-3 gap-2 mb-6">
            {availableTabs.map((tab) => {
              const selected = method === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`pay-tab-${tab.key}`}
                  aria-selected={selected}
                  aria-controls={`pay-panel-${tab.key}`}
                  tabIndex={selected ? 0 : -1}
                  disabled={busy}
                  onClick={() => {
                    setMethod(tab.key);
                    setPayError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                    e.preventDefault();
                    const idx = availableTabs.findIndex((x) => x.key === method);
                    // Visual order follows the document direction (RTL in Hebrew).
                    const forward = (e.key === 'ArrowLeft') === (document.dir === 'rtl');
                    const next = availableTabs[(idx + (forward ? 1 : availableTabs.length - 1)) % availableTabs.length];
                    setMethod(next.key);
                    document.getElementById(`pay-tab-${next.key}`)?.focus();
                  }}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-sm transition-colors disabled:opacity-50',
                    selected
                      ? 'border-ocean-700 bg-ocean-50 text-ocean-800 font-medium'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  )}
                >
                  {tab.icon}
                  {t(`methods.${tab.key}`)}
                </button>
              );
            })}
          </div>

          {payError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p>{payError.ns === 'payment' ? t(`errors.${payError.key}`) : tErrors(payError.key, payError.values)}</p>
                {payError.kept && <p className="text-xs text-red-600/80 mt-1">{t('errors.keptOrder')}</p>}
              </div>
            </div>
          )}

          {succeeded && (
            <p role="status" className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 size={16} aria-hidden="true" /> {t('success')}
            </p>
          )}

          <div role="tabpanel" id={`pay-panel-${method}`} aria-labelledby={`pay-tab-${method}`}>
            {method === 'card' && (
              <CardForm
                key={attempt}
                total={total}
                amount={amount}
                config={config}
                busy={busy}
                onPay={pay}
              />
            )}
            {method === 'bit' && (
              <BitForm amount={amount} testMode={config.testMode} initialPhone={order.phone ?? ''} busy={busy} onPay={pay} />
            )}
            {method === 'apple_pay' && <ApplePayForm testMode={config.testMode} busy={busy} onPay={pay} />}
          </div>

          <p className="mt-6 text-xs text-gray-400 flex items-center gap-1.5">
            <Lock size={12} aria-hidden="true" /> {t('secureNote')}
          </p>
        </section>

        <aside className="lg:col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-5 sm:p-6" aria-labelledby="pay-summary">
          <h2 id="pay-summary" className="font-medium mb-1">
            {t('orderSummary')}
          </h2>
          <p className="text-xs text-gray-500 mb-4">{t('items', { count: itemCount })}</p>
          <ul className="space-y-2 text-sm mb-4">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-4">
                <span className="text-gray-700">
                  {itemName(item)} ({item.color}/{item.size}) ×{item.quantity}
                </span>
                <span>{formatPrice(Number(item.unitPrice) * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-gray-200 pt-4 flex items-baseline justify-between">
            <span className="text-sm text-gray-500">{t('amountDue')}</span>
            <span className="text-2xl font-semibold">{amount}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
