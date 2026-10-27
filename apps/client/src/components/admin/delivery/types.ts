export type DeliverySettings = {
  shippingCost: string;
  pickupPointCost: string;
  freeShippingThreshold: string;
  courierEtaDays: string;
  pickupEtaDays: string;
};

export type PickupPoint = {
  id: string;
  name: string;
  city: string;
  address: string;
  hours: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type PointDraft = { name: string; city: string; address: string; hours: string; sortOrder: string; isActive: boolean };

/** Which pickup point form is open: an existing point's id, 'new', or none. */
export type PointEditing = string | 'new' | null;

type SiteConfigDelivery = Partial<{
  shippingCost: string | number;
  pickupPointCost: string | number;
  freeShippingThreshold: string | number;
  courierEtaDays: string;
  pickupEtaDays: string;
}>;

/** Form strings from the site config, with the store defaults for unset values. */
export function settingsFromConfig(d: SiteConfigDelivery): DeliverySettings {
  return {
    shippingCost: String(Number(d.shippingCost ?? 29.9)),
    pickupPointCost: String(Number(d.pickupPointCost ?? 19.9)),
    freeShippingThreshold: String(Number(d.freeShippingThreshold ?? 450)),
    courierEtaDays: d.courierEtaDays ?? '3-5',
    pickupEtaDays: d.pickupEtaDays ?? '2-4',
  };
}

/** Prices are kept to agorot: extra decimals are rounded, as before, rather than rejected. */
export const roundAmount = (v: string) => {
  const n = Number(v);
  return v.trim() === '' || !Number.isFinite(n) ? v : Math.round(n * 100) / 100;
};

/** Settings as the shared schema validates them (money fields rounded). */
export function settingsForValidation(s: DeliverySettings) {
  return {
    ...s,
    shippingCost: roundAmount(s.shippingCost),
    pickupPointCost: roundAmount(s.pickupPointCost),
    freeShippingThreshold: roundAmount(s.freeShippingThreshold),
  };
}

export function pointDraft(point: PickupPoint | null, pointCount: number): PointDraft {
  if (!point) return { name: '', city: '', address: '', hours: '', sortOrder: String((pointCount + 1) * 10), isActive: true };
  return {
    name: point.name,
    city: point.city,
    address: point.address,
    hours: point.hours ?? '',
    sortOrder: String(point.sortOrder),
    isActive: point.isActive,
  };
}
