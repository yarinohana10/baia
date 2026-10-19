import { useTranslations } from 'next-intl';
import { CANCELLATION_REASONS } from '@/lib/orders';

/** The disabled placeholder plus one `<option>` per cancellation reason. */
export function ReasonOptions() {
  const t = useTranslations('cancellation');
  return (
    <>
      <option value="" disabled>
        {t('reasonPlaceholder')}
      </option>
      {CANCELLATION_REASONS.map((r) => (
        <option key={r} value={r}>
          {t(`reasons.${r}`)}
        </option>
      ))}
    </>
  );
}
