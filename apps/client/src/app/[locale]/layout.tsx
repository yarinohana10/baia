import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata } from 'next';
import { Lato, Libre_Caslon_Text, DM_Sans } from 'next/font/google';
import '../globals.css';

const lato = Lato({
  subsets: ['latin', 'latin-ext'],
  weight: ['100', '300', '400', '700', '900'],
  display: 'swap',
  variable: '--font-lato',
});

const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-libre-caslon',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-dm-sans',
});

function getMetadataBase(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
}

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
  metadataBase: getMetadataBase(),
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
    <html lang={locale} dir={dir} className={`${lato.variable} ${libreCaslon.variable} ${dmSans.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/favicon-16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#7BB4D4" />
      </head>
      <body className={`min-h-screen bg-white text-charcoal antialiased ${lato.className}`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
