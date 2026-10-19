import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MapPin, Truck } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { StaticPage, type StaticSection } from '@/components/storefront/StaticPage';
import { getSiteConfig } from '@/lib/catalog/server';
import { businessInfo, fillTemplate } from '@/lib/site';
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

  // Rates and ETAs come from the admin site settings so this page never drifts from checkout.
  const info = businessInfo(config);
  const vars = {
    courierCost: info.courierCost,
    pickupCost: info.pickupCost,
    courierEta: info.courierEtaDays,
    pickupEta: info.pickupEtaDays,
    threshold: info.freeShippingThreshold,
    cancelHours: info.selfCancelWindowHours,
  };
  const sections = (t.raw('sections') as StaticSection[]).map((s) => ({
    title: fillTemplate(s.title, vars),
    body: fillTemplate(s.body, vars),
  }));

  const methods = [
    { icon: Truck, title: t('courierTitle'), cost: info.courierCost, eta: info.courierEtaDays },
    { icon: MapPin, title: t('pickupTitle'), cost: info.pickupCost, eta: info.pickupEtaDays },
  ];

  return (
    <StaticPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      aside={
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">{t('costTitle')}</h2>
          <ul className="mt-4 space-y-4">
            {methods.map(({ icon: Icon, title, cost, eta }) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ocean-50 text-ocean-700">
                  <Icon size={18} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <span>
                  <span className="block font-semibold text-gray-900">{title}</span>
                  <span className="block text-sm text-gray-500">{t('costLine', { cost, eta })}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg bg-warm-100 px-4 py-3 text-sm font-medium text-gray-900">
            {t('costFree', { threshold: info.freeShippingThreshold })}
          </p>
          <p className="mt-3 text-xs text-gray-500">{t('vatNote')}</p>
        </div>
      }
    />
  );
}
