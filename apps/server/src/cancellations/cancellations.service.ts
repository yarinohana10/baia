import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrderMailer } from '../orders/order-mailer';
import { CancellationStatus, OrderStatus, Prisma } from '../generated/prisma';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../payment/payment.interface';
import { shopBadRequest, shopConflict } from '../common/error-codes';
import { selfCancelDeadline, suggestedCancellationFee } from '../orders/cancellation-eligibility';
import { RESTOCK_STATUSES } from '../orders/order-status';
import type {
  AdminCancelOrderDto,
  CancellationRequestDto,
  PublicCancellationDto,
  ResolveCancellationDto,
  SelfCancelDto,
} from './dto/cancellation.dto';

const PAID_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PROCESSING,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

const round2 = (n: number) => Math.round(n * 100) / 100;

type CancelOutcome = { paid: boolean; refundAmount: number | null; refundFailed: boolean };

/**
 * Order cancellations:
 *  - self-service: paid (CONFIRMED/PROCESSING), not shipped, inside
 *    SiteConfig.selfCancelWindowHours of paidAt → cancelled + refunded in
 *    full at once (unpaid orders are simply cancelled);
 *  - requests: anything else the customer wants cancelled (after the window,
 *    already shipped = return) is reviewed by the store, which approves with
 *    an optional fee (legal cap: 5% or ₪100, the lower) or rejects.
 * Every cancellation goes through OrdersService.updateStatus, so stock and
 * coupon uses are returned exactly once.
 */
@Injectable()
export class CancellationsService {
  private readonly logger = new Logger(CancellationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly mailer: OrderMailer,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  /** Cancels the order (restock) and refunds total − fee when it was paid. */
  private async cancelAndRefund(orderId: string, fee: number): Promise<CancelOutcome> {
    const before = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!before) throw new NotFoundException('Order not found');
    if (RESTOCK_STATUSES.includes(before.status)) {
      throw shopConflict('CANCELLATION_NOT_ALLOWED', 'Order is already cancelled');
    }
    const paid = PAID_STATUSES.includes(before.status);
    const total = Number(before.total);
    if (fee > total) throw shopBadRequest('CANCELLATION_NOT_ALLOWED', 'Fee cannot exceed the order total');

    // Cancel first: the conditional status claim makes a concurrent ship /
    // second cancel fail instead of refunding twice.
    await this.orders.updateStatus(orderId, OrderStatus.CANCELLED, undefined, { notify: false });

    const amount = round2(total - fee);
    if (!paid || amount <= 0) return { paid, refundAmount: null, refundFailed: false };
    if (!before.paymentRef) {
      // Paid outside the provider (e.g. confirmed by hand): refund manually.
      return { paid, refundAmount: null, refundFailed: true };
    }
    try {
      const result = await this.provider.refund(before.paymentRef, amount);
      if (result.success) return { paid, refundAmount: amount, refundFailed: false };
      this.logger.error(`refund declined for order ${orderId}: ${result.error ?? 'unknown'}`);
    } catch (err) {
      this.logger.error(`refund failed for order ${orderId}: ${(err as Error)?.message}`);
    }
    return { paid, refundAmount: null, refundFailed: true };
  }

  /** Instant, free cancellation by the order's owner (ownership already checked). */
  async selfCancel(orderId: string, input: SelfCancelDto) {
    const order = await this.orders.findForCustomer(orderId);
    if (!order.cancellation.canSelfCancel) {
      throw shopConflict('SELF_CANCEL_UNAVAILABLE', 'This order can no longer be cancelled online');
    }
    const outcome = await this.cancelAndRefund(orderId, 0);
    await this.prisma.cancellationRequest.create({
      data: {
        orderId,
        status: CancellationStatus.AUTO_CANCELLED,
        reason: input.reason,
        details: input.details,
        feeAmount: 0,
        refundAmount: outcome.refundAmount,
        adminNote: outcome.refundFailed ? 'Automatic refund failed - refund manually.' : null,
        resolvedAt: new Date(),
      },
    });

    void this.mailer.orderCancelled(orderId, outcome.paid, {
      refundAmount: outcome.refundAmount,
      refundPending: outcome.refundFailed,
    });
    if (outcome.paid) {
      void this.mailer.adminSelfCancelled(orderId, {
        reason: input.reason,
        details: input.details,
        refundAmount: outcome.refundAmount,
        refundFailed: outcome.refundFailed,
      });
    }
    return this.orders.findForCustomer(orderId);
  }

