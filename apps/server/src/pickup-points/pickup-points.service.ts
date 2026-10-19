import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma';
import type { CreatePickupPointDto, UpdatePickupPointDto } from './dto/pickup-point.dto';

const ORDER: Prisma.PickupPointOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { city: 'asc' }, { name: 'asc' }];

/**
 * Pickup points shoppers can choose at checkout. Orders keep a snapshot of
 * the point (name + address), so editing or deleting one never changes past
 * orders.
 */
@Injectable()
export class PickupPointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active points for the storefront, optionally filtered by city (or name/address) text. */
  listActive(search?: string) {
    const term = search?.trim();
    return this.prisma.pickupPoint.findMany({
      where: {
        isActive: true,
        ...(term
          ? {
              OR: [
                { city: { contains: term, mode: 'insensitive' } },
                { name: { contains: term, mode: 'insensitive' } },
                { address: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: { id: true, name: true, city: true, address: true, hours: true },
      orderBy: ORDER,
    });
  }

  listAll() {
    return this.prisma.pickupPoint.findMany({ orderBy: ORDER });
  }

  create(data: CreatePickupPointDto) {
    return this.prisma.pickupPoint.create({ data });
  }

  async update(id: string, data: UpdatePickupPointDto) {
    await this.assertExists(id);
    return this.prisma.pickupPoint.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.pickupPoint.delete({ where: { id } });
    return { success: true };
  }

  private async assertExists(id: string) {
    const found = await this.prisma.pickupPoint.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException('Pickup point not found');
  }
}
