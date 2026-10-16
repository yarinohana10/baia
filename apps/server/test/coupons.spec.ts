import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma } from '../src/generated/prisma';
import { CouponsService } from '../src/coupons/coupons.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from '../src/coupons/dto/coupon.dto';
import { endOfStoreDay, parseCouponExpiry } from '../src/coupons/expiry';
import { PrismaService } from '../src/prisma/prisma.service';

const errorsFor = async <T extends object>(cls: new () => T, body: unknown) => {
  const errors = await validate(plainToInstance(cls, body) as object, { whitelist: true });
  return errors.map((e) => e.property).sort();
};

describe('coupon expiry (Asia/Jerusalem)', () => {
  it('ends at 23:59:59.999 Israel time in summer (UTC+3)', () => {
    expect(endOfStoreDay('2026-08-31').toISOString()).toBe('2026-08-31T20:59:59.999Z');
  });

  it('ends at 23:59:59.999 Israel time in winter (UTC+2)', () => {
    expect(endOfStoreDay('2026-01-15').toISOString()).toBe('2026-01-15T21:59:59.999Z');
  });

  it('handles the DST switch days', () => {
    // Israel moves to summer time on Friday 2026-03-27 and back on Sunday 2026-10-25.
    expect(endOfStoreDay('2026-03-27').toISOString()).toBe('2026-03-27T20:59:59.999Z');
    expect(endOfStoreDay('2026-10-25').toISOString()).toBe('2026-10-25T21:59:59.999Z');
  });

  it('keeps full timestamps and null as-is', () => {
    expect(parseCouponExpiry('2026-05-01T10:00:00.000Z')!.toISOString()).toBe('2026-05-01T10:00:00.000Z');
    expect(parseCouponExpiry(null)).toBeNull();
    expect(parseCouponExpiry('')).toBeNull();
  });
});

describe('coupon DTOs', () => {
  it('requires a code and a numeric cart total to validate', async () => {
    expect(await errorsFor(ValidateCouponDto, {})).toEqual(['cartTotal', 'code']);
    expect(await errorsFor(ValidateCouponDto, { code: 'SUMMER', cartTotal: 100 })).toEqual([]);
  });

  it('checks the code format and value range per type', async () => {
    const base = { code: 'summer_25', discountType: 'PERCENTAGE', value: 25 };
    expect(await errorsFor(CreateCouponDto, base)).toEqual([]);
    expect(plainToInstance(CreateCouponDto, base).code).toBe('SUMMER_25');
    expect(await errorsFor(CreateCouponDto, { ...base, code: 'ab' })).toEqual(['code']);
    expect(await errorsFor(CreateCouponDto, { ...base, code: 'NO SPACES' })).toEqual(['code']);
    expect(await errorsFor(CreateCouponDto, { ...base, value: 0 })).toEqual(['value']);
    expect(await errorsFor(CreateCouponDto, { ...base, value: 101 })).toEqual(['value']);
    expect(await errorsFor(CreateCouponDto, { ...base, discountType: 'FIXED', value: 150 })).toEqual([]);
    expect(await errorsFor(CreateCouponDto, { ...base, discountType: 'FIXED', value: 0 })).toEqual(['value']);
    expect(await errorsFor(CreateCouponDto, { ...base, discountType: 'BOGUS' })).toEqual(['discountType']);
  });

  it('accepts null for the optional limits and rejects bad values', async () => {
    const base = { code: 'SALE10', discountType: 'FIXED', value: 10 };
    expect(await errorsFor(CreateCouponDto, { ...base, minCartValue: null, maxUses: null, expiresAt: null })).toEqual([]);
    expect(await errorsFor(CreateCouponDto, { ...base, minCartValue: -1 })).toEqual(['minCartValue']);
    expect(await errorsFor(CreateCouponDto, { ...base, maxUses: 0 })).toEqual(['maxUses']);
    expect(await errorsFor(CreateCouponDto, { ...base, maxUses: 1.5 })).toEqual(['maxUses']);
    expect(await errorsFor(CreateCouponDto, { ...base, expiresAt: 'tomorrow' })).toEqual(['expiresAt']);
    expect(await errorsFor(UpdateCouponDto, { minCartValue: null, maxUses: null, expiresAt: null })).toEqual([]);
  });
});

describe('CouponsService', () => {
  const coupon = {
    id: 'c1',
    code: 'SUMMER',
    discountType: 'PERCENTAGE',
    value: new Prisma.Decimal(10),
    _count: { orders: 0 },
  };
  let prisma: {
    coupon: Record<'findUnique' | 'create' | 'update' | 'delete', jest.Mock>;
  };
  let service: CouponsService;

  beforeEach(() => {
    prisma = {
      coupon: {
        findUnique: jest.fn().mockResolvedValue(coupon),
        create: jest.fn().mockResolvedValue(coupon),
        update: jest.fn().mockResolvedValue(coupon),
        delete: jest.fn().mockResolvedValue(coupon),
      },
    };
    service = new CouponsService(prisma as unknown as PrismaService);
  });

  it('clears minCartValue / maxUses / expiresAt when null is sent', async () => {
    await service.update('c1', { minCartValue: null, maxUses: null, expiresAt: null });
    expect(prisma.coupon.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { minCartValue: null, maxUses: null, expiresAt: null },
    });
  });

  it('stores a date-only expiry as the end of that day in Israel', async () => {
    await service.create({ code: 'SUMMER', discountType: 'FIXED', value: 20, expiresAt: '2026-08-31' });
    expect(prisma.coupon.create.mock.calls[0][0].data.expiresAt.toISOString()).toBe('2026-08-31T20:59:59.999Z');
  });

  it('rechecks a percentage value against the stored type on partial updates', async () => {
    await expect(service.update('c1', { value: 150 })).rejects.toMatchObject({ status: 400 });
    expect(prisma.coupon.update).not.toHaveBeenCalled();
  });

  it('maps a duplicate code to 409', async () => {
    prisma.coupon.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );
    await expect(
      service.create({ code: 'SUMMER', discountType: 'FIXED', value: 20 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('deletes an unused coupon', async () => {
    expect(await service.delete('c1')).toEqual({ deleted: true });
    expect(prisma.coupon.delete).toHaveBeenCalled();
  });

  it('deactivates a coupon that orders already used instead of deleting it', async () => {
    prisma.coupon.findUnique.mockResolvedValue({ ...coupon, _count: { orders: 4 } });
    expect(await service.delete('c1')).toEqual({ deleted: false, deactivated: true });
    expect(prisma.coupon.delete).not.toHaveBeenCalled();
    expect(prisma.coupon.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { isActive: false } });
  });
});
