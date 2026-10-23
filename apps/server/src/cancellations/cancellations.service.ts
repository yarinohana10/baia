import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { OrderMailer } from '../orders/order-mailer';
import { CancellationStatus, OrderStatus, Prisma, RefundStatus } from '../generated/prisma';
import { shopBadRequest, shopConflict } from '../common/error-codes';
import { suggestedCancellationFee } from '../orders/cancellation-eligibility';
import { PAID_STATUSES, RESTOCK_STATUSES } from '../orders/order-status';
import type {
  AdminCancelOrderDto,
  CancellationRequestDto,
  PublicCancellationDto,
  ResolveCancellationDto,
  SelfCancelDto,
} from './dto/cancellation.dto';

const round2 = (n: number) => Math.round(n * 100) / 100;

type CancelOutcome = {
  paid: boolean;
  /** What goes back to the customer (total - fee); null when nothing was paid or nothing is owed. */
  refundAmount: number | null;
  /** The provider did not settle it: the Refund stays PENDING for an Admin. */
  refundPending: boolean;
};

/**
 * Order cancellations:
 *  - self-service: until the order ships (pending payment, confirmed,
 *    processing) the customer cancels instantly; a paid order is refunded in
 *    full;
 *  - requests: once shipped or delivered the parcel must come back, so the
 *    customer files a request with contact details, which the store reviews
 *    and approves with an optional fee (legal cap: 5% or ₪100, the lower) or
 *    rejects.
 * Every cancellation goes through OrdersService.changeStatus, so stock and
 * coupon uses are returned exactly once and a paid order gets its durable
 * Refund record (settled by the payment provider, see RefundsService).
 */
@Injectable()
export class CancellationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly mailer: OrderMailer,
  ) {}

  /** Cancels the order (restock) and, when it was paid, records and attempts the refund of total - fee. */
  private async cancelAndRefund(orderId: string, fee: number, actorEmail: string | null, refund = true): Promise<CancelOutcome> {
    const before = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!before) throw new NotFoundException('Order not found');
    if (RESTOCK_STATUSES.includes(before.status)) {
      throw shopConflict('CANCELLATION_NOT_ALLOWED', 'Order is already cancelled');
    }
    const paid = PAID_STATUSES.includes(before.status);
    const total = Number(before.total);
    if (fee > total) throw shopBadRequest('CANCELLATION_NOT_ALLOWED', 'Fee cannot exceed the order total');

    const amount = paid && refund ? round2(total - fee) : 0;
    // The conditional status claim inside makes a concurrent ship / second
    // cancel fail instead of refunding twice.
    const result = await this.orders.changeStatus(orderId, OrderStatus.CANCELLED, undefined, {
      notify: false,
      actorEmail,
      refundAmount: amount,
    });
    if (!result.refund) return { paid, refundAmount: null, refundPending: false };
    return { paid, refundAmount: amount, refundPending: result.refund.status !== RefundStatus.COMPLETED };
  }

  /** Instant, free cancellation by the order's owner (ownership already checked). */
  async selfCancel(orderId: string, input: SelfCancelDto) {
    const order = await this.orders.findForCustomer(orderId);
    if (!order.cancellation.canSelfCancel) {
      throw shopConflict('SELF_CANCEL_UNAVAILABLE', 'This order can no longer be cancelled online');
    }
    const outcome = await this.cancelAndRefund(orderId, 0, order.customerEmail);
    await this.prisma.cancellationRequest.create({
      data: {
        orderId,
        status: CancellationStatus.AUTO_CANCELLED,
        reason: input.reason,
        details: input.details,
        feeAmount: 0,
        refundAmount: outcome.refundAmount,
        adminNote: outcome.refundPending ? 'Refund pending: settle it in the payment provider.' : null,
        resolvedAt: new Date(),
      },
    });

    void this.mailer.orderCancelled(orderId, outcome.paid, {
      cancelledBy: 'customer',
      refundAmount: outcome.refundAmount,
      refundPending: outcome.refundPending,
      reason: input.reason,
      details: input.details,
    });
    return this.orders.findForCustomer(orderId);
  }

  /** A cancellation the store reviews: the order has shipped, so the parcel must be returned. */
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
    void this.mailer.cancellationRequested(request.id, order.cancellation.requiresReturn);
    return this.orders.findForCustomer(orderId);
  }

  /**
   * Public /cancel-order form. Proves the order with number + email (same
   * constant 404 as the lookup), then cancels instantly while the order has
   * not shipped, otherwise files a request. Returns a signed access token so the
   * page can link to the order.
   */
  async publicCancel(input: PublicCancellationDto) {
    const { orderId, accessToken } = await this.orders.lookup(input.orderNumber, input.email);
    const order = await this.orders.findForCustomer(orderId);
    const { canSelfCancel, canRequest, openRequest } = order.cancellation;

    let outcome: 'CANCELLED' | 'REQUESTED';
    let updated;
    if (canSelfCancel) {
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
    const [rows, total] = await Promise.all([
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
    ]);

    const requests = rows.map(({ order, ...request }) => {
      const { paymentRef, ...publicOrder } = order;
      return {
        ...request,
        order: { ...publicOrder, paid: PAID_STATUSES.includes(order.status) || !!order.paidAt, hasPaymentRef: !!paymentRef },
        requiresReturn: !!order.shippedAt || order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED,
        // Requests only exist for shipped orders, so the capped fee always applies.
        suggestedFee: suggestedCancellationFee(Number(order.total)),
      };
    });
    return {
      requests,
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async resolve(id: string, input: ResolveCancellationDto, actorEmail: string | null = null) {
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
      outcome = await this.cancelAndRefund(request.orderId, fee, actorEmail);
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
        adminNote: outcome.refundPending
          ? [input.adminNote, 'Refund pending: settle it in the payment provider.'].filter(Boolean).join(' | ')
          : (input.adminNote ?? null),
      },
    });
    void this.mailer.orderCancelled(request.orderId, outcome.paid, {
      cancelledBy: 'request',
      refundAmount: outcome.refundAmount,
      feeAmount: fee > 0 ? fee : null,
      refundPending: outcome.refundPending,
      note: input.adminNote,
      reason: request.reason,
      details: request.details,
    });
    return { ...updated, refundPending: outcome.refundPending };
  }

  /** Admin cancels from the orders screen; resolves any open request as approved. */
  async adminCancelOrder(orderId: string, input: AdminCancelOrderDto, actorEmail: string | null = null) {
    const fee = round2(input.feeAmount ?? 0);
    const outcome = await this.cancelAndRefund(orderId, fee, actorEmail, input.refund);

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
      cancelledBy: 'admin',
      refundAmount: outcome.refundAmount,
      feeAmount: fee > 0 ? fee : null,
      refundPending: outcome.refundPending,
      note: input.adminNote,
    });
    return { ...(await this.orders.findForAdmin(orderId)), refundAmount: outcome.refundAmount, refundPending: outcome.refundPending };
  }
}
