import { Prisma } from '../generated/prisma';

type PricedVariant = {
  priceOverride: Prisma.Decimal | null;
  salePrice: Prisma.Decimal | null;
  saleStart: Date | null;
  saleEnd: Date | null;
  product: { basePrice: Prisma.Decimal };
};

/** Current unit price of a variant: active sale price, else override, else the product base price. */
export function variantUnitPriceDecimal(variant: PricedVariant, now = new Date()): Prisma.Decimal {
  let unitPrice = new Prisma.Decimal((variant.priceOverride || variant.product.basePrice).toString());
  if (variant.salePrice) {
    const start = variant.saleStart ? new Date(variant.saleStart) : null;
    const end = variant.saleEnd ? new Date(variant.saleEnd) : null;
    if ((!start || now >= start) && (!end || now <= end)) unitPrice = new Prisma.Decimal(variant.salePrice.toString());
  }
  return unitPrice;
}

export function variantUnitPrice(variant: PricedVariant, now = new Date()): number {
  return variantUnitPriceDecimal(variant, now).toNumber();
}
