import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma';
import { shopBadRequest, shopNotFound } from '../common/error-codes';
import { fieldConflictException, fieldValidationException } from '../common/validation';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';
import { parseCouponExpiry } from './expiry';

/** Maps a unique-code violation to a 409 the admin page can show next to the code field. */
function duplicateCode(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    throw fieldConflictException([
      { field: 'code', code: 'unique', message: 'A coupon with this code already exists' },
    ]);
  }
  throw err;
}

function decimalOrNull(value: number | null | undefined) {
  return value === null || value === undefined ? null : new Prisma.Decimal(value);
}

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

    if (!coupon) throw shopNotFound('COUPON_INVALID', 'Invalid coupon code');
    if (!coupon.isActive) throw shopBadRequest('COUPON_INACTIVE', 'Coupon is no longer active');
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw shopBadRequest('COUPON_EXPIRED', 'Coupon has expired');
    }
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      throw shopBadRequest('COUPON_LIMIT_REACHED', 'Coupon usage limit reached');
    }
    if (coupon.minCartValue && cartTotal < Number(coupon.minCartValue)) {
      throw shopBadRequest('COUPON_MIN_TOTAL', `Minimum cart value of ₪${coupon.minCartValue} required`, {
        minCartValue: Number(coupon.minCartValue),
      });
    }

    const discount =
      coupon.discountType === 'PERCENTAGE'
        ? (cartTotal * Number(coupon.value)) / 100
        : Number(coupon.value);

    return { coupon, discount: Math.min(discount, cartTotal) };
  }

  async create(data: CreateCouponDto) {
    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        value: new Prisma.Decimal(data.value),
        minCartValue: decimalOrNull(data.minCartValue),
        maxUses: data.maxUses ?? null,
        expiresAt: parseCouponExpiry(data.expiresAt),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    }).catch(duplicateCode);
  }

  async update(id: string, data: UpdateCouponDto) {
    const existing = await this.findById(id);
    const updateData: Prisma.CouponUpdateInput = {};

    // Re-check the value range against the type that will be stored.
    if (data.value !== undefined || data.discountType !== undefined) {
      const type = data.discountType ?? existing.discountType;
      const value = data.value ?? Number(existing.value);
      if (type === 'PERCENTAGE' && (value < 1 || value > 100)) {
        throw fieldValidationException([
          { field: 'value', code: 'couponValue', message: 'value must be 1–100 for PERCENTAGE coupons' },
        ]);
      }
    }

    if (data.code !== undefined) updateData.code = data.code.toUpperCase();
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.value !== undefined) updateData.value = new Prisma.Decimal(data.value);
    if (data.minCartValue !== undefined) updateData.minCartValue = decimalOrNull(data.minCartValue);
    if (data.maxUses !== undefined) updateData.maxUses = data.maxUses;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.expiresAt !== undefined) updateData.expiresAt = parseCouponExpiry(data.expiresAt);

    return this.prisma.coupon.update({
      where: { id },
      data: updateData,
    }).catch(duplicateCode);
  }

  /**
   * Coupons referenced by orders cannot be removed (the orders keep their
   * history), so they are deactivated instead.
   * Returns `{ deleted: true }` or `{ deleted: false, deactivated: true }`.
   */
  async delete(id: string) {
    const coupon = await this.findById(id);
    if (coupon._count.orders > 0) {
      await this.prisma.coupon.update({ where: { id }, data: { isActive: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.coupon.delete({ where: { id } });
    return { deleted: true };
  }
}
