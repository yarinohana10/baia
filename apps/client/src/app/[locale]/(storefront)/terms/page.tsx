import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { LegalPage, fillSections, legalVars, type LegalSection } from '@/components/storefront/LegalPage';
import { getSiteConfig } from '@/lib/catalog/server';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 300;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return pageMetadata({ locale, path: '/terms', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, config] = await Promise.all([getTranslations('legal.terms'), getSiteConfig()]);
  const { vars } = await legalVars(config);

  return (
    <LegalPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={fillSections(t.raw('sections') as LegalSection[], vars)}
    />
  );
}
