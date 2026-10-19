import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { shopBadRequest } from '../common/error-codes';
import type { Prisma } from '../generated/prisma';
import type { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

export const MAX_ADDRESSES_PER_USER = 20;

const PUBLIC_FIELDS = {
  id: true,
  recipientName: true,
  phone: true,
  city: true,
  street: true,
  number: true,
  apartment: true,
  zip: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

/**
 * The signed-in user's address book. Every query is scoped by the session
 * user's id; another user's address id behaves exactly like a missing one
 * (404), so ids cannot be probed. Keeps at most one default per user, and
 * the first saved address becomes the default.
 */
@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      select: PUBLIC_FIELDS,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId }, select: PUBLIC_FIELDS });
    if (!address) throw new NotFoundException('Address not found');
    return address;
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES_PER_USER) {
        throw shopBadRequest('ADDRESS_LIMIT_REACHED', `You can save up to ${MAX_ADDRESSES_PER_USER} addresses`, {
          max: MAX_ADDRESSES_PER_USER,
        });
      }
      const isDefault = count === 0 || dto.isDefault === true;
      if (isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return tx.address.create({
        data: {
          userId,
          recipientName: dto.recipientName,
          phone: dto.phone,
          city: dto.city,
          street: dto.street,
          number: dto.number,
          apartment: dto.apartment ?? null,
          zip: dto.zip ?? null,
          isDefault,
        },
        select: PUBLIC_FIELDS,
      });
    });
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException('Address not found');

      // Un-defaulting is done by making another address the default, never
      // directly, so a user with addresses always has exactly one default.
      const makeDefault = dto.isDefault === true && !existing.isDefault;
      if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });

      return tx.address.update({
        where: { id: existing.id },
        data: {
          recipientName: dto.recipientName,
          phone: dto.phone,
          city: dto.city,
          street: dto.street,
          number: dto.number,
          apartment: dto.apartment,
          zip: dto.zip,
          ...(makeDefault ? { isDefault: true } : {}),
        },
        select: PUBLIC_FIELDS,
      });
    });
  }

  setDefault(userId: string, id: string) {
    return this.update(userId, id, { isDefault: true });
  }

  /** Deleting the default promotes the most recently saved remaining address. */
  async remove(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) throw new NotFoundException('Address not found');
      await tx.address.delete({ where: { id: existing.id } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }
}
