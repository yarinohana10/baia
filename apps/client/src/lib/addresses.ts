import type { SavedAddress } from '@baia/shared';
import { api } from '@/lib/api';

/** A saved shipping address, as returned by GET /addresses. */
export type Address = SavedAddress;

export type AddressInput = {
  recipientName: string;
  phone: string;
  city: string;
  street: string;
  number: string;
  apartment: string;
  zip: string;
};

export const EMPTY_ADDRESS: AddressInput = {
  recipientName: '',
  phone: '',
  city: '',
  street: '',
  number: '',
  apartment: '',
  zip: '',
};

/** Phone rule for `<input pattern>` and the address book limit, shared with the API. */
export { PHONE_PATTERN, MAX_ADDRESSES } from '@baia/shared';

export function toInput(address: Address): AddressInput {
  return {
    recipientName: address.recipientName,
    phone: address.phone,
    city: address.city,
    street: address.street,
    number: address.number,
    apartment: address.apartment ?? '',
    zip: address.zip ?? '',
  };
}

/** Trimmed payload; blank optional fields are sent as '' which the API stores as null. */
export function toPayload(input: AddressInput): AddressInput {
  return {
    recipientName: input.recipientName.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    street: input.street.trim(),
    number: input.number.trim(),
    apartment: input.apartment.trim(),
    zip: input.zip.trim(),
  };
}

const norm = (value: string | null | undefined) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
const FIELDS: (keyof AddressInput)[] = ['recipientName', 'phone', 'city', 'street', 'number', 'apartment', 'zip'];

/** True when a form's values describe the saved address (ignoring case and extra spaces). */
export function sameAddress(address: Address, input: AddressInput): boolean {
  const saved = toInput(address);
  return FIELDS.every((field) => norm(saved[field]) === norm(input[field]));
}

/** "Dizengoff 1, Apt. 4" style first line; the apartment label is translated by the caller. */
export function streetLine(address: Pick<Address, 'street' | 'number'>): string {
  return `${address.street} ${address.number}`.trim();
}

export const addressesApi = {
  list: () => api.get<Address[]>('/addresses').then((res) => res.data),
  create: (input: AddressInput & { isDefault?: boolean }) =>
    api.post<Address>('/addresses', { ...toPayload(input), isDefault: input.isDefault }).then((res) => res.data),
  update: (id: string, input: AddressInput & { isDefault?: boolean }) =>
    api.patch<Address>(`/addresses/${id}`, { ...toPayload(input), isDefault: input.isDefault }).then((res) => res.data),
  setDefault: (id: string) => api.post<Address>(`/addresses/${id}/default`).then((res) => res.data),
  remove: (id: string) => api.delete(`/addresses/${id}`),
};
