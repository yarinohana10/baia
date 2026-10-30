'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, MessageCircle, Ruler, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { localized, type SizeGuide as SizeGuideData } from '@/lib/catalog/size-guides';
import { HowToMeasure } from '@/components/storefront/size-guide/HowToMeasure';
import { SizeGuideTables } from '@/components/storefront/size-guide/SizeGuideTables';

type Props = {
  /** The guide linked to the product's category (Admin -> Size guides). */
  guide: SizeGuideData;
  /** Sizes this product comes in (highlighted in the chart). */
  sizes: string[];
  /** wa.me link, or null to show the contact-page link instead. */
  whatsappLink: string | null;
  /** Trigger style: inline text link (next to the size picker) or an underlined link in body copy. */
  variant?: 'inline' | 'text';
  className?: string;
};

/**
 * "Size guide" link + accessible dialog (focus trapped, Esc / backdrop close,
 * focus returns to the link). Slides in from the side on desktop and up from
 * the bottom on phones.
 */
export function SizeGuide({ guide, sizes, whatsappLink, variant = 'inline', className }: Props) {
  const t = useTranslations('pdp.sizeGuide');
  const tGuide = useTranslations('sizeGuide');
  const locale = useLocale();
  const intro = localized(locale, guide.introHe, guide.introEn);
  const Arrow = locale === 'he' ? ArrowLeft : ArrowRight;

  return (
    <Dialog.Root>
      <Dialog.Trigger
        className={cn(
          'inline-flex items-center gap-1.5 text-[12px] text-black hover:opacity-60 transition-opacity rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black',
          variant === 'text' && 'text-sm',
          className,
        )}
      >
        <Ruler size={14} strokeWidth={1.4} aria-hidden="true" />
        {t('open')}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          className={cn(
            'fixed z-50 flex flex-col bg-white shadow-2xl outline-none transition-transform duration-300 ease-out',
            // phones: bottom sheet
            'inset-x-0 bottom-0 max-h-[88dvh] rounded-none data-starting-style:translate-y-full data-ending-style:translate-y-full',
            // desktop: side panel on the reading-end side
            'md:inset-y-0 md:bottom-auto md:end-0 md:start-auto md:h-full md:max-h-none md:w-[30rem] md:rounded-none md:data-starting-style:translate-y-0 md:data-ending-style:translate-y-0 md:data-starting-style:ltr:translate-x-full md:data-ending-style:ltr:translate-x-full md:data-starting-style:rtl:-translate-x-full md:data-ending-style:rtl:-translate-x-full',
          )}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <Dialog.Title className="text-lg font-semibold text-charcoal">
              {t('title')} <span className="font-normal text-black/50">· {localized(locale, guide.nameHe, guide.nameEn)}</span>
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('close')}
              className="flex size-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-neutral-700"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 text-sm text-gray-700">
            <Dialog.Description className={cn('leading-relaxed text-gray-600', !intro && 'sr-only')}>
              {intro || t('title')}
            </Dialog.Description>

            {guide.tables.length > 0 && (
              <SizeGuideTables tables={guide.tables} locale={locale} sizeLabel={t('sizeColumn')} highlight={sizes} compact />
            )}

            <HowToMeasure guide={guide} locale={locale} title={t('howToMeasure')} compact />

            {guide.tips.length > 0 && (
              <section className="border border-ocean-100 bg-[#F5F9FC] px-4 py-3">
                <h3 className="mb-1.5 font-semibold text-charcoal">{t('fitTipTitle')}</h3>
                <ul className="list-disc space-y-1 ps-4 leading-relaxed">
                  {guide.tips.map((tip, i) => (
                    <li key={i}>{localized(locale, tip.he, tip.en)}</li>
                  ))}
                </ul>
              </section>
            )}

            <Link
              href={`/size-guide/${guide.slug}`}
              className="group inline-flex items-center gap-1.5 font-medium text-ocean-700 underline underline-offset-4 hover:no-underline"
            >
              {tGuide('fullGuide')}
              <Arrow size={14} aria-hidden="true" className="transition-transform group-hover:ltr:translate-x-0.5 group-hover:rtl:-translate-x-0.5" />
            </Link>
          </div>

          <div className="border-t border-gray-100 bg-[#F7F7F7] px-5 py-4">
            <p className="mb-2 font-medium text-charcoal">{t('notSure')}</p>
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-none bg-[#1f8f4e] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#187a41] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"
              >
                <MessageCircle size={16} aria-hidden="true" />
                {t('whatsapp')}
              </a>
            ) : (
              <Link href="/contact" className="text-sm text-black underline underline-offset-4">
                {t('contact')}
              </Link>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
