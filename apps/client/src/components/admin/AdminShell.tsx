'use client';

import { Link, usePathname } from '@/i18n/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  FolderTree,
  Tags,
  Waves,
  Bell,
  Search,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AdminUser = {
  name?: string | null;
  email: string;
  role?: string;
  image?: string | null;
};

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/categories', label: 'Categories', icon: FolderTree },
  { href: '/admin/products', label: 'Products', icon: Package },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/coupons', label: 'Coupons', icon: Tags },
  { href: '/admin/customers', label: 'Customers', icon: Users, future: true },
];

export function AdminShell({
  user,
  children,
}: {
  user: AdminUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const displayName = user.name || user.email.split('@')[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 start-0 z-40 flex w-72 flex-col border-e border-[#eeeeee] bg-white">
        <div className="flex items-center gap-3 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#005d72] text-white">
            <Waves size={20} strokeWidth={2} />
          </div>
          <div>
            <p className="font-serif text-xl leading-none tracking-[-0.02em] text-[#1a1c1c]">
              BAIA
            </p>
            <p className="font-body text-[11px] uppercase tracking-[0.12em] text-[#3f484c]">
              Admin Panel
            </p>
          </div>
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
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-body text-sm text-[#bec8cd] cursor-not-allowed"
                >
                  <item.icon size={18} />
                  {item.label}
                  <span className="ms-auto rounded-full bg-[#f3f3f4] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#3f484c]">
                    Soon
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
                    ? 'bg-[#007791] text-white shadow-md shadow-[#007791]/25'
                    : 'text-[#3f484c] hover:bg-[#e8e8e8]',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[#eeeeee] p-4">
          <div className="flex items-center gap-3 rounded-xl bg-[#e7e2d9] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#005d72] text-white">
              <Shield size={14} />
            </div>
            <div>
              <p className="font-body text-xs font-semibold text-[#1a1c1c]">Admin Status</p>
              <p className="font-body text-[11px] text-[#3f484c]">Premium Access</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="ps-72">
        <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#eeeeee] bg-white ps-72 pe-6">
          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[#3f484c]"
            />
            <input
              type="text"
              placeholder="Search orders, products, customers..."
              className="w-full rounded-full bg-[#eeeeee] py-2.5 ps-10 pe-4 font-body text-sm text-[#1a1c1c] placeholder:text-[#3f484c]/60 focus:outline-none focus:ring-2 focus:ring-[#005d72]/20"
            />
          </div>

          <div className="flex items-center gap-5">
            <button
              type="button"
              className="relative rounded-full p-2 text-[#3f484c] transition-colors hover:bg-[#f3f3f4]"
              aria-label="Notifications"
            >
              <Bell size={20} />
              <span className="absolute end-2 top-2 h-2 w-2 rounded-full bg-[#ba1a1a]" />
            </button>

            <div className="flex items-center gap-3">
              <div className="text-end">
                <p className="font-body text-sm font-medium text-[#1a1c1c]">{displayName}</p>
                <p className="font-body text-xs text-[#3f484c]">{user.role || 'Admin'}</p>
              </div>
              {user.image ? (
                <img
                  src={user.image}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-[#eeeeee]"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#005d72] font-body text-xs font-semibold text-white">
                  {initials}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="min-h-screen overflow-y-auto bg-[#f9f9f9] px-8 pb-8 pt-24">
          {children}
        </main>
      </div>
    </div>
  );
}
