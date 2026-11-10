'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Dialog } from '@base-ui/react/dialog';
import { useLocale, useTranslations } from 'next-intl';
import { Check, CheckCircle2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { revalidateCatalog } from '@/lib/catalog/revalidate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { Category } from '@/components/admin/categories/types';
import type { ServerProduct } from '@/components/admin/product-form/types';
import {
  BULK_FLAGS,
  BULK_TEXT_FIELDS,
  EMPTY_BULK_DRAFT,
  bulkChanges,
  bulkIssues,
  rejectedProducts,
  type BulkDraft,
  type BulkField as BulkFieldName,
  type BulkFlag,
  type BulkTextField,
  type BulkValueField,
  type RejectedProducts,
} from '@/hooks/admin/bulk-edit';
import { BulkField } from './BulkField';
import { YesNoSwitch } from './YesNoSwitch';

const STEPS = ['products', 'details', 'info', 'review'] as const;
type Step = (typeof STEPS)[number];

type Props = {
  /** The subcategory whose products are edited (products only live in subcategories). */
  category: Category;
  onClose: () => void;
};

/**
 * "Edit all products" of a subcategory, step by step: pick products, set the
 * shared details and product info, review, apply. Only the fields ticked are
 * written; each product keeps its own name, address, images, sizes and category.
 */
export function BulkEditProductsDialog({ category, onClose }: Props) {
  const t = useTranslations('admin.bulkEdit');
  const locale = useLocale();
  const name = (c: { nameHe: string; nameEn: string }) => (locale === 'he' ? c.nameHe : c.nameEn);

  const [products, setProducts] = useState<ServerProduct[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<Step>('products');
  const [draft, setDraft] = useState<BulkDraft>(EMPTY_BULK_DRAFT);
  const [applying, setApplying] = useState(false);
  const [rejected, setRejected] = useState<RejectedProducts[]>([]);
  const [failed, setFailed] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<ServerProduct[]>('/admin/products', { params: { categoryId: category.id } })
      .then((res) => {
        if (cancelled) return;
        const all = res.data;
        setProducts(all);
        setSelected(new Set(all.map((p) => p.id)));
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [category]);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const changes = bulkChanges(draft);
  const issues = bulkIssues(draft, selected.size);
  const stepIndex = STEPS.indexOf(step);

  const setValue = (field: BulkValueField, value: string) => setDraft((d) => ({ ...d, values: { ...d.values, [field]: value } }));
  const setEnabled = (field: BulkFieldName, on: boolean) => setDraft((d) => ({ ...d, enabled: { ...d.enabled, [field]: on } }));
  const setFlag = (flag: BulkFlag, value: boolean) => setDraft((d) => ({ ...d, flags: { ...d.flags, [flag]: value } }));
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async () => {
    if (applying || issues.length) return;
    setApplying(true);
    setRejected([]);
    setFailed(false);
    try {
      const res = await api.patch<{ updated: number }>('/admin/products/bulk', { productIds: [...selected], changes });
      setUpdated(res.data.updated);
      await revalidateCatalog();
    } catch (err) {
      const refused = rejectedProducts(err);
      setRejected(refused);
      setFailed(refused.length === 0);
    } finally {
      setApplying(false);
    }
  };

  const unselectRejected = () => {
    const ids = new Set(rejected.flatMap((r) => r.productIds));
    setSelected((s) => new Set([...s].filter((id) => !ids.has(id))));
    setRejected([]);
  };

  const textField = (field: BulkTextField, multiline = false) => {
    const rtl = field.endsWith('He');
    const props = {
      value: draft.values[field],
      dir: rtl ? 'rtl' : 'ltr',
      onChange: (e: { target: { value: string } }) => setValue(field, e.target.value),
      'aria-label': t(`fields.${field}`),
      disabled: !draft.enabled[field],
    };
    return (
      <BulkField
        key={field}
        id={`bulk-${field}`}
        label={t(`fields.${field}`)}
        enabled={!!draft.enabled[field]}
        onToggle={(on) => setEnabled(field, on)}
        hint={draft.values[field].trim() ? undefined : t('willClear')}
      >
        {multiline ? <Textarea rows={3} {...props} /> : <Input {...props} />}
      </BulkField>
    );
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Popup className="fixed inset-0 z-50 flex flex-col bg-background shadow-2xl outline-none md:m-auto md:h-[min(88dvh,820px)] md:w-[min(92vw,760px)] md:rounded-xl">
          <header className="border-b border-border px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="font-serif text-lg font-semibold">{t('title', { category: name(category) })}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">{t('subtitle')}</Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={t('close')}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </Dialog.Close>
            </div>
            {updated === null && (
              <ol className="mt-4 grid grid-cols-4 gap-2" aria-label={t('stepsLabel')}>
                {STEPS.map((s, i) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => setStep(s)}
                      aria-current={s === step ? 'step' : undefined}
                      className="flex w-full flex-col items-start gap-1.5 text-start"
                    >
                      <span className={cn('h-1 w-full rounded-full', i <= stepIndex ? 'bg-ocean-700' : 'bg-muted')} />
                      <span className={cn('text-xs', s === step ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                        {i + 1}. {t(`steps.${s}`)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {updated !== null ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center" role="status">
                <CheckCircle2 size={44} className="text-emerald-600" />
                <p className="text-lg font-semibold">{t('done', { count: updated })}</p>
                <p className="max-w-sm text-sm text-muted-foreground">{t('doneHint')}</p>
              </div>
            ) : step === 'products' ? (
              <section aria-labelledby="bulk-products-title">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 id="bulk-products-title" className="text-sm font-semibold">
                    {t('selectedCount', { count: selected.size, total: products?.length ?? 0 })}
                  </h3>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set((products ?? []).map((p) => p.id)))}>
                      {t('selectAll')}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                      {t('selectNone')}
                    </Button>
                  </div>
                </div>
                {loadFailed ? (
                  <p className="py-10 text-center text-sm text-destructive">{t('loadFailed')}</p>
                ) : products === null ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t('loading')}</p>
                ) : products.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">{t('empty')}</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {products.map((p) => {
                      const on = selected.has(p.id);
                      return (
                        <li key={p.id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                            <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="size-4 accent-ocean-700" />
                            <span className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                              {p.images[0]?.url && <Image src={p.images[0].url} alt="" fill sizes="48px" className="object-cover" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{name(p)}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {locale === 'he' ? p.nameEn : p.nameHe} · ₪{parseFloat(p.basePrice).toFixed(2)}
                              </span>
                            </span>
                            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11px]', p.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                              {p.isActive ? t('visible') : t('hidden')}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-3 text-xs text-muted-foreground">{t('ownDataNote')}</p>
              </section>
            ) : step === 'details' ? (
              <section className="space-y-3">
                {textField('descriptionHe', true)}
                {textField('descriptionEn', true)}
                <BulkField
                  id="bulk-basePrice"
                  label={t('fields.basePrice')}
                  enabled={!!draft.enabled.basePrice}
                  onToggle={(on) => setEnabled('basePrice', on)}
                  hint={t('priceHint')}
                >
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    dir="ltr"
                    value={draft.values.basePrice}
                    onChange={(e) => setValue('basePrice', e.target.value)}
                    aria-label={t('fields.basePrice')}
                    disabled={!draft.enabled.basePrice}
                    className="max-w-48"
                  />
                </BulkField>
                {BULK_FLAGS.map((flag) => (
                  <BulkField
                    key={flag}
                    id={`bulk-${flag}`}
                    label={t(`fields.${flag}`)}
                    enabled={!!draft.enabled[flag]}
                    onToggle={(on) => setEnabled(flag, on)}
                    hint={flag === 'isActive' ? t('isActiveHint') : undefined}
                  >
                    <YesNoSwitch label={t(`fields.${flag}`)} value={draft.flags[flag]} onChange={(v) => setFlag(flag, v)} disabled={!draft.enabled[flag]} />
                  </BulkField>
                ))}
              </section>
            ) : step === 'info' ? (
              <section className="space-y-3">
                <p className="text-sm text-muted-foreground">{t('infoHint')}</p>
                {BULK_TEXT_FIELDS.filter((f) => !f.startsWith('description')).map((f) => textField(f, true))}
              </section>
            ) : (
              <section aria-labelledby="bulk-review-title" className="space-y-4">
                <h3 id="bulk-review-title" className="text-sm font-semibold">
                  {t('reviewTitle', { count: selected.size })}
                </h3>
                {Object.keys(changes).length > 0 && (
                  <dl className="divide-y divide-border rounded-lg border border-border text-sm">
                    {Object.entries(changes).map(([field, value]) => (
                      <div key={field} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[180px_1fr]">
                        <dt className="font-medium">{t(`fields.${field}`)}</dt>
                        <dd className="whitespace-pre-line break-words text-muted-foreground">
                          {typeof value === 'boolean'
                            ? t(value ? 'yes' : 'no')
                            : field === 'basePrice'
                              ? `₪${Number(value).toFixed(2)}`
                              : value || <em>{t('cleared')}</em>}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="text-xs text-muted-foreground">{t('untouchedNote')}</p>
                {issues.length > 0 && (
                  <ul role="alert" className="list-disc space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-8 py-3 text-sm text-amber-900">
                    {issues.map((issue) => (
                      <li key={issue}>{t(`issues.${issue}`)}</li>
                    ))}
                  </ul>
                )}
                {rejected.length > 0 && (
                  <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                    {rejected.map((r) => (
                      <div key={r.code}>
                        <p className="font-medium text-destructive">{t(`rejected.${r.code}`)}</p>
                        <ul className="mt-1 list-disc ps-5">
                          {r.productIds.map((id) => (
                            <li key={id}>{byId.get(id) ? name(byId.get(id)!) : id}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={unselectRejected}>
                      {t('unselectRejected')}
                    </Button>
                  </div>
                )}
                {failed && <p role="alert" className="text-sm text-destructive">{t('failed')}</p>}
              </section>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            {updated !== null ? (
              <Button type="button" onClick={onClose} className="ms-auto bg-ocean-700 px-6 text-white hover:bg-ocean-800">
                {t('close')}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => (stepIndex === 0 ? onClose() : setStep(STEPS[stepIndex - 1]))}>
                  {stepIndex === 0 ? t('cancel') : t('back')}
                </Button>
                {step === 'review' ? (
                  <Button
                    type="button"
                    onClick={apply}
                    disabled={applying || issues.length > 0}
                    className="gap-1.5 bg-ocean-700 px-6 text-white hover:bg-ocean-800"
                  >
                    <Check size={15} />
                    {applying ? t('applying') : t('apply', { count: selected.size })}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setStep(STEPS[stepIndex + 1])}
                    disabled={step === 'products' && selected.size === 0}
                    className="bg-ocean-700 px-6 text-white hover:bg-ocean-800"
                  >
                    {t('next')}
                  </Button>
                )}
              </>
            )}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
