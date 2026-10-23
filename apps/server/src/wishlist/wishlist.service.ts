import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Server-side wishlist for logged-in users. Every query is scoped by the
 * session user's id (never a client-provided user id). Guests keep their
 * wishlist in localStorage and merge it here after signing in.
 */
@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async getWishlist(userId: string) {
    return this.prisma.wishlist.findMany({
      where: { userId, product: { isActive: true } },
      include: {
        product: {
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
            variants: { where: { isActive: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addToWishlist(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, isActive: true } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
      include: { product: true },
    });
  }

  /** Idempotent; only ever touches the caller's own rows. */
  async removeFromWishlist(userId: string, productId: string) {
    await this.prisma.wishlist.deleteMany({ where: { userId, productId } });
    return { removed: true };
  }

  async isInWishlist(userId: string, productId: string) {
    const item = await this.prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return { inWishlist: !!item };
  }

  /** Merge a guest's local wishlist (product ids) into the user's list. */
  async merge(userId: string, productIds: string[]) {
    const unique = [...new Set(productIds)];
    if (unique.length > 0) {
      const valid = await this.prisma.product.findMany({
        where: { id: { in: unique }, isActive: true },
        select: { id: true },
      });
      if (valid.length > 0) {
        await this.prisma.wishlist.createMany({
          data: valid.map((p) => ({ userId, productId: p.id })),
          skipDuplicates: true,
        });
      }
    }
    return this.getWishlist(userId);
  }
}
