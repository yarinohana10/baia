'use client';

import { useTranslations } from 'next-intl';
import { AuthSplitLayout } from '@/components/storefront/auth/AuthSplitLayout';
import { RegisterForm } from '@/components/storefront/auth/RegisterForm';

export default function RegisterPage() {
  const t = useTranslations('auth');
  return (
    <AuthSplitLayout
      hero={
        <div>
          <p className="text-[24px] leading-[32px] text-white drop- mb-3">{t('heroRegisterTitle')}</p>
          <p className="text-lg leading-7 text-white/90 max-w-sm font-light drop-">
            {t('heroRegisterSubtitle')}
          </p>
        </div>
      }
      title={t('createAccount')}
      subtitle={t('createAccountSubtitle')}
    >
      <RegisterForm />
    </AuthSplitLayout>
  );
}
