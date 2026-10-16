import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { ORDER_NOTIFIER, type OrderNotifier } from '../orders/order-notifier';
import type { OrderRequester } from '../orders/order-access';
import { PAYMENT_PROVIDER, type PaymentProvider, type PaymentResult } from './payment.interface';
import type { PaymentWebhookEvent } from './webhook/webhook-verifier';

export const PAYMENT_CURRENCY = 'ILS';
export { PAYMENT_CLAIM_TTL_MS } from './payment-claim';
import { PAYMENT_CLAIM_TTL_MS } from './payment-claim';
import { shopConflict } from '../common/error-codes';

export type ChargeResponse = {
  success: true;
  orderId: string;
  status: string;
  transactionId: string;
  alreadyPaid?: boolean;
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ORDER_NOTIFIER) private readonly notifier: OrderNotifier,
  ) {}

  /**
   * Charge an order on behalf of its owner.
   *
   * Security properties:
   *  - ownership proof required (session owner or valid guest token); admins
   *    are NOT allowed to pay for other people's orders; failures are 404.
   *  - amount/currency/email are always taken from the stored order.
   *  - at most one in-flight charge per order: a conditional claim
   *    (UPDATE ... WHERE status = PENDING_PAYMENT AND claim is free/stale)
   *    must succeed before the provider is called.
   *  - confirmation is a conditional update inside a transaction; repeated
   *    calls after success return the original result (idempotent).
   *  - every provider call is recorded as a PaymentAttempt.
   */
  async charge(orderId: string, requester: OrderRequester, ipAddress?: string): Promise<ChargeResponse> {
    await this.orders.assertAccess(orderId, requester, { allowAdmin: false });

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'PENDING_PAYMENT') {
      return this.alreadyProcessed(order);
    }

    const now = new Date();
    const claim = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PENDING_PAYMENT',
        OR: [{ paymentClaimedAt: null }, { paymentClaimedAt: { lt: new Date(now.getTime() - PAYMENT_CLAIM_TTL_MS) } }],
      },
      data: { paymentClaimedAt: now },
    });
    if (claim.count === 0) {
      const latest = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (latest && latest.status !== 'PENDING_PAYMENT') return this.alreadyProcessed(latest);
      throw new ConflictException('Payment already in progress');
    }

    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        orderId,
        provider: this.provider.name,
        amount: order.total,
        currency: PAYMENT_CURRENCY,
        ipAddress: ipAddress?.slice(0, 64),
      },
    });

    let result: PaymentResult;
    try {
      result = await this.provider.charge({
        amount: Number(order.total),
        currency: PAYMENT_CURRENCY,
        orderId,
        customerEmail: order.customerEmail,
        idempotencyKey: attempt.id,
      });
    } catch (err) {
      this.logger.error(`provider error for attempt ${attempt.id}: ${(err as Error)?.message}`);
      result = { success: false, transactionId: '', error: 'Payment provider error' };
    }

    if (!result.success) {
      await this.prisma.$transaction([
        this.prisma.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', error: (result.error ?? 'declined').slice(0, 500), providerRef: result.transactionId || null },
        }),
        this.prisma.order.updateMany({
          where: { id: orderId, status: 'PENDING_PAYMENT' },
          data: { paymentClaimedAt: null },
        }),
      ]);
      throw new HttpException({ statusCode: 402, message: 'Payment was declined', success: false }, HttpStatus.PAYMENT_REQUIRED);
    }

    const confirmed = await this.confirmPaid(orderId, attempt.id, result.transactionId);
    if (!confirmed) {
      // The order left PENDING_PAYMENT while we were charging (e.g. an admin
      // cancelled it). Money moved but the order is not payable: refund.
      this.logger.error(`order ${orderId} not pending after successful charge; refunding attempt ${attempt.id}`);
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { error: 'ORDER_NOT_PENDING_AFTER_CHARGE_REFUND_REQUESTED' },
      });
      try {
        await this.provider.refund(result.transactionId, Number(order.total));
      } catch (err) {
        this.logger.error(`refund failed for attempt ${attempt.id}: ${(err as Error)?.message}`);
      }
      throw shopConflict('ORDER_NOT_PAYABLE', 'Order is no longer awaiting payment');
    }

    await this.notifyConfirmed(orderId);
    return { success: true, orderId, status: 'CONFIRMED', transactionId: result.transactionId };
  }

  /**
   * Webhook path (real providers). Same idempotent transition as charge();
   * additionally verifies amount + currency against the stored order.
   */
  async applyWebhookEvent(event: PaymentWebhookEvent): Promise<{ applied: boolean }> {
    const order = await this.prisma.order.findUnique({ where: { id: event.orderId } });
    if (!order) return { applied: false };

    if (event.type === 'payment.failed') {
      await this.prisma.order.updateMany({
        where: { id: order.id, status: 'PENDING_PAYMENT' },
        data: { paymentClaimedAt: null },
      });
      return { applied: false };
    }

    const amountMatches = Math.round(Number(order.total) * 100) === Math.round(event.amount * 100);
    if (!amountMatches || event.currency.toUpperCase() !== PAYMENT_CURRENCY) {
      this.logger.error(`webhook ${event.eventId}: amount/currency mismatch for order ${order.id}`);
      return { applied: false };
    }

    const attempt = await this.prisma.paymentAttempt.create({
      data: {
        orderId: order.id,
        provider: this.provider.name,
        amount: order.total,
        currency: PAYMENT_CURRENCY,
        providerRef: event.providerRef,
      },
    });
    const applied = await this.confirmPaid(order.id, attempt.id, event.providerRef);
    if (applied) await this.notifyConfirmed(order.id);
    return { applied };
  }

  /** Conditional PENDING_PAYMENT -> CONFIRMED transition, in one transaction. */
  private async confirmPaid(orderId: string, attemptId: string, providerRef: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED', paymentRef: providerRef, paymentClaimedAt: null },
      });
      await tx.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: 'SUCCEEDED', providerRef },
      });
      return updated.count === 1;
    });
  }

  private alreadyProcessed(order: { id: string; status: string; paymentRef: string | null }): ChargeResponse {
    const paidStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    if (paidStatuses.includes(order.status) && order.paymentRef) {
      return { success: true, orderId: order.id, status: order.status, transactionId: order.paymentRef, alreadyPaid: true };
    }
    throw shopConflict('ORDER_NOT_PAYABLE', 'Order is not awaiting payment');
  }

  private async notifyConfirmed(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({ where: { id: orderId } });
      if (!order) return;
      await this.notifier.orderConfirmed({
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        userId: order.userId,
        total: order.total.toString(),
        currency: PAYMENT_CURRENCY,
      });
    } catch (err) {
      this.logger.error(`order notifier failed for ${orderId}: ${(err as Error)?.message}`);
    }
  }
}
