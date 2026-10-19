'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Category } from './types';

type Props = {
  category: Category;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  depth?: number;
};

/** A category with edit / delete, followed by its (collapsible) subcategories. */
export function CategoryRow({ category, onEdit, onDelete, depth = 0 }: Props) {
  const t = useTranslations('admin.categories');
  const locale = useLocale();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <>
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border hover:bg-muted rounded-lg"
        style={{ paddingInlineStart: `${16 + depth * 24}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? t('collapse') : t('expand')}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </Button>
          ) : (
            <span className="w-5" />
          )}
          {category.image ? (
            <Image src={category.image} alt="" width={28} height={28} className="size-7 rounded object-cover" />
          ) : (
            <span className="size-7 rounded bg-muted" aria-hidden="true" />
          )}
          <span className="text-sm font-medium text-foreground">{locale === 'he' ? category.nameHe : category.nameEn}</span>
          <span className="text-xs text-muted-foreground">({locale === 'he' ? category.nameEn : category.nameHe})</span>
          <span className="text-xs text-muted-foreground/60">/{category.slug}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(category)}
            className="text-muted-foreground hover:text-ocean-600"
            aria-label={t('editAction')}
          >
            <Pencil size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(category.id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label={t('deleteAction')}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {expanded &&
        hasChildren &&
        category.children.map((child) => (
          <CategoryRow key={child.id} category={{ ...child, children: [] }} onEdit={onEdit} onDelete={onDelete} depth={depth + 1} />
        ))}
    </>
  );
}
