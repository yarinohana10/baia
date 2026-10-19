import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { StaticPage } from '@/components/storefront/StaticPage';
import { UnsubscribeForm } from '@/components/storefront/UnsubscribeForm';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.unsubscribe' });
  return pageMetadata({ locale, path: '/unsubscribe', title: t('metaTitle'), description: t('intro'), noIndex: true });
}

/** Landing page for the unsubscribe link in marketing emails: /unsubscribe?email=... */
export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const t = await getTranslations('legal.unsubscribe');
  const raw = Array.isArray(query.email) ? query.email[0] : query.email;
  const email = typeof raw === 'string' ? raw.trim().slice(0, 254) : '';

  return (
    <StaticPage locale={locale} eyebrow={t('eyebrow')} title={t('title')} intro={t('intro')} placeholderNotice={false}>
      <UnsubscribeForm initialEmail={email} />
    </StaticPage>
  );
}
