'use client';

import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emptyTip, moveItem, removeItem, replaceItem, type TipDraft } from '@/hooks/admin/size-guide-editor';
import { ListControls } from './ListControls';

/** Short fit tips, one line each in both languages. */
export function TipsEditor({ tips, onChange }: { tips: TipDraft[]; onChange: (tips: TipDraft[]) => void }) {
  const t = useTranslations('admin.sizeGuides');
  return (
    <div className="space-y-3">
      {tips.map((tip, i) => {
        const label = t('tipN', { n: i + 1 });
        return (
          <div key={tip.key} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center">
            <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
            <Input dir="rtl" aria-label={t('tipHe', { n: i + 1 })} placeholder={t('tipHePlaceholder')} value={tip.he} onChange={(e) => onChange(replaceItem(tips, tip.key, { he: e.target.value }))} />
            <Input dir="ltr" aria-label={t('tipEn', { n: i + 1 })} placeholder={t('tipEnPlaceholder')} value={tip.en} onChange={(e) => onChange(replaceItem(tips, tip.key, { en: e.target.value }))} />
            <ListControls
              index={i}
              total={tips.length}
              label={label}
              onMove={(d) => onChange(moveItem(tips, tip.key, d))}
              onRemove={() => onChange(removeItem(tips, tip.key))}
            />
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...tips, emptyTip()])} className="gap-1">
        <Plus size={13} /> {t('addTip')}
      </Button>
    </div>
  );
}
