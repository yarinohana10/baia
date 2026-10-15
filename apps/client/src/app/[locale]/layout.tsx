import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata, Viewport } from 'next';
import { Assistant, Frank_Ruhl_Libre } from 'next/font/google';
import { SITE_NAME, getSiteUrl, ogLocale } from '@/lib/seo';
import '../globals.css';

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
  variable: '--font-assistant',
});

const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-frank',
});

export const viewport: Viewport = {
  themeColor: '#0F2A36',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'seo' });

  return {
    metadataBase: getSiteUrl(),
    title: {
      default: t('homeTitle'),
      template: `%s | ${SITE_NAME}`,
    },
    description: t('homeDescription'),
    applicationName: SITE_NAME,
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: ogLocale(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(ogLocale),
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
    icons: {
      icon: [
        { url: '/favicon.svg', type: 'image/svg+xml' },
      ],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${assistant.variable} ${frank.variable}`}>
      <body className="min-h-screen bg-shell font-sans text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