  /** A cancellation the store reviews (after the window, shipped orders, or by choice). */
  async createRequest(orderId: string, input: CancellationRequestDto) {
    const order = await this.orders.findForCustomer(orderId);
    if (order.cancellation.openRequest) {
      throw shopConflict('CANCELLATION_ALREADY_REQUESTED', 'A cancellation request is already open for this order');
    }
    if (!order.cancellation.canRequest) {
      throw shopConflict('CANCELLATION_NOT_ALLOWED', 'This order cannot be cancelled');
    }
    const request = await this.prisma.cancellationRequest.create({
      data: {
        orderId,
        status: CancellationStatus.REQUESTED,
        reason: input.reason,
        details: input.details,
        contactPhone: input.contactPhone,
      },
    });
    const windowHours = order.cancellation.windowHours;
    const insideWindow = Date.now() < selfCancelDeadline(order, windowHours).getTime();
    void this.mailer.cancellationRequested(request.id, insideWindow, order.cancellation.requiresReturn);
    return this.orders.findForCustomer(orderId);
  }

  /**
   * Public /cancel-order form. Proves the order with number + email (same
   * constant 404 as the lookup), then cancels instantly when asked and
   * allowed, otherwise files a request. Returns a signed access token so the
   * page can link to the order.
   */
  async publicCancel(input: PublicCancellationDto) {
    const { orderId, accessToken } = await this.orders.lookup(input.orderNumber, input.email);
    const order = await this.orders.findForCustomer(orderId);
    const { canSelfCancel, canRequest, openRequest } = order.cancellation;

    let outcome: 'CANCELLED' | 'REQUESTED';
    let updated;
    if (canSelfCancel && (input.instant || !canRequest)) {
      updated = await this.selfCancel(orderId, input);
      outcome = 'CANCELLED';
    } else if (canRequest) {
      updated = await this.createRequest(orderId, input);
      outcome = 'REQUESTED';
    } else if (openRequest) {
      throw shopConflict('CANCELLATION_ALREADY_REQUESTED', 'A cancellation request is already open for this order');
    } else {
      throw shopConflict('CANCELLATION_NOT_ALLOWED', 'This order cannot be cancelled');
    }
    return { outcome, order: updated, accessToken };
  }

  // ─── Admin ────────────────────────────────────────────────

  async list(params: { status?: CancellationStatus; page: number; limit: number }) {
    const where: Prisma.CancellationRequestWhereInput = params.status ? { status: params.status } : {};
    const [rows, total, windowHours] = await Promise.all([
      this.prisma.cancellationRequest.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customerEmail: true,
              recipientName: true,
              phone: true,
              total: true,
              paymentRef: true,
              deliveryMethod: true,
              createdAt: true,
              paidAt: true,
              shippedAt: true,
              cancelledAt: true,
            },
          },
        },
        // Open requests first, oldest first within them (FIFO queue).
        orderBy: [{ createdAt: params.status === CancellationStatus.REQUESTED ? 'asc' : 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.cancellationRequest.count({ where }),
      this.orders.selfCancelWindowHours(),
    ]);

