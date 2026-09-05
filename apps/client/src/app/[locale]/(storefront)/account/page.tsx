'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import { Package, LogOut, ChevronRight, Loader2 } from 'lucide-react';

async function handleSignOut() {
  await signOut();
  window.location.href = '/';
}

export default function AccountPage() {
  const t = useTranslations('account');
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 flex justify-center">
        <Loader2 size={32} className="animate-spin text-ocean-600" />
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="mb-10">
        <h1 className="font-serif text-[32px] leading-[40px] text-[#1a1c1c] mb-2">
          {t('title')}
        </h1>
        {user?.name && (
          <p className="font-body text-base text-[#3f484c]">
            {t('welcome')}, {user.name}
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
        {user?.name && (
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.1em] text-[#3f484c] mb-1">
              {t('nameLabel')}
            </p>
            <p className="font-body text-base text-[#1a1c1c]">{user.name}</p>
          </div>
        )}
        {user?.email && (
          <div>
            <p className="font-body text-xs font-bold uppercase tracking-[0.1em] text-[#3f484c] mb-1">
              {t('emailLabel')}
            </p>
            <p className="font-body text-base text-[#1a1c1c]">{user.email}</p>
          </div>
        )}
      </div>

      <Link
        href="/account/orders"
        className="flex items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:border-ocean-300 hover:bg-ocean-50/30 transition-colors group mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-ocean-50 rounded-lg text-ocean-700">
            <Package size={20} strokeWidth={1.8} />
          </div>
          <div>
            <p className="font-body text-base font-semibold text-[#1a1c1c]">
              {t('myOrders')}
            </p>
            <p className="font-body text-sm text-[#3f484c]">
              {t('myOrdersDescription')}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-gray-400 group-hover:text-ocean-600 rtl:rotate-180 transition-colors" />
      </Link>

      <button
        type="button"
        onClick={handleSignOut}
        className="flex items-center justify-center gap-2 w-full py-3.5 border border-gray-200 rounded-xl font-body text-sm font-semibold text-[#3f484c] hover:border-ocean-300 hover:text-ocean-700 hover:bg-ocean-50/30 transition-colors"
      >
        <LogOut size={16} strokeWidth={1.8} />
        {t('signOut')}
      </button>
    </div>
  );
}
