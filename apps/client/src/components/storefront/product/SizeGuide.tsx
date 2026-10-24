'use client';

import { Dialog } from '@base-ui/react/dialog';
import { useTranslations } from 'next-intl';
import { MessageCircle, Ruler, X } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { GENERIC_HOW_TO_MEASURE, type SizeChart } from '@/lib/catalog/size-charts';

type Props = {
  chart: SizeChart | null;
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
export function SizeGuide({ chart, sizes, whatsappLink, variant = 'inline', className }: Props) {
  const t = useTranslations('pdp.sizeGuide');
  const steps = chart?.howToMeasure ?? GENERIC_HOW_TO_MEASURE;
  const offered = new Set(sizes);

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
            <Dialog.Title className="text-lg font-semibold text-charcoal">{t('title')}</Dialog.Title>
            <Dialog.Close
              aria-label={t('close')}
              className="flex size-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-neutral-700"
            >
              <X size={18} aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5 text-sm text-gray-700">
            <Dialog.Description className="leading-relaxed text-gray-600">{t('intro')}</Dialog.Description>

            {chart ? (
              <section aria-labelledby="size-chart-title">
                <h3 id="size-chart-title" className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('chartTitle', { chart: t(`charts.${chart.id}`) })}
                </h3>
                <div className="overflow-x-auto rounded-none border border-gray-200">
                  <table className="w-full text-center text-[13px] tabular-nums">
                    <thead className="bg-neutral-100 text-gray-600">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 font-medium">
                          {t('sizeColumn')}
                        </th>
                        {chart.columns.map((m) => (
                          <th key={m} scope="col" className="px-3 py-2.5 font-medium">
                            {t(`measurements.${m}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chart.rows.map((row) => (
                        <tr
                          key={row.size}
                          className={cn('border-t border-gray-100', offered.has(row.size) && 'bg-[#F7F7F7]/50')}
                        >
                          <th scope="row" className="px-3 py-2.5 font-semibold text-charcoal" dir="ltr">
                            {row.size}
                          </th>
                          {chart.columns.map((m) => (
                            <td key={m} className="px-3 py-2.5" dir="ltr">
                              {row.values[m] ?? '–'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <p className="rounded-none bg-neutral-100 px-4 py-3 leading-relaxed">{t('noChart')}</p>
            )}

            <section aria-labelledby="how-to-measure-title">
              <h3 id="how-to-measure-title" className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                {t('howToMeasure')}
              </h3>
              <ol className="space-y-3">
                {steps.map((m, i) => (
                  <li key={m} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black text-xs font-semibold text-white"
                    >
                      {i + 1}
                    </span>
                    <p className="leading-relaxed">
                      <strong className="font-semibold text-charcoal">{t(`measurements.${m}`)}: </strong>
                      {t(`steps.${m}`)}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-none border border-neutral-200 bg-[#F7F7F7] px-4 py-3">
              <h3 className="mb-1 font-semibold text-charcoal">{t('fitTipTitle')}</h3>
              <p className="leading-relaxed">{t('fitTip')}</p>
            </section>
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
