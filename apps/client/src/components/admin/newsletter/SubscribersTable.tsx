'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { formatAdminDate } from '@/lib/admin/format';

export type Subscriber = {
  id: string;
  email: string;
  locale: string;
  source: string;
  consentAt: string;
  unsubscribedAt: string | null;
  createdAt: string;
};

const SOURCES = ['footer', 'checkout', 'register', 'account'] as const;
type Source = (typeof SOURCES)[number];
const KNOWN_SOURCES = new Set<string>(SOURCES);
const isKnownSource = (s: string): s is Source => KNOWN_SOURCES.has(s);

const TH = 'text-start px-4 py-3 font-medium text-muted-foreground';

/** Newsletter subscribers table; while loading with no rows it shows an ellipsis instead of `emptyText`. */
export function SubscribersTable({
  rows,
  loading,
  emptyText,
}: {
  rows: Subscriber[];
  loading: boolean;
  emptyText: string;
}) {
  const t = useTranslations('admin.newsletter');
  const locale = useLocale();

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" aria-busy={loading}>
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className={TH}>{t('email')}</th>
              <th className={TH}>{t('status')}</th>
              <th className={TH}>{t('source')}</th>
              <th className={TH}>{t('locale')}</th>
              <th className={TH}>{t('consentAt')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {loading ? '…' : emptyText}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <span dir="ltr">{r.email}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        r.unsubscribedAt ? 'bg-muted text-muted-foreground' : 'bg-green-50 text-green-700'
                      }`}
                    >
                      {r.unsubscribedAt ? t('unsubscribed') : t('active')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{isKnownSource(r.source) ? t(`sources.${r.source}`) : r.source}</td>
                  <td className="px-4 py-3 text-muted-foreground uppercase">{r.locale}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatAdminDate(r.consentAt, locale, 'medium')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
