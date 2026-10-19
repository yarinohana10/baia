import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Accessibility, Mail, Phone, User } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { LegalPage, fillSections, legalVars, type LegalSection } from '@/components/storefront/LegalPage';
import { getSiteConfig } from '@/lib/catalog/server';
import { telHref } from '@/lib/site';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.accessibility' });
  return pageMetadata({ locale, path: '/accessibility', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function AccessibilityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, config] = await Promise.all([getTranslations('legal.accessibility'), getSiteConfig()]);
  const { info, vars } = await legalVars(config);

  const coordinator = (
    <section aria-labelledby="a11y-coordinator" className="mb-4 rounded-xl border border-ocean-100 bg-ocean-50/60 p-6">
      <div className="flex items-center gap-2 text-ocean-700">
        <Accessibility size={22} strokeWidth={1.5} aria-hidden="true" />
        <h2 id="a11y-coordinator" className="!my-0 text-base font-semibold text-gray-900">
          {t('coordinatorTitle')}
        </h2>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        {info.accessibilityCoordinatorName && (
          <div className="flex items-center gap-3">
            <User size={16} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-700" />
            <dt className="sr-only">{t('coordinatorNameLabel')}</dt>
            <dd className="text-gray-900">{info.accessibilityCoordinatorName}</dd>
          </div>
        )}
        {info.accessibilityCoordinatorPhone && (
          <div className="flex items-center gap-3">
            <Phone size={16} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-700" />
            <dt className="sr-only">{t('coordinatorPhoneLabel')}</dt>
            <dd>
              <a href={telHref(info.accessibilityCoordinatorPhone)} dir="ltr" className="text-gray-900 underline underline-offset-4">
                {info.accessibilityCoordinatorPhone}
              </a>
            </dd>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Mail size={16} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-700" />
          <dt className="sr-only">{t('coordinatorEmailLabel')}</dt>
          <dd className="min-w-0">
            <a
              href={`mailto:${info.accessibilityCoordinatorEmail}`}
              dir="ltr"
              className="break-all text-gray-900 underline underline-offset-4"
            >
              {info.accessibilityCoordinatorEmail}
            </a>
          </dd>
        </div>
      </dl>
    </section>
  );

  return (
    <LegalPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={fillSections(t.raw('sections') as LegalSection[], vars)}
    >
      {coordinator}
    </LegalPage>
  );
}
