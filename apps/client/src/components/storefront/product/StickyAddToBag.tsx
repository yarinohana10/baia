'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { GalleryImage } from '@/lib/catalog/variant-selection';
import { ProductPrice } from './ProductPrice';

type Props = {
  visible: boolean;
  name: string;
  image: GalleryImage | undefined;
  /** e.g. "Black · M". */
  selectionLabel: string;
  price: { current: number; original: number | null };
  buttonLabel: string;
  purchasable: boolean;
  adding: boolean;
  onAdd: () => void;
};

/** Phones: add-to-bag bar pinned to the bottom once the main button scrolls away. */
export function StickyAddToBag({ visible, name, image, selectionLabel, price, buttonLabel, purchasable, adding, onAdd }: Props) {
  const t = useTranslations('pdp');
  return (
    <div
      aria-hidden={!visible}
      inert={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur transition-transform duration-300 md:hidden',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        visible ? 'translate-y-0' : 'translate-y-full',
      )}
    >
      <div className="flex items-center gap-3" role="region" aria-label={t('sticky.label')}>
        {image && (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-gray-100">
            <Image src={image.url} alt="" fill sizes="48px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-charcoal">{name}</p>
          <p className="truncate text-xs text-gray-500">{selectionLabel}</p>
          <ProductPrice price={price} size="sm" />
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!purchasable || adding}
          className={cn(
            'h-11 shrink-0 rounded-lg px-5 text-sm font-semibold',
            purchasable ? 'bg-ocean-700 text-white disabled:opacity-70' : 'bg-gray-200 text-gray-500',
          )}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
