import { useTranslations } from 'next-intl';

/** The "or continue with" rule between the form and the Google button. */
export function OrDivider() {
  const t = useTranslations('auth');
  return (
    <div className="relative py-2">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-neutral-300" />
      </div>
      <div className="relative flex justify-center">
        <span className="bg-white px-4 text-xs uppercase tracking-[0.1em] text-neutral-600">
          {t('orContinueWith')}
        </span>
      </div>
    </div>
  );
}
