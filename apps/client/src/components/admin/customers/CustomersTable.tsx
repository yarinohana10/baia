'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatShekels } from '@/components/admin/order-status';
import { formatAdminDate } from '@/lib/admin/format';

export type CustomerRow = {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};

const TH = 'text-start px-4 py-3 font-medium text-muted-foreground';

const detailHref = (id: string) => `/admin/customers/${id}`;

/** Customers list table; while loading with no rows it shows an ellipsis instead of `emptyText`. */
export function CustomersTable({
  customers,
  loading,
  emptyText,
}: {
  customers: CustomerRow[];
  loading: boolean;
  emptyText: string;
}) {
  const t = useTranslations('admin.customers');
  const locale = useLocale();

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm" aria-busy={loading}>
          <thead>
            <tr className="bg-muted border-b border-border">
              <th className={TH}>{t('name')}</th>
              <th className={TH}>{t('email')}</th>
              <th className={TH}>{t('registered')}</th>
              <th className={TH}>{t('orders')}</th>
              <th className={TH}>{t('totalSpent')}</th>
              <th className="text-end px-4 py-3 font-medium text-muted-foreground">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? '…' : emptyText}
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link href={detailHref(c.id)} className="font-medium text-foreground hover:text-ocean-600">
                      {c.name || <span className="text-muted-foreground">{t('noName')}</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span dir="ltr">{c.email}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatAdminDate(c.createdAt, locale, 'medium')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.orderCount}</td>
                  <td className="px-4 py-3 font-medium">{formatShekels(c.totalSpent)}</td>
                  <td className="px-4 py-3 text-end">
                    <Link
                      href={detailHref(c.id)}
                      aria-label={t('view')}
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'icon-sm',
                        className: 'text-muted-foreground hover:text-ocean-600',
                      })}
                    >
                      <Eye size={14} />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
