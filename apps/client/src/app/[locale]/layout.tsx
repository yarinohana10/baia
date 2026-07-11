import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'BAIA Swimwear — Premium Swimwear for the Whole Family',
    template: '%s | BAIA Swimwear',
  },
  description:
    'Shop premium swimwear for women, men, and children. Free shipping over ₪249. Discover the latest summer collection at BAIA.',
  keywords: [
    'swimwear',
    'bikini',
    'swimming',
    'beachwear',
    'BAIA',
    'בגדי ים',
    'ביקיני',
  ],
  openGraph: {
    type: 'website',
    siteName: 'BAIA Swimwear',
    locale: 'en_US',
    alternateLocale: 'he_IL',
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
};

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

  const messages = await getMessages();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#1B4965" />
      </head>
      <body className="min-h-screen bg-white text-charcoal font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
