import { useTranslations } from 'next-intl';

/** The "or continue with" rule between the form and the Google button. */
export function OrDivider() {
  const t = useTranslations('auth');
  return (
    <div className="relative py-2">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[#bec8cd]" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-4 font-body text-xs uppercase tracking-[0.1em] text-[#3f484c]">
          {t('orContinueWith')}
        </span>
      </div>
    </div>
  );
}
