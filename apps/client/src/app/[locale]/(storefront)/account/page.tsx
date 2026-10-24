'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { Package, MapPin, LogOut, ChevronRight, Loader2 } from 'lucide-react';
import { VerifyEmailBanner } from '@/components/storefront/VerifyEmailBanner';
import { ProfileCard } from '@/components/storefront/account/ProfileCard';
import { PasswordCard } from '@/components/storefront/account/PasswordCard';
import { MarketingCard } from '@/components/storefront/account/MarketingCard';

async function handleSignOut() {
  await signOut();
  window.location.href = '/';
}

function AccountLink({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-none hover:border-neutral-400 hover:bg-[#F7F7F7]/30 transition-colors group mb-6"
    >
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-[#F7F7F7] rounded-none text-black">{icon}</div>
        <div>
          <p className="text-base font-semibold text-black">{title}</p>
          <p className="text-sm text-neutral-600">{description}</p>
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-400 group-hover:text-neutral-700 rtl:rotate-180 transition-colors" />
    </Link>
  );
}

export default function AccountPage() {
  const t = useTranslations('account');
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 flex justify-center">
        <Loader2 size={32} className="animate-spin text-neutral-700" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="mb-10">
        <h1 className="mb-2 text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">
          {t('title')}
        </h1>
        {user?.name && (
          <p className="text-base text-neutral-600">
            {t('welcome')}, {user.name}
          </p>
        )}
      </div>

      {user && !user.emailVerified && <VerifyEmailBanner email={user.email} />}

      {user && <ProfileCard name={user.name} email={user.email} />}

      <AccountLink
        href="/account/orders"
        icon={<Package size={20} strokeWidth={1.8} />}
        title={t('myOrders')}
        description={t('myOrdersDescription')}
      />

      <AccountLink
        href="/account/addresses"
        icon={<MapPin size={20} strokeWidth={1.8} />}
        title={t('myAddresses')}
        description={t('myAddressesDescription')}
      />

      {user && <MarketingCard />}

      {user && <PasswordCard />}

      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 w-full py-3.5 border border-gray-200 rounded-none text-sm font-semibold text-neutral-600 hover:border-neutral-400 hover:text-black hover:bg-[#F7F7F7]/30 transition-colors"
      >
        <LogOut size={16} strokeWidth={1.8} />
        {t('signOut')}
      </button>
    </div>
  );
}
