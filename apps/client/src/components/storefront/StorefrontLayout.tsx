import { getLocale, getTranslations } from 'next-intl/server';
import { Header, type NavItem } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from './CartDrawer';
import { SessionSync } from './SessionSync';
import { WhatsAppButton } from './WhatsAppButton';
import { CookieConsent } from './CookieConsent';
import { AccessibilityMenu } from './AccessibilityMenu';
import { getCategories, getSiteConfig } from '@/lib/catalog/server';
import { getLogoUrl } from '@/lib/brand';
import { businessInfo } from '@/lib/site';

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
  const nav: NavItem[] = [
    ...categoryNav,
    { label: tNav('newArrivals'), href: '/new-arrivals' },
    { label: tNav('featured'), href: '/featured' },
  ];

  // --radius 0: shared UI pieces (inputs, cards, selects) render square in the store, as in
  // the rest of the design; the admin keeps its own rounded look.
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-white [--radius:0px]">
      <Header nav={nav} logoUrl={getLogoUrl()} freeShippingThreshold={businessInfo(config).freeShippingThreshold} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer categories={categoryNav} config={config} />
      <CartDrawer />
      <SessionSync />
      <WhatsAppButton number={config?.whatsappNumber ?? null} />
      <AccessibilityMenu />
      <CookieConsent />
    </div>
  );
}
