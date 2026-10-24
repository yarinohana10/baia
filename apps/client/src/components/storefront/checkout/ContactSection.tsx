'use client';

import { useTranslations } from 'next-intl';
import { CreditCard } from 'lucide-react';
import { PHONE_PATTERN } from '@/lib/addresses';
import type { FieldIssues } from '@/lib/form-errors';
import type { CheckoutFields } from '@/hooks/storefront/checkoutFormState';
import { CheckoutField } from './CheckoutField';
import { checkoutSectionClass, sectionTitleClass } from './styles';

/** Full name, email (locked once the order exists) and phone. */
export function ContactSection({
  fields,
  issues,
  locked,
  onEdit,
  onCheck,
}: {
  fields: CheckoutFields;
  issues: FieldIssues;
  locked: boolean;
  onEdit: (field: keyof CheckoutFields, value: string) => void;
  /** Field lost focus: validate it. */
  onCheck: (field: keyof CheckoutFields) => void;
}) {
  const t = useTranslations('checkout');
  return (
    <section className={`${checkoutSectionClass} space-y-4`}>
      <h2 className={sectionTitleClass}>
        <CreditCard size={16} /> {t('contact')}
      </h2>
      <CheckoutField
        field="recipientName"
        label={t('fullName')}
        issues={issues}
        type="text"
        autoComplete="name"
        maxLength={100}
        value={fields.recipientName}
        onValueChange={(value) => onEdit('recipientName', value)}
        onBlur={() => onCheck('recipientName')}
        required
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CheckoutField
          field="customerEmail"
          label={t('email')}
          issues={issues}
          type="email"
          autoComplete="email"
          dir="ltr"
          maxLength={254}
          value={fields.email}
          onValueChange={(value) => onEdit('email', value)}
          onBlur={() => onCheck('email')}
          aria-describedby="checkout-email-hint"
          disabled={locked}
          required
        />
        <CheckoutField
          field="phone"
          label={t('phone')}
          issues={issues}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          pattern={PHONE_PATTERN}
          title={t('phoneHint')}
          value={fields.phone}
          onValueChange={(value) => onEdit('phone', value)}
          onBlur={() => onCheck('phone')}
          required
        />
      </div>
      <p id="checkout-email-hint" className="text-xs text-gray-500">
        {t('emailHint')}
      </p>
    </section>
  );
}
