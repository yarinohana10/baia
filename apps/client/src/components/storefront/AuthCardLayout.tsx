import { useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';

/** Minimal centered layout shared by forgot/reset password and email verification pages. */
export function AuthCardLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations('auth');
  return (
    <div className="min-h-screen bg-[#f9f9f9] flex flex-col">
      <div className="p-5 sm:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-body text-sm text-[#3f484c] hover:text-[#1a1c1c] transition-colors"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('backToHome')}
        </Link>
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md bg-white border border-[#e2e2e2] rounded-xl p-6 sm:p-10 flex flex-col space-y-8">
          <h2 dir="ltr" className="font-serif text-[32px] leading-[40px] text-[#1a1c1c] text-center tracking-[0.2em]">
            BAIA
          </h2>
          <div className="flex flex-col space-y-3">
            <h1 className="font-serif text-[28px] leading-[36px] text-[#1a1c1c]">{title}</h1>
            {subtitle && <p className="font-body text-base leading-6 text-[#3f484c]">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  'w-full bg-transparent border-b border-[#bec8cd] py-3 font-body text-base text-[#1a1c1c] focus:outline-none focus:border-[#005d72] transition-colors duration-300 placeholder:text-[#3f484c]/50';

export const authLabelClass = 'font-body text-xs font-bold uppercase tracking-[0.1em] text-[#1a1c1c]';

export const authButtonClass =
  'w-full flex items-center justify-center gap-2 bg-[#565555] text-white font-body text-sm font-bold uppercase tracking-[0.1em] py-4 rounded-sm hover:bg-[#1a1c1c] transition-colors duration-300 disabled:opacity-70';

export const authLinkClass =
  'font-body text-sm font-bold uppercase tracking-[0.1em] text-[#1a1c1c] underline underline-offset-4 decoration-[#bec8cd] hover:decoration-[#005d72] transition-colors';

export function AuthAlert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#e1f3ec] text-[#0f5132]';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`${cls} text-sm p-3 rounded-lg`}>
      {children}
    </div>
  );
}
