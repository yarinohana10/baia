'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { ShoppingBag, User, Menu, X, LogOut, LayoutDashboard, Search, Globe, ChevronRight } from 'lucide-react';
import { useCartStore } from '@/store/cart';
import { Wordmark } from './Wordmark';
import { SearchForm } from './SearchForm';

export type NavItem = { label: string; href: string };

async function handleSignOut() {
  await signOut();
  window.location.href = '/';
}

type LocaleSwitcherProps = {
  /** Current pathname (without locale), read once by the Header. */
  pathname: string;
  className?: string;
  onAfterSwitch?: () => void;
  /** icon: globe only (header, tooltip names the language); label: globe + language name (mobile menu). */
  variant?: 'icon' | 'label';
};

function LocaleSwitcher({ pathname, className, onAfterSwitch, variant = 'icon' }: LocaleSwitcherProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations('common');
  const target = locale === 'he' ? 'en' : 'he';

  return (
    <button
      type="button"
      onClick={() => {
        router.replace(pathname, { locale: target });
        onAfterSwitch?.();
      }}
      className={className}
      aria-label={t('switchLang')}
      data-tip={variant === 'icon' ? t('switchLang') : undefined}
    >
      <Globe size={variant === 'icon' ? 20 : 16} strokeWidth={1.5} aria-hidden="true" />
      {variant === 'label' && (
        <span lang={target} className="ms-2">
          {target === 'en' ? 'English' : 'עברית'}
        </span>
      )}
    </button>
  );
}

const iconButton =
  'tip relative inline-flex size-10 items-center justify-center rounded-full text-black transition-colors hover:bg-black/5';

