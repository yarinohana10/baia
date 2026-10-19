'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, GripVertical, Star, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ImageItem } from '../ProductImagesManager';

type Props = {
  img: ImageItem;
  /** Position in the gallery (0 = cover). */
  index: number;
  count: number;
  colorOptions: string[];
  errorFor: (field: string) => string | undefined;
  disabled?: boolean;
  onReorder: (from: number, to: number) => void;
  onUpdate: (patch: Partial<ImageItem>) => void;
  onRemove: (img: ImageItem) => void;
};

/** Preview, reorder / cover / delete buttons and the color and alt-text fields of one gallery image. */
export function ImageCard({ img, index: i, count, colorOptions, errorFor, disabled, onReorder, onUpdate, onRemove }: Props) {
  const t = useTranslations('admin.productForm');
  return (
    <>
      <div className="relative">
        {/* Unoptimized: new images are blob previews, which the image optimizer can't fetch. */}
        <Image
          src={img.url}
          alt={img.altTextEn || img.altTextHe || t('imageNumber', { n: i + 1 })}
          width={400}
          height={400}
          unoptimized
          className="aspect-square h-auto w-full rounded-md bg-muted object-cover"
        />
        <span className="absolute start-1.5 top-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[11px] font-medium">
          <GripVertical size={12} className="cursor-grab text-muted-foreground" aria-hidden />
          {i + 1}
        </span>
        {i === 0 && (
          <span className="absolute end-1.5 top-1.5 flex items-center gap-1 rounded bg-ocean-700 px-1.5 py-0.5 text-[11px] font-medium text-white">
            <Star size={11} aria-hidden /> {t('coverImage')}
          </span>
        )}
        {img.file && (
          <span className="absolute bottom-1.5 start-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">
            {t('notUploadedYet')}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onReorder(i, i - 1)}
            disabled={disabled || i === 0}
            aria-label={t('moveEarlier')}
            title={t('moveEarlier')}
          >
            <ArrowLeft size={14} className="rtl:rotate-180" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => onReorder(i, i + 1)}
            disabled={disabled || i === count - 1}
            aria-label={t('moveLater')}
            title={t('moveLater')}
          >
            <ArrowRight size={14} className="rtl:rotate-180" />
          </Button>
          {i > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onReorder(i, 0)}
              disabled={disabled}
              className="text-xs text-ocean-700"
            >
              {t('makeCover')}
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => onRemove(img)}
          disabled={disabled}
          aria-label={t('deleteImage')}
          title={t('deleteImage')}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={14} />
        </Button>
      </div>

      <div>
        <Label htmlFor={`${img.key}-color`} className="mb-0.5 text-xs text-muted-foreground">
          {t('imageColor')}
        </Label>
        <select
          id={`${img.key}-color`}
          value={img.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          disabled={disabled}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">{t('allColors')}</option>
          {colorOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor={`${img.key}-alt-he`} className="mb-0.5 text-xs text-muted-foreground">
          {t('altTextHe')}
        </Label>
        <Input
          id={`${img.key}-alt-he`}
          dir="rtl"
          value={img.altTextHe}
          maxLength={300}
          onChange={(e) => onUpdate({ altTextHe: e.target.value })}
          disabled={disabled}
          aria-invalid={!!errorFor('altTextHe')}
        />
        {errorFor('altTextHe') && <p className="mt-1 text-xs text-destructive">{errorFor('altTextHe')}</p>}
      </div>
      <div>
        <Label htmlFor={`${img.key}-alt-en`} className="mb-0.5 text-xs text-muted-foreground">
          {t('altTextEn')}
        </Label>
        <Input
          id={`${img.key}-alt-en`}
          dir="ltr"
          value={img.altTextEn}
          maxLength={300}
          onChange={(e) => onUpdate({ altTextEn: e.target.value })}
          disabled={disabled}
          aria-invalid={!!errorFor('altTextEn')}
        />
        {errorFor('altTextEn') && <p className="mt-1 text-xs text-destructive">{errorFor('altTextEn')}</p>}
      </div>
    </>
  );
}
