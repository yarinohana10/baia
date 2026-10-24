'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { streetLine, type Address } from '@/lib/addresses';
import { checkoutInputClass } from './styles';

/** "Ship to": one of the saved addresses, or a new one. */
export function SavedAddressSelect({
  addresses,
  selectedId,
  disabled,
  onChoose,
}: {
  addresses: Address[];
  /** The saved address the form matches, if any. */
  selectedId: string | null;
  disabled: boolean;
  /** An address id, or `"new"`. */
  onChoose: (id: string) => void;
}) {
  const t = useTranslations('checkout');
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label htmlFor="checkout-saved-address" className="block text-xs font-medium text-gray-500">
          {t('shipTo')}
        </label>
        <Link href="/account/addresses" className="text-xs text-black hover:underline">
          {t('manageAddresses')}
        </Link>
      </div>
      <select
        id="checkout-saved-address"
        value={selectedId ?? 'new'}
        onChange={(e) => onChoose(e.target.value)}
        disabled={disabled}
        className={`${checkoutInputClass} bg-white`}
      >
        {addresses.map((address) => (
          <option key={address.id} value={address.id}>
            {address.recipientName} · {streetLine(address)}, {address.city}
            {address.isDefault ? ` ${t('defaultAddressTag')}` : ''}
          </option>
        ))}
        <option value="new">{t('newAddressOption')}</option>
      </select>
    </div>
  );
}
