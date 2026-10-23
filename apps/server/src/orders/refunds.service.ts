import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, OrderStatus, RefundStatus } from '../generated/prisma';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payment/payment.interface';
import { shopConflict } from '../common/error-codes';
import { OrderMailer } from './order-mailer';
import { recordStatusEvent } from './status-events';

/** Order fields the admin refund queue shows next to each refund. */
const ORDER_SUMMARY = {
  id: true,
  orderNumber: true,
  status: true,
  customerEmail: true,
  recipientName: true,
  phone: true,
  total: true,
  paymentRef: true,
  paymentMethod: true,
  cardBrand: true,
  cardLast4: true,
  paidAt: true,
  cancelledAt: true,
} as const;

/**
 * Refunds are settled by the payment provider, never by us. A cancelled paid
 * order gets a PENDING Refund row in the cancel transaction. The provider is
 * asked once (the mock succeeds); when it cannot or does not, the row stays
 * PENDING ("Refund Pending") until an Admin has refunded in the provider's
 * dashboard and confirms it here, which moves the order CANCELLED -> REFUNDED
 * (stock was already returned at cancel time and is never restocked again).
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: OrderMailer,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Inside the cancel transaction, so the order can never be cancelled without its refund record. */
  createPending(tx: Prisma.TransactionClient, orderId: string, amount: Prisma.Decimal) {
    return tx.refund.create({ data: { orderId, amount, status: RefundStatus.PENDING } });
  }

  /**
   * A charge succeeded after the order had already left PENDING_PAYMENT:
   * return the money now, and leave a PENDING Refund (with the transaction id
   * for the admin) if the provider cannot.
   */
  async refundLateCharge(orderId: string, amount: Prisma.Decimal, transactionId: string) {
    const refund = await this.prisma.refund.create({
      data: { orderId, amount, status: RefundStatus.PENDING, note: `Late charge, provider transaction ${transactionId}` },
    });
    try {
      const result = await this.provider.refund(transactionId, Number(amount));
      if (result.success) {
        await this.complete(refund.id, { providerRef: result.transactionId }, null, { notify: false });
        return;
      }
      this.logger.error(`provider refused late-charge refund for order ${orderId}: ${result.error ?? 'unknown'}`);
    } catch (err) {
      this.logger.error(`late-charge refund failed for order ${orderId}: ${(err as Error)?.message}`);
    }
  }

  async pendingCount(): Promise<number> {
    return this.prisma.refund.count({ where: { status: RefundStatus.PENDING } });
  }

  async list(params: { status?: RefundStatus; page: number; limit: number }) {
    const where: Prisma.RefundWhereInput = params.status ? { status: params.status } : {};
    const [refunds, total, pendingCount] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        include: { order: { select: ORDER_SUMMARY } },
        // The queue is worked oldest first.
        orderBy: { requestedAt: params.status === RefundStatus.PENDING ? 'asc' : 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.refund.count({ where }),
      this.pendingCount(),
    ]);
    return { refunds, total, pendingCount, page: params.page, limit: params.limit, totalPages: Math.ceil(total / params.limit) };
  }

  /**
   * Asks the provider to return the money. Never throws: on any failure the
   * refund simply stays PENDING with the reason in `note`.
   */
  async tryAutoRefund(refundId: string) {
    const refund = await this.prisma.refund.findUniqueOrThrow({ where: { id: refundId }, include: { order: true } });
    if (refund.status !== RefundStatus.PENDING) return refund;
    if (!refund.order.paymentRef) {
      return this.prisma.refund.update({
        where: { id: refundId },
        data: { note: 'No provider payment reference: refund it in the provider dashboard.' },
      });
    }
    try {
      const result = await this.provider.refund(refund.order.paymentRef, Number(refund.amount));
      if (result.success) {
        return await this.complete(refundId, { providerRef: result.transactionId, note: null }, null, { notify: false });
      }
      this.logger.error(`provider refused refund for order ${refund.orderId}: ${result.error ?? 'unknown'}`);
      return this.prisma.refund.update({
        where: { id: refundId },
        data: { note: `Provider refund failed: ${result.error ?? 'unknown'}`.slice(0, 500) },
      });
    } catch (err) {
      this.logger.error(`provider refund error for order ${refund.orderId}: ${(err as Error)?.message}`);
      return this.prisma.refund.update({
        where: { id: refundId },
        data: { note: `Provider refund error: ${(err as Error)?.message ?? 'unknown'}`.slice(0, 500) },
      });
    }
  }

  /**
   * Marks a refund COMPLETED and moves the order CANCELLED -> REFUNDED, in one
   * transaction. The conditional claim means two admins (or an admin and the
   * provider path) cannot complete the same refund twice. `completedByEmail`
   * is null for the automatic provider refund.
   */
  async complete(
    refundId: string,
    input: { providerRef?: string | null; note?: string | null },
    completedByEmail: string | null,
    opts: { notify?: boolean } = {},
  ) {
    const refund = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refund.updateMany({
        where: { id: refundId, status: { in: [RefundStatus.PENDING, RefundStatus.FAILED] } },
        data: {
          status: RefundStatus.COMPLETED,
          completedAt: new Date(),
          completedByEmail,
          ...(input.providerRef !== undefined ? { providerRef: input.providerRef } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
        },
      });
      if (claimed.count === 0) {
        const existing = await tx.refund.findUnique({ where: { id: refundId }, select: { id: true } });
        if (!existing) throw new NotFoundException('Refund not found');
        throw shopConflict('REFUND_NOT_PENDING', 'This refund was already settled');
      }
      const done = await tx.refund.findUniqueOrThrow({ where: { id: refundId } });
      const flipped = await tx.order.updateMany({
        where: { id: done.orderId, status: OrderStatus.CANCELLED },
        data: { status: OrderStatus.REFUNDED },
      });
      if (flipped.count === 1) {
        await recordStatusEvent(tx, done.orderId, OrderStatus.CANCELLED, OrderStatus.REFUNDED, completedByEmail);
      }
      return done;
    });
    if (opts.notify !== false) void this.mailer.refundCompleted(refund.id);
    return refund;
  }

  /** The admin could not refund it (card closed, dispute...): keeps the record, order stays CANCELLED. */
  async markFailed(refundId: string, note: string | null | undefined) {
    const claimed = await this.prisma.refund.updateMany({
      where: { id: refundId, status: RefundStatus.PENDING },
      data: { status: RefundStatus.FAILED, ...(note ? { note } : {}) },
    });
    if (claimed.count === 0) {
      const existing = await this.prisma.refund.findUnique({ where: { id: refundId }, select: { id: true } });
      if (!existing) throw new NotFoundException('Refund not found');
      throw shopConflict('REFUND_NOT_PENDING', 'Only a pending refund can be marked as failed');
    }
    return this.prisma.refund.findUniqueOrThrow({ where: { id: refundId } });
  }
}
