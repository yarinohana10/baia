import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Truck } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { StaticPage, type StaticSection } from '@/components/storefront/StaticPage';
import { getSiteConfig } from '@/lib/catalog/server';
import { formatPrice } from '@/lib/catalog/pricing';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.shipping' });
  return pageMetadata({ locale, path: '/shipping', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function ShippingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, config] = await Promise.all([getTranslations('pages.shipping'), getSiteConfig()]);

  // Shipping rates come from the admin site settings so this page never drifts from checkout.
  const threshold = formatPrice(parseFloat(config?.freeShippingThreshold ?? '249'));
  const cost = formatPrice(parseFloat(config?.shippingCost ?? '29.9'));

  return (
    <StaticPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={t.raw('sections') as StaticSection[]}
      aside={
        <div className="border border-sand-200 bg-white p-6">
          <Truck size={26} strokeWidth={1.3} aria-hidden="true" className="text-ocean-700" />
          <h2 className="mt-4 font-display text-xl text-ink">{t('costTitle')}</h2>
          <ul className="mt-3 space-y-2 text-[15px] text-stone">
            <li>{t('costFree', { threshold })}</li>
            <li>{t('costFlat', { threshold, cost })}</li>
          </ul>
        </div>
      }
    />
  );
}
