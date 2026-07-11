import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateCart(userId?: string, sessionId?: string) {
    if (userId) {
      let cart = await this.prisma.cart.findFirst({
        where: { userId },
        include: this.cartInclude,
      });
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { userId },
          include: this.cartInclude,
        });
      }
      return cart;
    }
    if (sessionId) {
      let cart = await this.prisma.cart.findUnique({
        where: { sessionId },
        include: this.cartInclude,
      });
      if (!cart) {
        cart = await this.prisma.cart.create({
          data: { sessionId },
          include: this.cartInclude,
        });
      }
      return cart;
    }
    throw new BadRequestException('userId or sessionId required');
  }

  private cartInclude = {
    items: {
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
  };

  async getCart(userId?: string, sessionId?: string) {
    return this.getOrCreateCart(userId, sessionId);
  }

  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    variantId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    if (!variant.isActive) throw new BadRequestException('Variant is not available');
    if (variant.stockQuantity < quantity) {
      throw new BadRequestException('Insufficient stock');
    }

    const existing = cart.items.find((item) => item.variantId === variantId);
    if (existing) {
      const newQty = existing.quantity + quantity;
      if (newQty > variant.stockQuantity) {
        throw new BadRequestException('Insufficient stock');
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

    return this.getOrCreateCart(userId, sessionId);
  }

  async updateItemQuantity(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
    quantity: number,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    if (quantity <= 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.variantId },
      });
      if (variant && quantity > variant.stockQuantity) {
        throw new BadRequestException('Insufficient stock');
      }
      await this.prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity },
      });
    }

    return this.getOrCreateCart(userId, sessionId);
  }

  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    itemId: string,
  ) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    const item = cart.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Cart item not found');

    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.getOrCreateCart(userId, sessionId);
  }

  async clearCart(userId?: string, sessionId?: string) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.getOrCreateCart(userId, sessionId);
  }

  async mergeGuestCart(sessionId: string, userId: string) {
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionId },
      include: { items: true },
    });
    if (!guestCart || guestCart.items.length === 0) return;

    const userCart = await this.getOrCreateCart(userId);

    for (const guestItem of guestCart.items) {
      const existing = userCart.items.find(
        (i) => i.variantId === guestItem.variantId,
      );
      if (existing) {
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + guestItem.quantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: userCart.id,
            variantId: guestItem.variantId,
            quantity: guestItem.quantity,
          },
        });
      }
    }

    await this.prisma.cart.delete({ where: { id: guestCart.id } });
  }
}
