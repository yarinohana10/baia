'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  /** The saved image, if any. */
  savedImage: string | null | undefined;
  /** A newly picked file waiting to be uploaded on save. */
  hasPendingFile: boolean;
  previewUrl: string | null;
  onPick: (file: File | null) => void;
  onRemoveSaved: () => void;
};

/** Thumbnail plus choose / replace, cancel and remove buttons for a category image. */
export function CategoryImageField({ savedImage, hasPendingFile, previewUrl, onPick, onRemoveSaved }: Props) {
  const t = useTranslations('admin.categories');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shownImage = previewUrl || savedImage;

  return (
    <div className="space-y-1.5 md:col-span-2">
      <span className="text-sm font-medium" id="category-image-label">
        {t('image')}
      </span>
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
          {shownImage && (
            <Image src={shownImage} alt="" fill sizes="80px" unoptimized={!!previewUrl} className="object-cover" />
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              className="sr-only"
              id="category-image"
              aria-labelledby="category-image-label"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <ImagePlus size={14} /> {savedImage || hasPendingFile ? t('replaceImage') : t('chooseImage')}
            </Button>
            {hasPendingFile ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onPick(null)} className="gap-1.5">
                <X size={14} /> {t('cancel')}
              </Button>
            ) : (
              savedImage && (
                <Button type="button" variant="ghost" size="sm" onClick={onRemoveSaved} className="gap-1.5 text-destructive">
                  <Trash2 size={14} /> {t('removeImage')}
                </Button>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground">{hasPendingFile ? t('imagePending') : t('imageHint')}</p>
        </div>
      </div>
    </div>
  );
}
