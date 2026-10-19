import { DeliveryMethod } from '../generated/prisma';

/** Delivery prices and ETAs from SiteConfig, with the same defaults as the schema. */
export type DeliveryConfig = {
  courierCost: number;
  pickupCost: number;
  freeThreshold: number;
  courierEtaDays: string;
  pickupEtaDays: string;
};

type SiteConfigLike = {
  shippingCost: { toString(): string } | number;
  pickupPointCost: { toString(): string } | number;
  freeShippingThreshold: { toString(): string } | number;
  courierEtaDays: string;
  pickupEtaDays: string;
} | null;

export const DEFAULT_DELIVERY: DeliveryConfig = {
  courierCost: 29.9,
  pickupCost: 19.9,
  freeThreshold: 249,
  courierEtaDays: '3-5',
  pickupEtaDays: '2-4',
};

const num = (v: { toString(): string } | number, fallback: number) => {
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
};

export function deliveryConfig(config: SiteConfigLike): DeliveryConfig {
  if (!config) return DEFAULT_DELIVERY;
  return {
    courierCost: num(config.shippingCost, DEFAULT_DELIVERY.courierCost),
    pickupCost: num(config.pickupPointCost, DEFAULT_DELIVERY.pickupCost),
    freeThreshold: num(config.freeShippingThreshold, DEFAULT_DELIVERY.freeThreshold),
    courierEtaDays: config.courierEtaDays || DEFAULT_DELIVERY.courierEtaDays,
    pickupEtaDays: config.pickupEtaDays || DEFAULT_DELIVERY.pickupEtaDays,
  };
}

/** Both methods are free once the subtotal (before coupon discounts) reaches the threshold. */
export function shippingCostFor(method: DeliveryMethod, subtotal: number, cfg: DeliveryConfig): number {
  if (subtotal >= cfg.freeThreshold) return 0;
  return method === DeliveryMethod.PICKUP_POINT ? cfg.pickupCost : cfg.courierCost;
}

export function etaFor(method: DeliveryMethod, cfg: DeliveryConfig): string {
  return method === DeliveryMethod.PICKUP_POINT ? cfg.pickupEtaDays : cfg.courierEtaDays;
}

export type DeliveryQuote = {
  subtotal: number;
  freeShippingThreshold: number;
  /** How much more to spend for free shipping (0 when already free). */
  amountToFreeShipping: number;
  options: { method: DeliveryMethod; cost: number; baseCost: number; etaDays: string }[];
};

export function deliveryQuote(subtotal: number, cfg: DeliveryConfig): DeliveryQuote {
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotal: round(subtotal),
    freeShippingThreshold: cfg.freeThreshold,
    amountToFreeShipping: round(Math.max(0, cfg.freeThreshold - subtotal)),
    options: [DeliveryMethod.COURIER, DeliveryMethod.PICKUP_POINT].map((method) => ({
      method,
      cost: shippingCostFor(method, subtotal, cfg),
      baseCost: method === DeliveryMethod.PICKUP_POINT ? cfg.pickupCost : cfg.courierCost,
      etaDays: etaFor(method, cfg),
    })),
  };
}
