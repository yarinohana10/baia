import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async findByCode(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return coupon;
  }

  async validate(code: string, cartTotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) throw new NotFoundException('Invalid coupon code');
    if (!coupon.isActive) throw new BadRequestException('Coupon is no longer active');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      throw new BadRequestException('Coupon usage limit reached');
    }
    if (coupon.minCartValue && cartTotal < Number(coupon.minCartValue)) {
      throw new BadRequestException(
        `Minimum cart value of ₪${coupon.minCartValue} required`,
      );
    }

    const discount =
      coupon.discountType === 'PERCENTAGE'
        ? (cartTotal * Number(coupon.value)) / 100
        : Number(coupon.value);

    return { coupon, discount: Math.min(discount, cartTotal) };
  }

  async create(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    value: number;
    minCartValue?: number;
    maxUses?: number;
    expiresAt?: string;
  }) {
    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        value: new Prisma.Decimal(data.value),
        minCartValue: data.minCartValue ? new Prisma.Decimal(data.minCartValue) : null,
        maxUses: data.maxUses || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
  }

  async update(
    id: string,
    data: Partial<{
      code: string;
      discountType: 'PERCENTAGE' | 'FIXED';
      value: number;
      minCartValue: number | null;
      maxUses: number | null;
      isActive: boolean;
      expiresAt: string | null;
    }>,
  ) {
    await this.findById(id);
    const updateData: any = {};

    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.value !== undefined) updateData.value = new Prisma.Decimal(data.value);
    if (data.minCartValue !== undefined) {
      updateData.minCartValue = data.minCartValue ? new Prisma.Decimal(data.minCartValue) : null;
    }
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
    }

    return this.prisma.coupon.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }
}