export function Header({ nav, logoUrl }: { nav: NavItem[]; logoUrl?: string }) {
  const t = useTranslations('common');
  const ts = useTranslations('storefront');
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const cartCount = useCartStore((s) => s.itemCount());
  const openDrawer = useCartStore((s) => s.openDrawer);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';

  // Close the menu and search panel on navigation and on Escape.
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, searchOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-2 focus:z-[60] focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        {ts('skipToContent')}
      </a>

      <p className="bg-black px-4 py-2 text-center text-[12px] font-semibold tracking-wide text-logo-blue">
        {ts('announcement')}
      </p>

      {/* z-10: the blur makes this bar its own stacking layer, so lift it above the search
          panel and mobile menu or they would cover the icon tooltips that hang below it. */}
      <div className="relative z-10 border-b border-header-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="container-header grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-20">
          {/* Start: menu button (categories live in the menu at every screen size) */}
          <div className="flex items-center">
            <button
              type="button"
              className={`${iconButton} -ms-2`}
              onClick={() => {
                setMenuOpen((o) => !o);
                setSearchOpen(false);
              }}
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              aria-label={menuOpen ? ts('closeMenu') : ts('menu')}
              data-tip={menuOpen ? ts('closeMenu') : ts('menu')}
            >
              {menuOpen ? <X size={22} strokeWidth={1.6} /> : <Menu size={22} strokeWidth={1.6} />}
            </button>
          </div>

          {/* Center: wordmark */}
          <Link href="/" className="justify-self-center">
            <Wordmark src={logoUrl} priority className="h-14 lg:h-16" />
          </Link>

          {/* End: actions */}
          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <button
              type="button"
              onClick={() => {
                setSearchOpen((o) => !o);
                setMenuOpen(false);
              }}
              className={iconButton}
              aria-expanded={searchOpen}
              aria-controls="header-search"
              aria-label={searchOpen ? ts('search.close') : ts('search.open')}
              data-tip={searchOpen ? ts('search.close') : ts('search.open')}
            >
              {searchOpen ? <X size={20} strokeWidth={1.6} /> : <Search size={20} strokeWidth={1.6} />}
            </button>

            <LocaleSwitcher pathname={pathname} className={`${iconButton} max-sm:hidden`} />

            {session?.user ? (
              <>
                <Link href="/account" className={iconButton} aria-label={t('myAccount')} data-tip={t('myAccount')}>
                  <User size={20} strokeWidth={1.6} />
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className={`${iconButton} max-sm:hidden`}
                  aria-label={t('signOut')} data-tip={t('signOut')}
                >
                  <LogOut size={18} strokeWidth={1.6} />
                </button>
              </>
            ) : (
              <Link href="/login" className={iconButton} aria-label={t('signIn')} data-tip={t('signIn')}>
                <User size={20} strokeWidth={1.6} />
              </Link>
            )}

            {isAdmin && (
              <Link href="/admin" className={`${iconButton} max-sm:hidden`} aria-label={t('adminPanel')} data-tip={t('adminPanel')}>
                <LayoutDashboard size={19} strokeWidth={1.6} />
              </Link>
            )}

            <button type="button" onClick={openDrawer} className={`${iconButton} -me-2`} aria-label={t('cartTooltip')} data-tip={t('cartTooltip')}>
              <ShoppingBag size={20} strokeWidth={1.6} />
              {cartCount > 0 && (
                <span className="absolute end-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-black px-1 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search panel */}
      {searchOpen && (
        <div
          id="header-search"
          className="absolute inset-x-0 top-full border-b border-header-line bg-white shadow-[0_24px_40px_-28px_rgba(0,0,0,0.18)]"
        >
          <div className="container-header py-5 lg:py-7">
            <SearchForm autoFocus onSubmitted={() => setSearchOpen(false)} className="mx-auto max-w-2xl" />
          </div>
        </div>
      )}

      {/* Click-outside layer: closes the menu when tapping the page behind it. */}
      {menuOpen && (
        <div aria-hidden="true" className="fixed inset-0 -z-10 bg-black/25" onClick={() => setMenuOpen(false)} />
      )}

      {/* Site menu */}
      <div
        id="site-menu"
        hidden={!menuOpen}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-7rem)] overflow-y-auto border-b border-header-line bg-white shadow-[0_24px_48px_-24px_rgba(15,42,54,0.25)] sm:inset-x-auto sm:start-0 sm:h-[calc(100dvh-6.25rem)] lg:h-[calc(100dvh-7.25rem)] sm:max-h-none sm:w-96 sm:border-b-0 sm:border-e sm:shadow-[0_0_48px_-12px_rgba(15,42,54,0.25)]"
      >
        <nav aria-label={ts('primaryNav')} className="px-4 py-5 sm:px-6 sm:py-7">
          <ul className="flex flex-col gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                {/* Hover/active: shell background, ocean text, a sand bar on the start edge and a
                    sliding arrow, so every row clearly reads as a link. */}
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className="group relative flex min-h-14 items-center justify-between gap-4 border-s-2 border-transparent px-4 text-[16px] font-medium uppercase ltr:tracking-[0.12em] text-ink transition-colors duration-200 hover:border-sand-400 hover:bg-sand-100/60 hover:text-ocean-700 focus-visible:border-sand-400 focus-visible:bg-sand-100/60 focus-visible:text-ocean-700 focus-visible:outline-none aria-[current=page]:border-ocean-700 aria-[current=page]:bg-ocean-50 aria-[current=page]:font-semibold aria-[current=page]:text-ocean-700"
                >
                  {item.label}
                  <ChevronRight
                    size={18}
                    strokeWidth={1.6}
                    aria-hidden="true"
                    className="shrink-0 text-ink/30 transition-[transform,color] duration-200 rtl:rotate-180 group-hover:text-sand-600 group-hover:ltr:translate-x-1 group-hover:rtl:-translate-x-1 group-focus-visible:text-sand-600 group-aria-[current=page]:text-ocean-700"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-header-line pt-4 text-sm font-semibold sm:hidden">
            <LocaleSwitcher
              pathname={pathname}
              onAfterSwitch={() => setMenuOpen(false)}
              variant="label"
              className="inline-flex items-center rounded-none border border-black/20 px-4 py-2 text-ink transition-colors hover:border-ocean-700 hover:bg-shell hover:text-ocean-700"
            />
            {isAdmin && (
              <Link href="/admin" className="inline-flex items-center gap-2 rounded-none border border-black/20 px-4 py-2 text-ink transition-colors hover:border-ocean-700 hover:bg-shell hover:text-ocean-700">
                <LayoutDashboard size={16} strokeWidth={1.6} />
                {t('adminPanel')}
              </Link>
            )}
            {session?.user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-none border border-black/20 px-4 py-2 text-ink transition-colors hover:border-ocean-700 hover:bg-shell hover:text-ocean-700"
              >
                <LogOut size={16} strokeWidth={1.6} />
                {t('signOut')}
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
