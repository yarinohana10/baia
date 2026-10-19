import { getLocale, getTranslations } from 'next-intl/server';
import { Header, type NavItem } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { SessionSync } from './SessionSync';
import { WhatsAppButton } from './WhatsAppButton';
import { CookieConsent } from './CookieConsent';
import { getCategories, getSiteConfig } from '@/lib/catalog/server';

export async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [locale, categories, tNav, config] = await Promise.all([
    getLocale(),
    getCategories(),
    getTranslations('nav'),
    getSiteConfig(),
  ]);

  // Top-level categories drive both nav and footer, so links always match real slugs.
  const categoryNav: NavItem[] = categories.length
    ? categories.map((c) => ({ label: locale === 'he' ? c.nameHe : c.nameEn, href: `/category/${c.slug}` }))
    : [
        { label: tNav('women'), href: '/category/women' },
        { label: tNav('men'), href: '/category/men' },
        { label: tNav('children'), href: '/category/children' },
      ];
  const nav: NavItem[] = [...categoryNav, { label: tNav('newArrivals'), href: '/new-arrivals' }];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header nav={nav} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={categoryNav} config={config} />
      <CartDrawer />
      <SessionSync />
      <WhatsAppButton number={config?.whatsappNumber ?? null} />
      <CookieConsent />
    </div>
  );
}
