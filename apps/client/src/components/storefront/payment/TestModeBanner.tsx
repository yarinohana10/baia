import { useTranslations } from 'next-intl';
import { FlaskConical } from 'lucide-react';

/** "Test mode: no real charge" banner while the mock provider is bound. */
export function TestModeBanner() {
  const t = useTranslations('payment');
  return (
    <div
      role="note"
      className="mb-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <FlaskConical size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold text-sm">{t('testBanner')}</p>
        <p className="text-xs">{t('testBannerHint')}</p>
      </div>
    </div>
  );
}
