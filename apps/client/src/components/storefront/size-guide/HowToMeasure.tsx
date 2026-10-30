import Image from 'next/image';
import { cn } from '@/lib/utils';
import { localized, type SizeGuide } from '@/lib/catalog/size-guides';

type Props = {
  guide: SizeGuide;
  locale: string;
  title: string;
  /** Narrow layout for the product-page dialog (image above the steps). */
  compact?: boolean;
};

/** The how-to-measure illustration next to the numbered steps. */
export function HowToMeasure({ guide, locale, title, compact = false }: Props) {
  if (guide.steps.length === 0 && !guide.imageUrl) return null;
  const alt = localized(locale, guide.imageAltHe, guide.imageAltEn);

  return (
    <section aria-labelledby={`how-to-measure-${compact ? 'dialog' : 'page'}`}>
      <h2
        id={`how-to-measure-${compact ? 'dialog' : 'page'}`}
        className={cn(
          'font-semibold uppercase text-ink ltr:tracking-[0.08em]',
          compact ? 'mb-3 text-[12px] text-black/55' : 'mb-6 text-center text-[17px] sm:mb-8 sm:text-[20px]',
        )}
      >
        {title}
      </h2>
      <div className={cn('grid gap-6', !compact && guide.imageUrl && 'md:grid-cols-2 md:items-center md:gap-12')}>
        {guide.imageUrl && (
          <div className={cn('relative mx-auto w-full bg-white', compact ? 'max-w-[280px]' : 'max-w-[460px]')}>
            <Image
              src={guide.imageUrl}
              alt={alt}
              width={1024}
              height={1536}
              sizes={compact ? '280px' : '(min-width: 768px) 460px, 100vw'}
              className="h-auto w-full"
            />
          </div>
        )}
        {guide.steps.length > 0 && (
          <ol className={cn(compact ? 'space-y-3' : 'space-y-5')}>
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full border border-logo-blue font-semibold text-ocean-700',
                    compact ? 'size-6 text-[12px]' : 'size-9 text-[14px]',
                  )}
                >
                  {i + 1}
                </span>
                <p className={cn('leading-relaxed text-black/70', compact ? 'text-[13px]' : 'pt-1 text-[15px]')}>
                  <strong className="block font-semibold uppercase text-ink ltr:tracking-[0.06em]">
                    {localized(locale, step.titleHe, step.titleEn)}
                  </strong>
                  {localized(locale, step.bodyHe, step.bodyEn)}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
