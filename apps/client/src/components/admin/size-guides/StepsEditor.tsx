'use client';

import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { emptyStep, moveItem, removeItem, replaceItem, type StepDraft } from '@/hooks/admin/size-guide-editor';
import { ListControls } from './ListControls';

/** Numbered how-to-measure steps (title + explanation in both languages). */
export function StepsEditor({ steps, onChange }: { steps: StepDraft[]; onChange: (steps: StepDraft[]) => void }) {
  const t = useTranslations('admin.sizeGuides');
  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const id = `step-${step.key}`;
        const label = t('stepN', { n: i + 1 });
        return (
          <fieldset key={step.key} className="rounded-lg border border-border bg-background p-4">
            <div className="mb-3 flex items-center justify-between">
              <legend className="text-sm font-semibold">{label}</legend>
              <ListControls
                index={i}
                total={steps.length}
                label={label}
                onMove={(d) => onChange(moveItem(steps, step.key, d))}
                onRemove={() => onChange(removeItem(steps, step.key))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-titleHe`}>{t('stepTitleHe')}</Label>
                <Input id={`${id}-titleHe`} dir="rtl" value={step.titleHe} onChange={(e) => onChange(replaceItem(steps, step.key, { titleHe: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-titleEn`}>{t('stepTitleEn')}</Label>
                <Input id={`${id}-titleEn`} dir="ltr" value={step.titleEn} onChange={(e) => onChange(replaceItem(steps, step.key, { titleEn: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-bodyHe`}>{t('stepBodyHe')}</Label>
                <Textarea id={`${id}-bodyHe`} dir="rtl" rows={2} value={step.bodyHe} onChange={(e) => onChange(replaceItem(steps, step.key, { bodyHe: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-bodyEn`}>{t('stepBodyEn')}</Label>
                <Textarea id={`${id}-bodyEn`} dir="ltr" rows={2} value={step.bodyEn} onChange={(e) => onChange(replaceItem(steps, step.key, { bodyEn: e.target.value }))} />
              </div>
            </div>
          </fieldset>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...steps, emptyStep()])} className="gap-1">
        <Plus size={13} /> {t('addStep')}
      </Button>
    </div>
  );
}
