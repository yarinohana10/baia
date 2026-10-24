'use client';

import { useId, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { ADDRESS_LIMITS, addressSchema } from '@baia/shared';
import { EMPTY_ADDRESS, PHONE_PATTERN, type AddressInput } from '@/lib/addresses';
import { clearIssue, firstInvalidField, invalidProps, validateForm, type FieldIssues } from '@/lib/form-errors';
import { FieldError } from '@/components/forms/FieldError';
import { RequiredMark } from '@/components/forms/RequiredMark';
import { accountInputClass, accountLabelClass, primaryButtonClass, secondaryButtonClass } from './styles';

type Props = {
  initial?: AddressInput;
  /** Show the "use as default" checkbox (hidden when editing the current default). */
  showDefaultToggle?: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (input: AddressInput & { isDefault?: boolean }) => void;
  onCancel: () => void;
};

const FIELD_ORDER = ['recipientName', 'phone', 'city', 'street', 'number', 'apartment', 'zip'] as const;

/** Add/edit form for a saved shipping address. Field rules come from the shared `addressSchema`. */
export function AddressForm({ initial, showDefaultToggle, submitting, error, onSubmit, onCancel }: Props) {
  const t = useTranslations('addresses');
  const tCheckout = useTranslations('checkout');
  const id = useId();
  const [values, setValues] = useState<AddressInput>(initial ?? EMPTY_ADDRESS);
  const [isDefault, setIsDefault] = useState(false);
  const [issues, setIssues] = useState<FieldIssues>({});

  const field = (name: keyof AddressInput) => ({
    id: `${id}-${name}`,
    value: values[name],
    onChange: (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [name]: e.target.value }));
      setIssues((v) => clearIssue(v, name));
    },
    ...invalidProps(issues, name, `${id}-${name}-error`),
    className: accountInputClass,
  });
  const fieldError = (name: keyof AddressInput) => <FieldError id={`${id}-${name}-error`} issue={issues[name]} />;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const check = validateForm(addressSchema, values);
    setIssues(check.errors);
    if (!check.success) {
      const first = firstInvalidField(check.errors, FIELD_ORDER);
      if (first) document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    onSubmit({ ...values, isDefault: showDefaultToggle && isDefault ? true : undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${id}-recipientName`} className={accountLabelClass}>{t('recipientName')}<RequiredMark /></label>
          <input {...field('recipientName')} type="text" autoComplete="name" maxLength={100} required />
          {fieldError('recipientName')}
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={accountLabelClass}>{tCheckout('phone')}<RequiredMark /></label>
          <input
            {...field('phone')}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            pattern={PHONE_PATTERN}
            title={tCheckout('phoneHint')}
            required
          />
          {fieldError('phone')}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor={`${id}-city`} className={accountLabelClass}>{tCheckout('city')}<RequiredMark /></label>
          <input {...field('city')} type="text" autoComplete="address-level2" maxLength={100} required />
          {fieldError('city')}
        </div>
        <div>
          <label htmlFor={`${id}-street`} className={accountLabelClass}>{tCheckout('street')}<RequiredMark /></label>
          <input {...field('street')} type="text" autoComplete="address-line1" maxLength={150} required />
          {fieldError('street')}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor={`${id}-number`} className={accountLabelClass}>{tCheckout('number')}<RequiredMark /></label>
          <input {...field('number')} type="text" maxLength={20} required />
          {fieldError('number')}
        </div>
        <div>
          <label htmlFor={`${id}-apartment`} className={accountLabelClass}>{tCheckout('apartment')}</label>
          <input {...field('apartment')} type="text" maxLength={ADDRESS_LIMITS.apartment} />
          {fieldError('apartment')}
        </div>
        <div>
          <label htmlFor={`${id}-zip`} className={accountLabelClass}>{tCheckout('zip')}</label>
          <input {...field('zip')} type="text" autoComplete="postal-code" maxLength={20} />
          {fieldError('zip')}
        </div>
      </div>

      {showDefaultToggle && (
        <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="accent-black"
          />
          {t('makeDefault')}
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting} aria-busy={submitting} className={primaryButtonClass}>
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? t('saving') : t('save')}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className={secondaryButtonClass}>
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}
