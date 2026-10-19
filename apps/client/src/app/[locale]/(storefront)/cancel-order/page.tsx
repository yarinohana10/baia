import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Clock, PackageX, Scale } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { Link } from '@/i18n/navigation';
import { pageMetadata } from '@/lib/seo';
import { getSiteConfig } from '@/lib/catalog/server';
import { OrderHelpLayout } from '@/components/storefront/orders/OrderHelpLayout';
import { CancelOrderForm } from '@/components/storefront/orders/CancelOrderForm';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cancelOrderPage' });
  return pageMetadata({ locale, path: '/cancel-order', title: t('metaTitle'), description: t('metaDescription') });
}

/** Legally required cancellation entry point (linked from the footer). */
export default async function CancelOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, config] = await Promise.all([getTranslations('cancelOrderPage'), getSiteConfig()]);
  const hours = config?.selfCancelWindowHours ?? 48;

  return (
    <OrderHelpLayout
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro', { hours })}
      aside={
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 text-sm">
          <div className="flex gap-3">
            <Clock size={20} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
            <div>
              <p className="font-semibold text-gray-900">{t('policyFreeTitle', { hours })}</p>
              <p className="mt-1 text-gray-500">{t('policyFreeBody', { hours })}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <PackageX size={20} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
            <div>
              <p className="font-semibold text-gray-900">{t('policyShippedTitle')}</p>
              <p className="mt-1 text-gray-500">{t('policyShippedBody')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Scale size={20} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-ocean-700" />
            <div>
              <p className="font-semibold text-gray-900">{t('policyLawTitle')}</p>
              <p className="mt-1 text-gray-500">{t('policyLawBody')}</p>
              <Link href="/returns" className="mt-2 inline-block text-ocean-700 underline underline-offset-2 hover:text-ocean-800">
                {t('returnsLink')}
              </Link>
            </div>
          </div>
        </div>
      }
    >
      <CancelOrderForm />
    </OrderHelpLayout>
  );
}
