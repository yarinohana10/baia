import { Controller, Post, Body, Inject, BadRequestException } from '@nestjs/common';
import { PaymentProvider, PAYMENT_PROVIDER } from './payment.interface';
import { PrismaService } from '../prisma/prisma.service';

@Controller('payment')
export class PaymentController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private payment: PaymentProvider,
    private prisma: PrismaService,
  ) {}

  @Post('charge')
  async charge(
    @Body()
    body: {
      orderId: string;
      customerEmail: string;
    },
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: body.orderId } });
    if (!order) throw new BadRequestException('Order not found');
    if (order.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Order is not pending payment');
    }

    const result = await this.payment.charge({
      amount: Number(order.total),
      currency: 'ILS',
      orderId: order.id,
      customerEmail: body.customerEmail,
    });

    if (result.success) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CONFIRMED',
          paymentRef: result.transactionId,
        },
      });
    }

    return result;
  }
}
