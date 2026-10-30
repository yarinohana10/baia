'use client';

import { useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  addColumn,
  addRow,
  removeColumn,
  removeRow,
  renameColumn,
  setCell,
  updateRow,
  type TableDraft,
} from '@/hooks/admin/size-guide-editor';
import { ListControls } from './ListControls';

type Props = {
  table: TableDraft;
  index: number;
  total: number;
  onChange: (table: TableDraft) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

const cellInput = 'h-9 min-w-0 px-2 text-center text-sm';

/**
 * One size table: bilingual title and note, then a grid with the sizes across
 * the top (editable, add / remove) and a row per measurement.
 */
export function TableEditor({ table, index, total, onChange, onMove, onRemove }: Props) {
  const t = useTranslations('admin.sizeGuides');
  const id = `table-${table.key}`;
  const label = t('tableN', { n: index + 1 });

  return (
    <fieldset className="rounded-lg border border-border bg-background p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <legend className="text-sm font-semibold">{label}</legend>
        <ListControls index={index} total={total} label={label} onMove={onMove} onRemove={onRemove} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-titleHe`}>{t('tableTitleHe')}</Label>
          <Input id={`${id}-titleHe`} dir="rtl" value={table.titleHe} onChange={(e) => onChange({ ...table, titleHe: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-titleEn`}>{t('tableTitleEn')}</Label>
          <Input id={`${id}-titleEn`} dir="ltr" value={table.titleEn} onChange={(e) => onChange({ ...table, titleEn: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-noteHe`}>{t('tableNoteHe')}</Label>
          <Input id={`${id}-noteHe`} dir="rtl" value={table.noteHe} onChange={(e) => onChange({ ...table, noteHe: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-noteEn`}>{t('tableNoteEn')}</Label>
          <Input id={`${id}-noteEn`} dir="ltr" value={table.noteEn} onChange={(e) => onChange({ ...table, noteEn: e.target.value })} />
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="w-36 px-2 py-2 text-start text-xs font-medium text-muted-foreground">
                {t('rowLabelHe')}
              </th>
              <th scope="col" className="w-36 px-2 py-2 text-start text-xs font-medium text-muted-foreground">
                {t('rowLabelEn')}
              </th>
              {table.columns.map((size, c) => (
                <th key={c} scope="col" className="px-1 py-2">
                  <div className="flex w-24 items-center gap-0.5">
                    <Input
                      dir="ltr"
                      value={size}
                      aria-label={t('sizeN', { n: c + 1 })}
                      onChange={(e) => onChange(renameColumn(table, c, e.target.value))}
                      className={`${cellInput} font-semibold`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      disabled={table.columns.length <= 1}
                      onClick={() => onChange(removeColumn(table, c))}
                      aria-label={t('removeSize', { size: size || c + 1 })}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                </th>
              ))}
              <th scope="col" className="px-2 py-2">
                <Button type="button" variant="outline" size="sm" onClick={() => onChange(addColumn(table))} className="gap-1 whitespace-nowrap">
                  <Plus size={13} /> {t('addSize')}
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-2 py-1.5">
                  <Input
                    dir="rtl"
                    value={row.labelHe}
                    aria-label={t('rowLabelHe')}
                    placeholder={t('rowPlaceholderHe')}
                    onChange={(e) => onChange(updateRow(table, row.key, { labelHe: e.target.value }))}
                    className="h-9"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    dir="ltr"
                    value={row.labelEn}
                    aria-label={t('rowLabelEn')}
                    placeholder={t('rowPlaceholderEn')}
                    onChange={(e) => onChange(updateRow(table, row.key, { labelEn: e.target.value }))}
                    className="h-9"
                  />
                </td>
                {table.columns.map((size, c) => (
                  <td key={c} className="px-1 py-1.5">
                    <Input
                      dir="ltr"
                      value={row.values[c] ?? ''}
                      aria-label={t('cellLabel', { row: row.labelEn || row.labelHe || '–', size: size || c + 1 })}
                      onChange={(e) => onChange(setCell(table, row.key, c, e.target.value))}
                      className={`${cellInput} w-24`}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={table.rows.length <= 1}
                    onClick={() => onChange(removeRow(table, row.key))}
                    aria-label={t('removeRow', { row: row.labelEn || row.labelHe || '–' })}
                    className="text-destructive"
                  >
                    <X size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onChange(addRow(table))} className="gap-1">
          <Plus size={13} /> {t('addRow')}
        </Button>
        <p className="text-xs text-muted-foreground">{t('tableHint')}</p>
      </div>
    </fieldset>
  );
}
