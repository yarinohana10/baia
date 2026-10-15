'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldErrors } from './product-form-errors';

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
  const [rejected, setRejected] = useState<string[]>([]);

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
    setRejected(problems);
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
          {images.map((img, i) => {
            const errorFor = (field: string) => errors[`images.${i}.${field}`];
            const colorOptions = img.color && !colors.includes(img.color) ? [...colors, img.color] : colors;
            return (
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
                <div className="relative">
                  {/* Blob previews aren't supported by next/image, so a plain img is used here */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.altTextEn || img.altTextHe || t('imageNumber', { n: i + 1 })}
                    className="aspect-square w-full rounded-md bg-muted object-cover"
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
                      onClick={() => reorder(i, i - 1)}
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
                      onClick={() => reorder(i, i + 1)}
                      disabled={disabled || i === images.length - 1}
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
                        onClick={() => reorder(i, 0)}
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
                    onChange={(e) => update(i, { color: e.target.value })}
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
                    onChange={(e) => update(i, { altTextHe: e.target.value })}
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
                    onChange={(e) => update(i, { altTextEn: e.target.value })}
                    disabled={disabled}
                    aria-invalid={!!errorFor('altTextEn')}
                  />
                  {errorFor('altTextEn') && <p className="mt-1 text-xs text-destructive">{errorFor('altTextEn')}</p>}
                </div>
              </li>
            );
          })}
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
          {rejected.map((msg, i) => (
            <li key={i}>{msg}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
