import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async getWishlist(userId: string) {
    return this.prisma.wishlist.findMany({
      where: { userId },
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
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.wishlist.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
      include: { product: true },
    });
  }

  async removeFromWishlist(userId: string, productId: string) {
    await this.prisma.wishlist.delete({
      where: { userId_productId: { userId, productId } },
    });
    return { removed: true };
  }

  async isInWishlist(userId: string, productId: string) {
    const item = await this.prisma.wishlist.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    return { inWishlist: !!item };
  }
}
