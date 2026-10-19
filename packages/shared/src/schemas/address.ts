import { z } from 'zod';
import { clearableText, phoneSchema, requiredText } from './common';

/** Field lengths shared by saved addresses and the checkout's courier address. */
export const ADDRESS_LIMITS = {
  recipientName: 100,
  city: 100,
  street: 150,
  number: 20,
  /** Apartment, floor, entrance… (Israeli addresses often need all three). */
  apartment: 60,
  zip: 20,
} as const;

/** Max saved addresses per account (the server's MAX_ADDRESSES_PER_USER). */
export const MAX_ADDRESSES = 20;

/**
 * Account address book entry (POST /addresses; PATCH takes `.partial()`).
 * Same rules as the courier part of the checkout, so a saved address is always orderable.
 * Blank apartment/zip become `null` (cleared).
 */
export const addressSchema = z.object({
  recipientName: requiredText(ADDRESS_LIMITS.recipientName),
  phone: phoneSchema,
  city: requiredText(ADDRESS_LIMITS.city),
  street: requiredText(ADDRESS_LIMITS.street),
  number: requiredText(ADDRESS_LIMITS.number),
  apartment: clearableText(ADDRESS_LIMITS.apartment),
  zip: clearableText(ADDRESS_LIMITS.zip),
  isDefault: z.boolean().optional(),
});
export type AddressFormInput = z.input<typeof addressSchema>;
export type AddressPayload = z.output<typeof addressSchema>;

export const addressUpdateSchema = addressSchema.partial();
export type AddressUpdatePayload = z.output<typeof addressUpdateSchema>;

/** A saved address as returned by GET /addresses. */
export const addressResponseSchema = z.object({
  id: z.string(),
  recipientName: z.string(),
  phone: z.string(),
  city: z.string(),
  street: z.string(),
  number: z.string(),
  apartment: z.string().nullable(),
  zip: z.string().nullable(),
  isDefault: z.boolean(),
});
export type SavedAddress = z.infer<typeof addressResponseSchema>;
