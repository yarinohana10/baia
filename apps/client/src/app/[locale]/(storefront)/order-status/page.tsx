import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PackageSearch, Undo2 } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';
import { OrderHelpLayout } from '@/components/storefront/orders/OrderHelpLayout';
import { OrderLookupForm } from '@/components/storefront/orders/OrderLookupForm';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'orderStatusPage' });
  return pageMetadata({ locale, path: '/order-status', title: t('metaTitle'), description: t('metaDescription'), noIndex: true });
}

export default async function OrderStatusPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('orderStatusPage');

  return (
    <OrderHelpLayout
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      aside={
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 text-sm">
          <div className="flex gap-3">
            <PackageSearch size={20} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
            <div>
              <p className="font-semibold text-gray-900">{t('whereTitle')}</p>
              <p className="mt-1 text-gray-500">{t('whereBody')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Undo2 size={20} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
            <div>
              <p className="font-semibold text-gray-900">{t('cancelTitle')}</p>
              <p className="mt-1 text-gray-500">{t('cancelBody')}</p>
              <Link href="/cancel-order" className="mt-2 inline-block text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
                {t('cancelLink')}
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <OrderLookupForm />
    </OrderHelpLayout>
  );
}
