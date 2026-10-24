'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, MapPin, Truck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { Product } from '@/lib/catalog/types';

/** Display-ready delivery/returns values (see `businessInfo()` in lib/site.ts). */
export type ShippingSummary = {
  courierCost: string;
  pickupCost: string;
  courierEtaDays: string;
  pickupEtaDays: string;
  freeShippingThreshold: string;
};

function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group border-b border-black/10" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[12px] font-medium uppercase ltr:tracking-[0.08em] text-black outline-none focus-visible:ring-2 focus-visible:ring-black [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-5 text-[13px] leading-relaxed text-black/65">{children}</div>
    </details>
  );
}

const text = (value: string | null | undefined) => value?.trim() || null;

/** Accordions: description, fabric & care, size & fit, shipping & returns. */
export function ProductInfoSections({
  product,
  shipping,
  sizeGuide,
}: {
  product: Product;
  shipping: ShippingSummary;
  sizeGuide: ReactNode;
}) {
  const isHe = useLocale() === 'he';
  const t = useTranslations('pdp');
  const pick = (he?: string | null, en?: string | null) => (isHe ? text(he) : text(en) ?? text(he));

  // English falls back to Hebrew copy only for fabric (composition is usually language-neutral numbers).
  const description = isHe ? text(product.descriptionHe) : text(product.descriptionEn);
  const fabric = pick(product.fabricHe, product.fabricEn);
  const care = isHe ? text(product.careHe) : text(product.careEn);
  const fit = isHe ? text(product.fitHe) : text(product.fitEn);

  return (
    <div className="border-t border-black/10">
      {description && (
        <Section title={t('sections.description')} defaultOpen>
          <p className="whitespace-pre-line">{description}</p>
        </Section>
      )}

      <Section title={t('sections.fabricCare')}>
        <dl className="space-y-4">
          {fabric && (
            <div>
              <dt className="mb-1 font-medium text-black">{t('sections.fabric')}</dt>
              <dd className="whitespace-pre-line">{fabric}</dd>
            </div>
          )}
          <div>
            <dt className="mb-1 font-medium text-black">{t('sections.care')}</dt>
            <dd className="whitespace-pre-line">{care ?? t('careGeneric')}</dd>
          </div>
        </dl>
      </Section>

      <Section title={t('sections.sizeFit')}>
        <p className="mb-3 whitespace-pre-line">{fit ?? t('fitGeneric')}</p>
        {sizeGuide}
      </Section>

      <Section title={t('sections.shippingReturns')}>
        <ul className="mb-4 space-y-2.5">
          <li className="flex items-start gap-2.5">
            <Truck size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-black" />
            <span>
              <strong className="font-medium text-black">{t('shipping.courier')}</strong> – {shipping.courierCost} ·{' '}
              {t('shipping.eta', { days: shipping.courierEtaDays })}
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <MapPin size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-black" />
            <span>
              <strong className="font-medium text-black">{t('shipping.pickup')}</strong> – {shipping.pickupCost} ·{' '}
              {t('shipping.eta', { days: shipping.pickupEtaDays })}
            </span>
          </li>
        </ul>
        <ul className="mb-4 list-disc space-y-1.5 ps-5 marker:text-gray-300">
          <li>{t('shipping.freeOver', { threshold: shipping.freeShippingThreshold })}</li>
          <li>{t('shipping.cancel')}</li>
          <li>{t('shipping.returns')}</li>
          <li>{t('shipping.hygiene')}</li>
        </ul>
        <p className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/shipping" className="text-black underline underline-offset-4 hover:text-black">
            {t('shipping.shippingLink')}
          </Link>
          <Link href="/returns" className="text-black underline underline-offset-4 hover:text-black">
            {t('shipping.returnsLink')}
          </Link>
          <Link href="/terms" className="text-black underline underline-offset-4 hover:text-black">
            {t('shipping.termsLink')}
          </Link>
        </p>
      </Section>
    </div>
  );
}
