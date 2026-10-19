import { useTranslations } from 'next-intl';
import { RotateCcw, ShieldCheck, Truck, Undo2 } from 'lucide-react';

/** Four store promises under the add-to-bag button. */
export function TrustRow({ freeShippingThreshold, cancelHours }: { freeShippingThreshold: string; cancelHours: number }) {
  const t = useTranslations('pdp.trust');
  const items = [
    { icon: Truck, text: t('freeShipping', { threshold: freeShippingThreshold }) },
    { icon: Undo2, text: t('freeCancel', { hours: cancelHours }) },
    { icon: RotateCcw, text: t('returns') },
    { icon: ShieldCheck, text: t('securePayment') },
  ];
  return (
    <ul aria-label={t('label')} className="my-6 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-warm-100 px-4 py-4 text-[13px] text-gray-700">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2.5">
          <Icon size={18} strokeWidth={1.6} aria-hidden="true" className="shrink-0 text-ocean-700" />
          <span className="leading-snug">{text}</span>
        </li>
      ))}
    </ul>
  );
}
