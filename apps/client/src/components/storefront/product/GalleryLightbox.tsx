'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Dialog } from '@base-ui/react/dialog';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GalleryImage } from '../ProductGallery';

type Props = {
  images: GalleryImage[];
  /** Index to open at; null = closed. */
  startIndex: number | null;
  /** Called with the image the shopper ended on, so the gallery can follow. */
  onClose: (index: number) => void;
  altFor: (img: GalleryImage, index: number) => string;
  productName: string;
};

/**
 * Full-screen image viewer. Click/Enter toggles a 2.5x zoom that follows the
 * pointer (desktop); arrows/keys move between images; Esc closes and focus
 * returns to the image that opened it. On phones the browser's pinch-zoom works.
 */
export function GalleryLightbox({ images, startIndex, onClose, altFor, productName }: Props) {
  const t = useTranslations('pdp.gallery');
  const tGallery = useTranslations('product.gallery');
  const isRtl = useLocale() === 'he';
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState('50% 50%');

  useEffect(() => {
    if (startIndex !== null) {
      setIndex(startIndex);
      setZoomed(false);
    }
  }, [startIndex]);

  const count = images.length;
  const go = (delta: number) => {
    setZoomed(false);
    setIndex((i) => (i + delta + count) % count);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (count < 2) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(isRtl ? 1 : -1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(isRtl ? -1 : 1);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!zoomed || e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOrigin(`${x}% ${y}%`);
  };

  const img = images[index];
  const open = startIndex !== null && !!img;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose(index)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/90 transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Dialog.Popup
          onKeyDown={onKeyDown}
          className="fixed inset-0 z-50 flex flex-col outline-none transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0"
        >
          <Dialog.Title className="sr-only">{t('lightbox', { name: productName })}</Dialog.Title>
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm tabular-nums" aria-live="polite">
              {tGallery('counter', { n: index + 1, total: count })}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-pressed={zoomed}
                aria-label={zoomed ? t('zoomOut') : t('zoomIn')}
                className="hidden size-10 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white md:flex"
              >
                {zoomed ? <ZoomOut size={20} aria-hidden="true" /> : <ZoomIn size={20} aria-hidden="true" />}
              </button>
              <Dialog.Close
                aria-label={t('close')}
                className="flex size-10 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
              >
                <X size={22} aria-hidden="true" />
              </Dialog.Close>
            </div>
          </div>

          {img && (
            <div className="relative flex-1 overflow-hidden">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                onPointerMove={onPointerMove}
                aria-label={zoomed ? t('zoomOut') : t('zoomIn')}
                className={cn(
                  'absolute inset-0 block h-full w-full outline-none',
                  zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in',
                )}
              >
                <Image
                  key={img.id}
                  src={img.url}
                  alt={altFor(img, index)}
                  fill
                  sizes="100vw"
                  quality={90}
                  className="select-none object-contain transition-transform duration-200 ease-out"
                  style={{ transform: zoomed ? 'scale(2.5)' : 'none', transformOrigin: origin }}
                  draggable={false}
                />
              </button>

              {count > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    aria-label={tGallery('previous')}
                    className="absolute start-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <ChevronLeft size={20} className="rtl:rotate-180" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    aria-label={tGallery('next')}
                    className="absolute end-3 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-charcoal shadow hover:bg-white focus-visible:outline-2 focus-visible:outline-white"
                  >
                    <ChevronRight size={20} className="rtl:rotate-180" aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          )}

          {count > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3" role="tablist" aria-label={tGallery('thumbnails')}>
              {images.map((thumb, i) => (
                <button
                  key={thumb.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={tGallery('showImage', { n: i + 1 })}
                  onClick={() => {
                    setZoomed(false);
                    setIndex(i);
                  }}
                  className={cn(
                    'relative size-14 shrink-0 overflow-hidden rounded-md border-2 transition-opacity',
                    i === index ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100',
                  )}
                >
                  <Image src={thumb.url} alt="" fill sizes="56px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
