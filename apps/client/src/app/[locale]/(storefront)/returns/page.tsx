import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { StaticPage, type StaticSection } from '@/components/storefront/StaticPage';
import { pageMetadata } from '@/lib/seo';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'pages.returns' });
  return pageMetadata({ locale, path: '/returns', title: t('metaTitle'), description: t('metaDescription') });
}

export default async function ReturnsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages.returns');

  return (
    <StaticPage
      locale={locale}
      eyebrow={t('eyebrow')}
      title={t('title')}
      intro={t('intro')}
      sections={t.raw('sections') as StaticSection[]}
    />
  );
}
