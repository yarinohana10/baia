'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSession } from '@/lib/auth-client';
import Image from 'next/image';
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  Globe,
} from 'lucide-react';

export function Header() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const categories = [
    { label: tNav('men'), href: '/category/men' },
    { label: tNav('women'), href: '/category/women' },
    { label: tNav('children'), href: '/category/children' },
    { label: tNav('newArrivals'), href: '/new-arrivals' },
  ];

  const switchLocale = () => {
    const newLocale = locale === 'he' ? 'en' : 'he';
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      {/* Top announcement bar */}
      <div className="bg-ocean-700 text-white text-center text-xs py-2 tracking-wider font-light">
        {locale === 'he' ? 'משלוח חינם בקנייה מעל ₪249' : 'Free shipping on orders over ₪249'}
      </div>

      {/* Main header */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-6">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            {/* Mobile menu */}
            <button
              className="lg:hidden p-1.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>

            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/logo/baia-logo.svg"
                alt="BAIA Swimwear"
                width={120}
                height={24}
                priority
                className="h-6 w-auto"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-6">
              {categories.map((cat) => (
                <Link
                  key={cat.href}
                  href={cat.href}
                  className="text-[13px] font-medium text-gray-700 hover:text-ocean-700 transition-colors whitespace-nowrap"
                >
                  {cat.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: Search + Icons */}
          <div className="flex items-center gap-3">
            {/* Search bar (desktop) */}
            <div className="hidden md:flex items-center">
              <div className="relative">
                <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('search')}
                  className="w-48 lg:w-56 ps-9 pe-3 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm placeholder:text-gray-400 focus:outline-none focus:border-ocean-400 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Search icon (mobile only) */}
            <button
              className="md:hidden p-2 text-gray-600 hover:text-ocean-700 transition-colors"
              aria-label={t('search')}
            >
              <Search size={20} />
            </button>

            <button
              onClick={switchLocale}
              className="p-2 text-gray-600 hover:text-ocean-700 transition-colors hidden sm:flex items-center"
              aria-label="Switch language"
            >
              <Globe size={20} />
            </button>

            {session?.user ? (
              <Link
                href="/account"
                className="p-2 text-gray-600 hover:text-ocean-700 transition-colors hidden sm:block"
                aria-label={t('account')}
              >
                <User size={20} />
              </Link>
            ) : (
              <Link
                href="/login"
                className="p-2 text-gray-600 hover:text-ocean-700 transition-colors hidden sm:block"
                aria-label={t('login')}
              >
                <User size={20} />
              </Link>
            )}

            <Link
              href="/wishlist"
              className="p-2 text-gray-600 hover:text-ocean-700 transition-colors hidden sm:block"
              aria-label={t('wishlist')}
            >
              <Heart size={20} />
            </Link>

            <Link
              href="/cart"
              className="p-2 text-gray-600 hover:text-ocean-700 transition-colors relative"
              aria-label={t('cart')}
            >
              <ShoppingBag size={20} />
              <span className="absolute -top-0.5 -end-0.5 bg-ocean-700 text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                0
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          {/* Mobile search */}
          <div className="px-4 pt-4">
            <div className="relative">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('search')}
                className="w-full ps-9 pe-3 py-2.5 bg-gray-50 border border-gray-200 rounded-full text-sm placeholder:text-gray-400 focus:outline-none focus:border-ocean-400"
                autoFocus
              />
            </div>
          </div>
          <nav className="px-4 py-4 space-y-1">
            {categories.map((cat) => (
              <Link
                key={cat.href}
                href={cat.href}
                className="block text-sm font-medium text-gray-700 hover:text-ocean-700 py-2.5 border-b border-gray-50"
                onClick={() => setMobileMenuOpen(false)}
              >
                {cat.label}
              </Link>
            ))}
            <button
              onClick={() => { switchLocale(); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 text-sm text-gray-700 py-2.5 w-full"
            >
              <Globe size={16} />
              {locale === 'he' ? 'English' : 'עברית'}
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
