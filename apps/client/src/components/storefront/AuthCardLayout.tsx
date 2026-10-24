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
    <div className="min-h-screen bg-white flex flex-col [--radius:0px]">
      <div className="p-5 sm:p-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} className="rtl:rotate-180" />
          {t('backToHome')}
        </Link>
      </div>
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md bg-white border border-[#e2e2e2] rounded-none p-6 sm:p-10 flex flex-col space-y-8">
          <h2 dir="ltr" className="font-display text-[32px] leading-[40px] text-black text-center tracking-[0.2em]">
            BAIA
          </h2>
          <div className="flex flex-col space-y-3">
            <h1 className="text-[20px] sm:text-[22px] font-semibold uppercase ltr:tracking-[0.06em] text-black">{title}</h1>
            {subtitle && <p className="text-base leading-6 text-neutral-600">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  'w-full bg-transparent border-b border-neutral-300 py-3 text-base text-black focus:outline-none focus:border-black transition-colors duration-300 placeholder:text-neutral-600/50';

export const authLabelClass = 'text-xs font-bold uppercase tracking-[0.1em] text-black';

export const authButtonClass =
  'w-full flex items-center justify-center gap-2 bg-neutral-500 text-white text-sm font-bold uppercase tracking-[0.1em] py-4 rounded-sm hover:bg-black transition-colors duration-300 disabled:opacity-70';

export const authLinkClass =
  ' text-sm font-bold uppercase tracking-[0.1em] text-black underline underline-offset-4 decoration-neutral-300 hover:decoration-black transition-colors';

export function AuthAlert({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#e1f3ec] text-[#0f5132]';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`${cls} text-sm p-3 rounded-none`}>
      {children}
    </div>
  );
}
