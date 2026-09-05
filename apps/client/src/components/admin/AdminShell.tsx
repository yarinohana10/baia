'use client';

import Image from 'next/image';
import { Link, usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  FolderTree,
  Tags,
  Settings,
  Waves,
  Bell,
  Search,
  Shield,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type AdminUser = {
  name?: string | null;
  email: string;
  role?: string;
  image?: string | null;
};

const navItems = [
  { href: '/admin', labelKey: 'dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/categories', labelKey: 'categories', icon: FolderTree },
  { href: '/admin/products', labelKey: 'products', icon: Package },
  { href: '/admin/orders', labelKey: 'orders', icon: ShoppingBag },
  { href: '/admin/coupons', labelKey: 'coupons', icon: Tags },
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
  { href: '/admin/customers', labelKey: 'customers', icon: Users, future: true },
];

export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations('admin');
  const displayName = user.name || user.email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 flex w-72 flex-col border-e border-border bg-card">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-700 text-white">
            <Waves size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="font-serif text-xl leading-none tracking-[-0.02em] text-foreground">
              BAIA
            </p>
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('panelTitle')}
            </p>
          </div>
        </div>

        <div className="px-4 mb-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-body text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <ArrowLeft size={14} />
            {t('backToStore')}
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            if (item.future) {
              return (
                <span
                  key={item.href}
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-body text-sm text-muted-foreground/50 cursor-not-allowed"
                >
                  <item.icon size={18} />
                  {t(`nav.${item.labelKey}`)}
                  <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t('nav.soon')}
                  </span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 font-body text-sm transition-all',
                  isActive
                    ? 'bg-ocean-700 text-white shadow-md shadow-ocean-700/25'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                <item.icon size={18} />
                {t(`nav.${item.labelKey}`)}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ocean-700 text-white">
              <Shield size={14} />
            </div>
            <div>
              <p className="font-body text-xs font-semibold text-foreground">{t('adminStatus')}</p>
              <p className="font-body text-[11px] text-muted-foreground">{t('premiumAccess')}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="ps-72">
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card ps-72 pe-6">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="rounded-full bg-muted ps-9 border-transparent focus-visible:border-ring"
            />
          </div>

          <div className="flex items-center gap-5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground"
              aria-label={t('notifications')}
            >
              <Bell size={20} />
              <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            </Button>

            <div className="flex items-center gap-3">
              <div className="text-end">
                <p className="font-body text-sm font-medium text-foreground">{displayName}</p>
                <p className="font-body text-xs text-muted-foreground">{user.role || 'Admin'}</p>
              </div>
              {user.image ? (
                <Image
                  src={user.image}
                  alt={displayName}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ocean-700 font-body text-xs font-semibold text-white">
                  {initials}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-screen overflow-y-auto bg-muted/30 px-8 pb-8 pt-24">
          {children}
        </main>
      </div>
    </div>
  );
}
