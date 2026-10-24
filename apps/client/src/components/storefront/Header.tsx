'use client';

import { useEffect, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { ShoppingBag, User, Menu, X, LogOut, LayoutDashboard, Search, Globe } from 'lucide-react';
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

export function Header({ nav }: { nav: NavItem[] }) {
  const t = useTranslations('common');
  const ts = useTranslations('storefront');
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const cartCount = useCartStore((s) => s.itemCount());
  const openDrawer = useCartStore((s) => s.openDrawer);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN';

  // Close the mobile menu and search panel on navigation and on Escape.
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

      <p className="bg-black px-4 py-2 text-center text-[12px] font-semibold tracking-wide text-white/90">
        {ts('announcement')}
      </p>

      {/* z-10: the blur makes this bar its own stacking layer, so lift it above the search
          panel and mobile menu or they would cover the icon tooltips that hang below it. */}
      <div className="relative z-10 border-b border-header-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="container-header grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-4 lg:h-20">
          {/* Start: menu (mobile) / nav (desktop) */}
          <div className="flex items-center">
            <button
              type="button"
              className={`${iconButton} -ms-2 lg:hidden`}
              onClick={() => {
                setMenuOpen((o) => !o);
                setSearchOpen(false);
              }}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? ts('closeMenu') : ts('menu')}
              data-tip={menuOpen ? ts('closeMenu') : ts('menu')}
            >
              {menuOpen ? <X size={22} strokeWidth={1.6} /> : <Menu size={22} strokeWidth={1.6} />}
            </button>

            <nav aria-label={ts('primaryNav')} className="hidden lg:block">
              <ul className="flex items-center gap-7">
                {nav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className="relative py-2 text-[13px] font-medium uppercase ltr:tracking-[0.16em] rtl:text-[15px] text-black after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-center after:scale-x-[0.01] after:bg-black after:opacity-0 after:transition-[transform,opacity] after:duration-300 hover:after:scale-x-100 hover:after:opacity-100 aria-[current=page]:after:scale-x-100 aria-[current=page]:after:opacity-100"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Center: wordmark */}
          <Link href="/" aria-label="BAIA Swimwear" className="justify-self-center">
            <Wordmark />
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

      {/* Mobile menu */}
      <div
        id="mobile-menu"
        hidden={!menuOpen}
        className="absolute inset-x-0 top-full border-b border-header-line bg-white shadow-[0_24px_48px_-24px_rgba(15,42,54,0.25)] lg:hidden"
      >
        <nav aria-label={ts('primaryNav')} className="container-header py-4">
          <ul>
            {nav.map((item) => (
              <li key={item.href} className="border-b border-header-line last:border-0">
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className="block py-4 text-[15px] font-medium uppercase ltr:tracking-[0.12em] text-black aria-[current=page]:underline underline-offset-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-header-line pt-4 text-sm font-semibold">
            <LocaleSwitcher
              pathname={pathname}
              onAfterSwitch={() => setMenuOpen(false)}
              variant="label"
              className="inline-flex items-center rounded-none border border-black/20 px-4 py-2 text-black"
            />
            {isAdmin && (
              <Link href="/admin" className="inline-flex items-center gap-2 rounded-none border border-black/20 px-4 py-2 text-black">
                <LayoutDashboard size={16} strokeWidth={1.6} />
                {t('adminPanel')}
              </Link>
            )}
            {session?.user && (
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-none border border-black/20 px-4 py-2 text-black"
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
