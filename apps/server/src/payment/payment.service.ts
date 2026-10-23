import {
  BadRequestException,
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
import {
  PAYMENT_PROVIDER,
  type PaymentMethod,
  type PaymentProvider,
  type PaymentResult,
} from './payment.interface';
import { MAX_INSTALLMENTS, type PayDto } from './dto/charge.dto';
import { paymentsEnabled } from './payments-enabled';
import { RefundsService } from '../orders/refunds.service';
import { recordStatusEvent } from '../orders/status-events';
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

/** What the storefront's payment page needs to know (GET /payment/config). */
export type PaymentConfig = {
  /** PAYMENTS_ENABLED (read at request time). Off: no orders, no payments; the storefront shows "Payments coming soon". */
  enabled: boolean;
  provider: string;
  /** No money moves: show the test banner and test cards; `simulation` is accepted. */
  testMode: boolean;
  methods: PaymentMethod[];
  installments: { max: number; minTotal: number };
};

/** Order total from which the shopper may split a card payment (PAYMENT_INSTALLMENTS_MIN_TOTAL, default ₪300). */
export function installmentsMinTotal(env: Record<string, string | undefined> = process.env): number {
  const v = Number(env.PAYMENT_INSTALLMENTS_MIN_TOTAL);
  return Number.isFinite(v) && v >= 0 && env.PAYMENT_INSTALLMENTS_MIN_TOTAL?.trim() ? v : 300;
}

/** Stored on the order once it is paid; the provider's report of how the money was taken. */
type PaymentDetails = {
  paymentMethod: PaymentMethod | null;
  paymentInstallments: number | null;
  cardBrand: string | null;
  cardLast4: string | null;
};

/** What the shopper asked for (validated PayDto); the provider's result is what gets stored. */
type PaymentRequest = { method: PaymentMethod | null; installments: number | null };

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(ORDER_NOTIFIER) private readonly notifier: OrderNotifier,
    private readonly refunds: RefundsService,
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
  async charge(
    orderId: string,
    requester: OrderRequester,
    ipAddress?: string,
    input: PayDto = {},
  ): Promise<ChargeResponse> {
    await this.orders.assertAccess(orderId, requester, { allowAdmin: false });

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found');

    if (order.status !== 'PENDING_PAYMENT') {
      return this.alreadyProcessed(order);
    }

    const requested = this.validateRequest(input, Number(order.total));

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
        method: requested.method ?? undefined,
        installments: requested.installments ?? undefined,
        ...(input.simulation ? { simulation: input.simulation } : {}),
        // Test providers have no processor to report the card, so they echo what the page displays.
        ...(this.provider.testMode && (input.cardBrand || input.cardLast4)
          ? { displayHint: { cardBrand: input.cardBrand, cardLast4: input.cardLast4 } }
          : {}),
      });
    } catch (err) {
      this.logger.error(`provider error for attempt ${attempt.id}: ${(err as Error)?.message}`);
      result = { success: false, transactionId: '', error: 'Payment provider error', errorCode: 'provider_error' };
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
      throw new HttpException(
        {
          statusCode: 402,
          message: 'Payment was declined',
          success: false,
          // Stable reason the storefront translates ("card declined", "insufficient funds").
          declineCode: result.errorCode ?? 'declined',
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const confirmed = await this.confirmPaid(
      orderId,
      attempt.id,
      result.transactionId,
      order.customerEmail,
      this.storedDetails(requested, result),
    );
    if (!confirmed) {
      // The order left PENDING_PAYMENT while we were charging (e.g. an admin
      // cancelled it). Money moved but the order is not payable: refund, and
      // keep a durable Refund record if the provider cannot do it right now.
      this.logger.error(`order ${orderId} not pending after successful charge; refunding attempt ${attempt.id}`);
      await this.prisma.paymentAttempt.update({
        where: { id: attempt.id },
        data: { error: 'ORDER_NOT_PENDING_AFTER_CHARGE_REFUND_REQUESTED' },
      });
      await this.refunds.refundLateCharge(orderId, order.total, result.transactionId);
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
    const applied = await this.confirmPaid(order.id, attempt.id, event.providerRef, null);
    if (applied) await this.notifyConfirmed(order.id);
    return { applied };
  }

  /** Provider name and mode for the storefront's payment page. */
  config(): PaymentConfig {
    return {
      enabled: paymentsEnabled(),
      provider: this.provider.name,
      testMode: this.simulationEnabled(),
      methods: ['card', 'bit', 'apple_pay'],
      installments: { max: MAX_INSTALLMENTS, minTotal: installmentsMinTotal() },
    };
  }

  /**
   * Test cards (`simulation`) are honoured only while a test-mode provider
   * (the mock) is bound, and never in production — even a staging deploy
   * that runs the mock with NODE_ENV=production gets plain "always succeeds".
   */
  simulationEnabled(): boolean {
    return this.provider.testMode === true && process.env.NODE_ENV !== 'production';
  }

  /** Admin: how an order was paid plus every provider attempt, newest first. */
  async paymentsForAdmin(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        paymentRef: true,
        paidAt: true,
        paymentMethod: true,
        paymentInstallments: true,
        cardBrand: true,
        cardLast4: true,
        paymentAttempts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            provider: true,
            status: true,
            amount: true,
            currency: true,
            providerRef: true,
            error: true,
            createdAt: true,
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const { paymentAttempts, ...rest } = order;
    return { ...rest, attempts: paymentAttempts };
  }

  /**
   * Validates what the payment page asked for. Installments only apply to
   * card payments at or above the configured minimum.
   */
  private validateRequest(input: PayDto, total: number): PaymentRequest {
    if (input.simulation && !this.simulationEnabled()) {
      throw new BadRequestException('Payment simulation is not available');
    }
    const method = input.method ?? null;
    const installments = input.installments ?? 1;
    if (installments > 1 && (method !== 'card' || total < installmentsMinTotal())) {
      throw new BadRequestException('Installments are not available for this payment');
    }
    // Older clients (and API users) send no details: nothing is recorded.
    if (!method) return { method: null, installments: null };
    return { method, installments: method === 'card' ? installments : null };
  }

  /**
   * What gets stored on the order: the provider's own report. Card brand and
   * last four are never taken from the browser; only the method/installments
   * the shopper chose fill in what a provider does not echo back.
   */
  private storedDetails(requested: PaymentRequest, result: PaymentResult): PaymentDetails {
    const reported = result.details ?? {};
    const method = reported.method ?? requested.method;
    const card = method === 'card' || (method === 'apple_pay' && !!reported.cardLast4);
    return {
      paymentMethod: method,
      paymentInstallments: method === 'card' ? (reported.installments ?? requested.installments) : null,
      cardBrand: card ? (reported.cardBrand ?? null) : null,
      cardLast4: card ? (reported.cardLast4 ?? null) : null,
    };
  }

  /** Conditional PENDING_PAYMENT -> CONFIRMED transition, in one transaction. `actorEmail` null = system (webhook). */
  private async confirmPaid(
    orderId: string,
    attemptId: string,
    providerRef: string,
    actorEmail: string | null,
    details?: PaymentDetails,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED', paymentRef: providerRef, paymentClaimedAt: null, paidAt: new Date(), ...details },
      });
      await tx.paymentAttempt.update({
        where: { id: attemptId },
        data: { status: 'SUCCEEDED', providerRef },
      });
      if (updated.count === 1) await recordStatusEvent(tx, orderId, 'PENDING_PAYMENT', 'CONFIRMED', actorEmail);
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
