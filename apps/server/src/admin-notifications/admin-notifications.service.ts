import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CancellationStatus, ContactMessageStatus, OrderStatus } from '../generated/prisma';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AdminNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async counts(now = new Date()) {
    const [pendingCancellations, newContactMessages, newOrders, ordersToFulfil] = await Promise.all([
      this.prisma.cancellationRequest.count({ where: { status: CancellationStatus.REQUESTED } }),
      this.prisma.contactMessage.count({ where: { status: ContactMessageStatus.NEW } }),
      // Paid in the last 24 hours and not picked up yet (still CONFIRMED).
      this.prisma.order.count({
        where: { status: OrderStatus.CONFIRMED, paidAt: { gte: new Date(now.getTime() - DAY_MS) } },
      }),
      // Everything paid that still has to leave the warehouse.
      this.prisma.order.count({ where: { status: { in: [OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } } }),
    ]);
    return { pendingCancellations, newContactMessages, newOrders, ordersToFulfil };
  }
}
