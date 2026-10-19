'use client';

import { useTranslations } from 'next-intl';
import { Truck } from 'lucide-react';
import type { Address } from '@/lib/addresses';
import type { FieldIssues } from '@/lib/form-errors';
import type { CheckoutFields } from '@/hooks/storefront/checkoutFormState';
import { CheckoutField } from './CheckoutField';
import { SavedAddressSelect } from './SavedAddressSelect';
import { checkoutSectionClass, sectionTitleClass } from './styles';

/** Courier delivery: saved-address picker, the address fields and "save to my addresses". */
export function ShippingAddressSection({
  fields,
  issues,
  locked,
  savedAddresses,
  matchedAddressId,
  offerSave,
  save,
  onEdit,
  onChooseSaved,
  onSaveChange,
}: {
  fields: CheckoutFields;
  issues: FieldIssues;
  locked: boolean;
  savedAddresses: Address[];
  matchedAddressId: string | null;
  /** Signed in and the address isn't in the address book yet. */
  offerSave: boolean;
  save: boolean;
  onEdit: (field: keyof CheckoutFields, value: string) => void;
  onChooseSaved: (id: string) => void;
  onSaveChange: (save: boolean) => void;
}) {
  const t = useTranslations('checkout');
  const tDelivery = useTranslations('delivery');
  return (
    <section className={`${checkoutSectionClass} space-y-4`}>
      <h2 className={sectionTitleClass}>
        <Truck size={16} /> {t('shippingAddress')}
      </h2>
      {savedAddresses.length > 0 && (
        <SavedAddressSelect
          addresses={savedAddresses}
          selectedId={matchedAddressId}
          disabled={locked}
          onChoose={onChooseSaved}
        />
      )}
      <div className="grid grid-cols-2 gap-4">
        <CheckoutField
          field="shippingCity"
          label={t('city')}
          issues={issues}
          type="text"
          autoComplete="address-level2"
          maxLength={100}
          value={fields.city}
          onValueChange={(value) => onEdit('city', value)}
          required
        />
        <CheckoutField
          field="shippingStreet"
          label={t('street')}
          issues={issues}
          type="text"
          autoComplete="address-line1"
          maxLength={150}
          value={fields.street}
          onValueChange={(value) => onEdit('street', value)}
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <CheckoutField
          field="shippingNumber"
          label={t('number')}
          issues={issues}
          type="text"
          maxLength={20}
          value={fields.number}
          onValueChange={(value) => onEdit('number', value)}
          required
        />
        <CheckoutField
          field="shippingApartment"
          label={tDelivery('apartmentFloor')}
          issues={issues}
          type="text"
          maxLength={60}
          placeholder={tDelivery('apartmentPlaceholder')}
          value={fields.apartment}
          onValueChange={(value) => onEdit('apartment', value)}
        />
        <CheckoutField
          field="shippingZip"
          label={t('zip')}
          issues={issues}
          type="text"
          autoComplete="postal-code"
          maxLength={20}
          value={fields.zip}
          onValueChange={(value) => onEdit('zip', value)}
        />
      </div>
      {offerSave && !locked && (
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => onSaveChange(e.target.checked)}
            className="accent-ocean-700"
          />
          {t('saveAddress')}
        </label>
      )}
    </section>
  );
}
