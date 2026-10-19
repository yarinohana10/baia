'use client';

import { use, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { isAxiosError } from 'axios';
import { ArrowRight, BadgeCheck, CircleAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { formatAdminDate } from '@/lib/admin/format';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import {
  ORDER_STATUS_COLORS,
  ORDER_STATUS_LABEL_KEYS,
  formatShekels,
} from '@/components/admin/order-status';
import { CUSTOMERS_LIST_QUERY_KEY } from '@/components/admin/customers-list';

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: keyof typeof ORDER_STATUS_LABEL_KEYS;
  total: number;
  itemCount: number;
  createdAt: string;
};

type CustomerDetail = {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
  orders: CustomerOrder[];
};

export default function AdminCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin.customers');
  const tOrders = useTranslations('admin.orders');
  const locale = useLocale();

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/admin/customers/${encodeURIComponent(id)}`)
      .then((res) => !cancelled && setCustomer(res.data))
      .catch((err) => {
        if (cancelled) return;
        setError(isAxiosError(err) && err.response?.status === 404 ? t('notFound') : t('detailFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  // Link back to the list with the search/page it was showing.
  const [backHref, setBackHref] = useState('/admin/customers');
  useEffect(() => {
    try {
      const qs = sessionStorage.getItem(CUSTOMERS_LIST_QUERY_KEY);
      if (qs) setBackHref(`/admin/customers?${qs}`);
    } catch {
      // Storage unavailable: keep the plain list link.
    }
  }, []);

  const th = 'text-start px-4 py-3 font-medium text-muted-foreground';

  return (
    <div>
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight size={14} className="ltr:rotate-180" />
        {t('back')}
      </Link>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!customer && !error && <p className="text-sm text-muted-foreground">…</p>}

      {customer && (
        <>
          <div className="mb-8">
            <h1 className="font-serif text-2xl font-bold tracking-normal text-foreground">
              {customer.name || t('noName')}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span dir="ltr">{customer.email}</span>
              {customer.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-green-600">
                  <BadgeCheck size={14} aria-hidden="true" />
                  {t('emailVerified')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <CircleAlert size={14} aria-hidden="true" />
                  {t('emailUnverified')}
                </span>
              )}
            </p>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              { label: t('registered'), value: formatAdminDate(customer.createdAt, locale, 'medium') },
              { label: t('paidOrders'), value: String(customer.orderCount) },
              { label: t('totalSpent'), value: formatShekels(customer.totalSpent) },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <h2 className="mb-4 text-lg font-semibold text-foreground">{t('ordersTitle')}</h2>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className={th}>{t('order')}</th>
                    <th className={th}>{t('date')}</th>
                    <th className={th}>{t('items')}</th>
                    <th className={th}>{t('total')}</th>
                    <th className={th}>{t('status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.orders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        {t('noOrders')}
                      </td>
                    </tr>
                  ) : (
                    customer.orders.map((order) => (
                      <tr key={order.id} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/orders?q=${encodeURIComponent(order.orderNumber)}`}
                            aria-label={t('openOrder', { number: order.orderNumber })}
                            className="font-mono text-xs text-ocean-700 hover:underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatAdminDate(order.createdAt, locale, 'medium')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{order.itemCount}</td>
                        <td className="px-4 py-3 font-medium">{formatShekels(order.total)}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full uppercase tracking-wider ${ORDER_STATUS_COLORS[order.status] || ''}`}
                          >
                            {ORDER_STATUS_LABEL_KEYS[order.status]
                              ? tOrders(ORDER_STATUS_LABEL_KEYS[order.status])
                              : order.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
