'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { FieldErrors } from './product-form-errors';
import { ImageCard } from './product-form/ImageCard';

/**
 * One gallery image in the form. Persisted images have an `id`; images
 * picked in this session carry the `file` and a blob preview `url` until saved.
 */
export type ImageItem = {
  key: string;
  id?: string;
  file?: File;
  url: string;
  color: string;
  altTextHe: string;
  altTextEn: string;
  /** Persisted image whose color/alt text changed since load. */
  dirty?: boolean;
};

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES = 20;

type Props = {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
  onRemove: (image: ImageItem) => void;
  /** Variant colors offered as image color tags. */
  colors: string[];
  errors: FieldErrors;
  disabled?: boolean;
};

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function ProductImagesManager({ images, onChange, onRemove, colors, errors, disabled }: Props) {
  const t = useTranslations('admin.productForm');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [rejected, setRejected] = useState<{ key: string; message: string }[]>([]);
  const colorSet = useMemo(() => new Set(colors), [colors]);

  const addFiles = (files: File[]) => {
    const problems: string[] = [];
    const accepted: ImageItem[] = [];
    for (const file of files) {
      if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        problems.push(t('imageTypeInvalid', { name: file.name }));
      } else if (file.size > MAX_IMAGE_BYTES) {
        problems.push(t('imageTooLarge', { name: file.name }));
      } else if (images.length + accepted.length >= MAX_IMAGES) {
        problems.push(t('imageLimit', { max: MAX_IMAGES }));
        break;
      } else {
        accepted.push({
          key: crypto.randomUUID(),
          file,
          url: URL.createObjectURL(file),
          color: '',
          altTextHe: '',
          altTextEn: '',
        });
      }
    }
    setRejected(problems.map((message) => ({ key: crypto.randomUUID(), message })));
    if (accepted.length) onChange([...images, ...accepted]);
  };

  const update = (index: number, patch: Partial<ImageItem>) => {
    onChange(images.map((img, i) => (i === index ? { ...img, ...patch, dirty: !!img.id || img.dirty } : img)));
  };

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    onChange(move(images, from, to));
  };

  const isFileDrag = (e: React.DragEvent) => !draggingKey && e.dataTransfer.types.includes('Files');

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border-2 border-dashed border-transparent p-1 transition-colors',
        fileDragOver && 'border-ocean-500 bg-ocean-50/50',
      )}
      onDragOver={(e) => {
        if (!isFileDrag(e) || disabled) return;
        e.preventDefault();
        setFileDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setFileDragOver(false);
      }}
      onDrop={(e) => {
        if (!isFileDrag(e) || disabled) return;
        e.preventDefault();
        setFileDragOver(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {images.length > 0 && (
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('images')}>
          {images.map((img, i) => (
            <li
              key={img.key}
              draggable={!disabled}
              onDragStart={(e) => {
                setDraggingKey(img.key);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', img.key);
              }}
              onDragOver={(e) => {
                if (!draggingKey) return;
                e.preventDefault();
                const from = images.findIndex((x) => x.key === draggingKey);
                if (from !== -1 && from !== i) reorder(from, i);
              }}
              onDragEnd={() => setDraggingKey(null)}
              onDrop={(e) => {
                if (draggingKey) e.preventDefault();
                setDraggingKey(null);
              }}
              className={cn(
                'space-y-2 rounded-lg border border-border bg-background p-2 transition-opacity',
                draggingKey === img.key && 'opacity-40',
              )}
              data-testid="image-item"
            >
              <ImageCard
                img={img}
                index={i}
                count={images.length}
                colorOptions={img.color && !colorSet.has(img.color) ? [...colors, img.color] : colors}
                errorFor={(field) => errors[`images.${i}.${field}`]}
                disabled={disabled}
                onReorder={reorder}
                onUpdate={(patch) => update(i, patch)}
                onRemove={onRemove}
              />
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center">
        <ImagePlus size={22} className="text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t('dropImagesHint')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || images.length >= MAX_IMAGES}
        >
          {t('chooseImages')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          multiple
          className="hidden"
          aria-label={t('chooseImages')}
          data-testid="image-file-input"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
        <p className="text-xs text-muted-foreground">{t('imageRules', { max: MAX_IMAGES })}</p>
      </div>

      {(rejected.length > 0 || errors.images) && (
        <ul className="space-y-1 text-xs text-destructive">
          {errors.images && <li>{errors.images}</li>}
          {rejected.map((problem) => (
            <li key={problem.key}>{problem.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
