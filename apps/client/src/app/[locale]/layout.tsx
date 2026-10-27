import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Metadata, Viewport } from 'next';
import { Assistant, Frank_Ruhl_Libre, Heebo, Inter, Lato, Libre_Caslon_Text, DM_Sans } from 'next/font/google';
import { DEFAULT_SHARE_IMAGE, SITE_NAME, getSiteUrl, ogLocale } from '@/lib/seo';
import '../globals.css';

// Storefront type: Inter for Latin text, Heebo (same clean grotesque feel) for
// Hebrew, which Inter does not cover. The browser picks Heebo per glyph.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-heebo',
});

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

// Assistant + Frank Ruhl Libre are used by the header only.
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
  themeColor: '#7BB4D4',
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
      alternateLocale: routing.locales.flatMap((l) => (l === locale ? [] : [ogLocale(l)])),
      images: [DEFAULT_SHARE_IMAGE],
    },
    twitter: { card: 'summary_large_image', images: [DEFAULT_SHARE_IMAGE.url] },
    robots: { index: true, follow: true },
    // Favicons come from the app/ file conventions (favicon.ico, icon.png, apple-icon.png).
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
    <html lang={locale} dir={dir} className={`${inter.variable} ${heebo.variable} ${lato.variable} ${libreCaslon.variable} ${dmSans.variable} ${assistant.variable} ${frank.variable}`}>
      <body className="min-h-screen bg-white font-sans text-charcoal antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
