import { useTranslations } from 'next-intl';
import { RotateCcw, ShieldCheck, Truck, Undo2 } from 'lucide-react';

/** Four store promises under the add-to-bag button. */
export function TrustRow({ freeShippingThreshold }: { freeShippingThreshold: string }) {
  const t = useTranslations('pdp.trust');
  const items = [
    { icon: Truck, text: t('freeShipping', { threshold: freeShippingThreshold }) },
    { icon: Undo2, text: t('freeCancel') },
    { icon: RotateCcw, text: t('returns') },
    { icon: ShieldCheck, text: t('securePayment') },
  ];
  return (
    <ul aria-label={t('label')} className="my-7 grid grid-cols-2 gap-x-4 gap-y-3.5 border-y border-black/10 py-4 text-[12px] text-black/70">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-center gap-2.5">
          <Icon size={16} strokeWidth={1.3} aria-hidden="true" className="shrink-0 text-black" />
          <span className="leading-snug">{text}</span>
        </li>
      ))}
    </ul>
  );
}
