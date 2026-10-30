'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ImagePlus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  savedImage: string | null;
  hasPendingFile: boolean;
  previewUrl: string | null;
  onPick: (file: File | null) => void;
  onRemoveSaved: () => void;
};

/** How-to-measure illustration: preview plus choose / replace, cancel and remove. Uploaded on save. */
export function ImageField({ savedImage, hasPendingFile, previewUrl, onPick, onRemoveSaved }: Props) {
  const t = useTranslations('admin.sizeGuides');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shown = previewUrl || savedImage;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative flex aspect-[2/3] w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {shown ? (
          <Image src={shown} alt="" fill sizes="144px" unoptimized={!!previewUrl} className="object-contain" />
        ) : (
          <span className="px-3 text-center text-xs text-muted-foreground">{t('noImage')}</span>
        )}
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="sr-only"
            id="size-guide-image"
            aria-label={t('chooseImage')}
            onChange={(e) => {
              onPick(e.target.files?.[0] ?? null);
              e.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
            <ImagePlus size={14} /> {savedImage || hasPendingFile ? t('replaceImage') : t('chooseImage')}
          </Button>
          {hasPendingFile ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onPick(null)} className="gap-1.5">
              <X size={14} /> {t('cancelImage')}
            </Button>
          ) : (
            savedImage && (
              <Button type="button" variant="ghost" size="sm" onClick={onRemoveSaved} className="gap-1.5 text-destructive">
                <Trash2 size={14} /> {t('removeImage')}
              </Button>
            )
          )}
        </div>
        <p className="max-w-sm text-xs text-muted-foreground">{hasPendingFile ? t('imagePending') : t('imageHint')}</p>
      </div>
    </div>
  );
}
