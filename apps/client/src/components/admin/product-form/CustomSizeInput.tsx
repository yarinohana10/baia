'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Adds a size outside the size set. `onAdd` returns false when the size can't be added (already there). */
export function CustomSizeInput({ onAdd }: { onAdd: (size: string) => boolean }) {
  const t = useTranslations('admin.productForm');
  const ts = useTranslations('admin.productForm.stock');
  const [value, setValue] = useState('');

  const add = () => {
    const size = value.trim();
    if (size && onAdd(size)) setValue('');
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label={ts('addCustomSize')}
        value={value}
        maxLength={20}
        dir="ltr"
        placeholder={t('customSizePlaceholder')}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          add();
        }}
        className="h-8 max-w-48"
      />
      <Button type="button" variant="outline" size="sm" onClick={add} disabled={!value.trim()}>
        <Plus size={14} /> {ts('addCustomSize')}
      </Button>
    </div>
  );
}
