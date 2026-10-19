'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLightbox } from '@/hooks/catalog/useLightbox';
import type { GalleryImage } from '@/lib/catalog/variant-selection';
import { GalleryLightbox } from './product/GalleryLightbox';

type Props = {
  images: GalleryImage[];
  /** Fallback alt text when an image has none for the current locale. */
  productName: string;
};

/**
 * Product-page image gallery: swipeable main carousel (touch/mouse drag via
 * Embla) with synced thumbnails, prev/next buttons and arrow-key support.
 * Follows the document direction, so in Hebrew "next" is to the left.
 * Clicking (or Enter on) the main image opens a full-screen lightbox with zoom.
 */
export default function ProductGallery({ images, productName }: Props) {
  const locale = useLocale();
  const t = useTranslations('product.gallery');
  const isRtl = locale === 'he';

  const [mainRef, mainApi] = useEmblaCarousel({ direction: isRtl ? 'rtl' : 'ltr', loop: false });
  const [thumbsRef, thumbsApi] = useEmblaCarousel({
    direction: isRtl ? 'rtl' : 'ltr',
    containScroll: 'keepSnaps',
    dragFree: true,
  });
  const [selected, setSelected] = useState(0);
  const lightbox = useLightbox();
  const tPdp = useTranslations('pdp.gallery');

  const imagesKey = images.map((img) => img.id).join(',');

  const altFor = (img: GalleryImage, index: number) => {
    const alt = (isRtl ? img.altTextHe : img.altTextEn) || img.altText;
    return alt || (images.length > 1 ? t('imageAlt', { name: productName, n: index + 1 }) : productName);
  };

  const onSelect = useCallback(() => {
    if (!mainApi) return;
    const index = mainApi.selectedScrollSnap();
    setSelected(index);
    thumbsApi?.scrollTo(index);
  }, [mainApi, thumbsApi]);

  useEffect(() => {
    if (!mainApi) return;
    onSelect();
    mainApi.on('select', onSelect);
    mainApi.on('reInit', onSelect);
    return () => {
      mainApi.off('select', onSelect);
      mainApi.off('reInit', onSelect);
    };
  }, [mainApi, onSelect]);

  // A different image set (e.g. another color was picked) starts at the cover
  useEffect(() => {
    mainApi?.reInit();
    thumbsApi?.reInit();
    mainApi?.scrollTo(0, true);
  }, [imagesKey, mainApi, thumbsApi]);

  const scrollTo = (index: number) => mainApi?.scrollTo(index);
  const prev = () => mainApi?.scrollPrev();
  const next = () => mainApi?.scrollNext();

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Visual direction: in RTL the next image sits to the left
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isRtl) next();
      else prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isRtl) prev();
      else next();
    } else if (e.key === 'Home') {
      e.preventDefault();
      scrollTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      scrollTo(images.length - 1);
    }
  };

  if (images.length === 0) {
    return <div className="aspect-[4/5] rounded-xl bg-gray-100" aria-hidden />;
  }

  const multiple = images.length > 1;

  return (
    <div className="space-y-3" data-testid="product-gallery">
      <section
        className="group relative overflow-hidden rounded-xl bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
        aria-roledescription="carousel"
        aria-label={t('label', { name: productName })}
        tabIndex={multiple ? 0 : -1}
        onKeyDown={multiple ? onKeyDown : undefined}
      >
        <div ref={mainRef} className="overflow-hidden">
          <div className="flex touch-pan-y">
            {images.map((img, i) => (
              <div
                key={img.id}
                className="relative aspect-[4/5] min-w-0 shrink-0 grow-0 basis-full"
                role="group"
                aria-roledescription="slide"
                aria-label={t('slideOf', { n: i + 1, total: images.length })}
                aria-hidden={i !== selected}
              >
                <Image
                  src={img.url}
                  alt={altFor(img, i)}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  priority={i === 0}
                  draggable={false}
                  className="select-none object-cover"
                />
                {/* Embla swallows the click that ends a swipe, so this only fires on a real tap/click */}
                <button
                  type="button"
                  onClick={() => lightbox.openAt(i)}
                  tabIndex={i === selected ? 0 : -1}
                  aria-label={tPdp('open', { n: i + 1 })}
                  className="absolute inset-0 cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-ocean-600"
                />
              </div>
            ))}
          </div>
        </div>

        {multiple && (
          <>
            <button
              type="button"
              onClick={prev}
              disabled={selected === 0}
              aria-label={t('previous')}
              tabIndex={-1}
              className="absolute start-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-charcoal shadow transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100"
            >
              <ChevronLeft size={18} className="rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={next}
              disabled={selected === images.length - 1}
              aria-label={t('next')}
              tabIndex={-1}
              className="absolute end-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-charcoal shadow transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100"
            >
              <ChevronRight size={18} className="rtl:rotate-180" />
            </button>
            <span
              className="absolute bottom-3 end-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white tabular-nums"
              aria-live="polite"
            >
              {t('counter', { n: selected + 1, total: images.length })}
            </span>
          </>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-3 end-3 hidden size-9 items-center justify-center rounded-full bg-white/85 text-charcoal shadow transition-opacity md:flex md:opacity-0 md:group-hover:opacity-100"
        >
          <Expand size={16} />
        </span>
      </section>

      <GalleryLightbox
        images={images}
        lightbox={lightbox}
        onClose={(index) => {
          lightbox.close();
          if (index !== selected) mainApi?.scrollTo(index, true);
        }}
        altFor={altFor}
        productName={productName}
      />

      {multiple && (
        <div ref={thumbsRef} className="overflow-hidden">
          <div className="flex gap-2" role="tablist" aria-label={t('thumbnails')}>
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                role="tab"
                aria-selected={i === selected}
                aria-label={t('showImage', { n: i + 1 })}
                onClick={() => scrollTo(i)}
                className={cn(
                  'relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:size-20',
                  i === selected ? 'border-ocean-700' : 'border-transparent opacity-70 hover:opacity-100',
                )}
              >
                <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
