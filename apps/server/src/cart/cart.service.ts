import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma';
import type { CartOwner } from './cart-identity';
import { MAX_LINE_QUANTITY } from './dto/cart.dto';
import { availableStock, hasStock } from '../common/stock';
import { shopBadRequest } from '../common/error-codes';

const cartInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: { take: 1, orderBy: { sortOrder: 'asc' as const } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

/** Public cart shape: never exposes userId or the (hashed) guest key. */
function toPublicCart(cart: CartWithItems | null) {
  if (!cart) return { id: null, items: [] as CartWithItems['items'] };
  return { id: cart.id, items: cart.items, updatedAt: cart.updatedAt };
}

export type MergeReport = {
  merged: number;
  adjusted: { variantId: string; requested: number; quantity: number }[];
  dropped: { variantId: string; reason: 'unavailable' | 'out_of_stock' }[];
};

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  private ownerWhere(owner: CartOwner): Prisma.CartWhereInput {
    return owner.userId ? { userId: owner.userId } : { sessionId: owner.guestKeyHash, userId: null };
  }

  private findCart(owner: CartOwner) {
    return this.prisma.cart.findFirst({ where: this.ownerWhere(owner), include: cartInclude });
  }

  private async getOrCreateCart(owner: CartOwner): Promise<CartWithItems> {
    const existing = await this.findCart(owner);
    if (existing) return existing;
    return this.prisma.cart.create({
      data: owner.userId ? { userId: owner.userId } : { sessionId: owner.guestKeyHash },
      include: cartInclude,
    });
  }

  /** Read-only: does not create rows for anonymous visitors. */
  async getCart(owner: CartOwner | null) {
    if (!owner) return toPublicCart(null);
    return toPublicCart(await this.findCart(owner));
  }

  private async loadPurchasableVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { isActive: true } } },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (!variant.isActive || !variant.product.isActive) {
      throw shopBadRequest('VARIANT_UNAVAILABLE', 'Variant is not available', { variantId });
    }
    return variant;
  }

  async addItem(owner: CartOwner, variantId: string, quantity: number) {
    const variant = await this.loadPurchasableVariant(variantId);
    if (!hasStock(variant, quantity)) {
      throw shopBadRequest('OUT_OF_STOCK', 'Insufficient stock', { available: Number.isFinite(availableStock(variant)) ? availableStock(variant) : null });
    }

    const cart = await this.getOrCreateCart(owner);
    const existing = cart.items.find((item) => item.variantId === variantId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (!hasStock(variant, newQty) || newQty > MAX_LINE_QUANTITY) {
        throw shopBadRequest('OUT_OF_STOCK', 'Insufficient stock', { available: Number.isFinite(availableStock(variant)) ? availableStock(variant) : null });
      }
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: newQty },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId: cart.id, variantId, quantity },
      });
    }

    return this.getCart(owner);
  }

  /** Item ids are only looked up inside the caller's own cart -> 404 otherwise. */
  private async findOwnItem(owner: CartOwner | null, itemId: string) {
    const cart = owner ? await this.findCart(owner) : null;
    const item = cart?.items.find((i) => i.id === itemId);
    if (!cart || !item) throw new NotFoundException('Cart item not found');
    return { cart, item };
  }

  async updateItemQuantity(owner: CartOwner | null, itemId: string, quantity: number) {
    const { item } = await this.findOwnItem(owner, itemId);

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      const variant = await this.loadPurchasableVariant(item.variantId);
      if (!hasStock(variant, quantity)) {
        throw shopBadRequest('OUT_OF_STOCK', 'Insufficient stock', { available: Number.isFinite(availableStock(variant)) ? availableStock(variant) : null });
      }
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: { quantity },
      });
    }

    return this.getCart(owner);
  }

  async removeItem(owner: CartOwner | null, itemId: string) {
    const { item } = await this.findOwnItem(owner, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    return this.getCart(owner);
  }

  async clearCart(owner: CartOwner) {
    const cart = await this.findCart(owner);
    if (cart) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getCart(owner);
  }

  /**
   * Merge the caller's guest cart into their user cart, atomically.
   * - drops lines whose variant/product is inactive or out of stock
   * - clamps quantities to available stock (and the per-line max)
   * - deletes the guest cart (and its items) afterwards
   */
  async mergeGuestCart(guestKeyHash: string, userId: string): Promise<MergeReport> {
    return this.prisma.$transaction(async (tx) => {
      const report: MergeReport = { merged: 0, adjusted: [], dropped: [] };

      const guestCart = await tx.cart.findFirst({
        where: { sessionId: guestKeyHash, userId: null },
        include: { items: { include: { variant: { include: { product: { select: { isActive: true } } } } } } },
      });
      if (!guestCart) return report;

      if (guestCart.items.length > 0) {
        let userCart = await tx.cart.findFirst({ where: { userId }, include: { items: true } });
        if (!userCart) {
          userCart = await tx.cart.create({ data: { userId }, include: { items: true } });
        }

        for (const guestItem of guestCart.items) {
          const { variant } = guestItem;
          if (!variant.isActive || !variant.product.isActive) {
            report.dropped.push({ variantId: variant.id, reason: 'unavailable' });
            continue;
          }
          if (!hasStock(variant, 1)) {
            report.dropped.push({ variantId: variant.id, reason: 'out_of_stock' });
            continue;
          }

          const existing = userCart.items.find((i) => i.variantId === variant.id);
          const requested = (existing?.quantity ?? 0) + guestItem.quantity;
          const quantity = Math.min(requested, availableStock(variant), MAX_LINE_QUANTITY);
          if (quantity < requested) {
            report.adjusted.push({ variantId: variant.id, requested, quantity });
          }

          await tx.cartItem.upsert({
            where: { cartId_variantId: { cartId: userCart.id, variantId: variant.id } },
            create: { cartId: userCart.id, variantId: variant.id, quantity },
            update: { quantity },
          });
          report.merged += 1;
        }
      }

      // Cascade removes guest cart items. deleteMany + count check makes a
      // concurrent duplicate merge roll back instead of double-adding.
      const deleted = await tx.cart.deleteMany({ where: { id: guestCart.id } });
      if (deleted.count !== 1) throw new ConflictException('Cart already merged');
      return report;
    });
  }
}