    const requests = rows.map(({ order, ...request }) => {
      const deadline = selfCancelDeadline(order, windowHours);
      const insideWindow = request.createdAt.getTime() < deadline.getTime();
      const { paymentRef, ...publicOrder } = order;
      return {
        ...request,
        order: { ...publicOrder, paid: PAID_STATUSES.includes(order.status) || !!order.paidAt, hasPaymentRef: !!paymentRef },
        windowDeadline: deadline.toISOString(),
        insideWindow,
        requiresReturn: !!order.shippedAt || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED,
        suggestedFee: insideWindow ? 0 : suggestedCancellationFee(Number(order.total)),
      };
    });
    return {
      requests,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
      windowHours,
    };
  }

  async resolve(id: string, input: ResolveCancellationDto) {
    const request = await this.prisma.cancellationRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Cancellation request not found');
    if (request.status !== CancellationStatus.REQUESTED) {
      throw new ConflictException('This request was already handled');
    }

    if (input.action === 'reject') {
      const claimed = await this.prisma.cancellationRequest.updateMany({
        where: { id, status: CancellationStatus.REQUESTED },
        data: { status: CancellationStatus.REJECTED, adminNote: input.adminNote ?? null, resolvedAt: new Date() },
      });
      if (claimed.count === 0) throw new ConflictException('This request was already handled');
      void this.mailer.cancellationRejected(id);
      return this.prisma.cancellationRequest.findUniqueOrThrow({ where: { id } });
    }

    const fee = round2(input.feeAmount ?? 0);
    // Claim the request first so two admins cannot approve (and refund) twice.
    const claimed = await this.prisma.cancellationRequest.updateMany({
      where: { id, status: CancellationStatus.REQUESTED },
      data: { status: CancellationStatus.APPROVED, resolvedAt: new Date(), feeAmount: fee, adminNote: input.adminNote ?? null },
    });
    if (claimed.count === 0) throw new ConflictException('This request was already handled');

    let outcome: CancelOutcome;
    try {
      outcome = await this.cancelAndRefund(request.orderId, fee);
    } catch (err) {
      // Put the request back so it can be retried (e.g. the order changed meanwhile).
      await this.prisma.cancellationRequest.update({
        where: { id },
        data: { status: CancellationStatus.REQUESTED, resolvedAt: null, feeAmount: 0 },
      });
      throw err;
    }
    const updated = await this.prisma.cancellationRequest.update({
      where: { id },
      data: {
        refundAmount: outcome.refundAmount,
        adminNote: outcome.refundFailed
          ? [input.adminNote, 'Automatic refund failed - refund manually.'].filter(Boolean).join(' | ')
          : (input.adminNote ?? null),
      },
    });
    void this.mailer.orderCancelled(request.orderId, outcome.paid, {
      refundAmount: outcome.refundAmount,
      feeAmount: fee > 0 ? fee : null,
      refundPending: outcome.refundFailed,
      note: input.adminNote,
    });
    return { ...updated, refundFailed: outcome.refundFailed };
  }

  /** Admin cancels from the orders screen; resolves any open request as approved. */
  async adminCancelOrder(orderId: string, input: AdminCancelOrderDto) {
    const fee = round2(input.feeAmount ?? 0);
    const before = await this.prisma.order.findUnique({ where: { id: orderId }, select: { status: true, paymentRef: true } });
    if (!before) throw new NotFoundException('Order not found');

    let outcome: CancelOutcome;
    if (input.refund) {
      outcome = await this.cancelAndRefund(orderId, fee);
    } else {
      if (RESTOCK_STATUSES.includes(before.status)) {
        throw shopConflict('CANCELLATION_NOT_ALLOWED', 'Order is already cancelled');
      }
      await this.orders.updateStatus(orderId, OrderStatus.CANCELLED, undefined, { notify: false });
      outcome = { paid: PAID_STATUSES.includes(before.status), refundAmount: null, refundFailed: false };
    }

    await this.prisma.cancellationRequest.updateMany({
      where: { orderId, status: CancellationStatus.REQUESTED },
      data: {
        status: CancellationStatus.APPROVED,
        resolvedAt: new Date(),
        feeAmount: fee,
        refundAmount: outcome.refundAmount,
        adminNote: input.adminNote ?? null,
      },
    });

    void this.mailer.orderCancelled(orderId, outcome.paid, {
      refundAmount: outcome.refundAmount,
      feeAmount: fee > 0 ? fee : null,
      // Without an automatic refund the store settles the money itself.
      refundPending: outcome.refundFailed,
      note: input.adminNote,
    });
    return { ...(await this.orders.findForAdmin(orderId)), refundAmount: outcome.refundAmount, refundFailed: outcome.refundFailed };
  }
}
