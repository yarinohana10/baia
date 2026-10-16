import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { getOptionalUser } from '../common/session';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { extractOrderToken } from '../orders/order-access';
import { ChargeDto } from './dto/charge.dto';
import { PaymentService } from './payment.service';
import { PAYMENT_WEBHOOK_VERIFIER, type WebhookVerifier } from './webhook/webhook-verifier';

@Controller('payment')
@UseGuards(RateLimitGuard)
export class PaymentController {
  constructor(
    private readonly payments: PaymentService,
    @Optional() @Inject(PAYMENT_WEBHOOK_VERIFIER) private readonly webhookVerifier: WebhookVerifier | null,
  ) {}

  @Post('charge')
  @HttpCode(200)
  @UsePipes(strictValidationPipe)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @Header('Cache-Control', 'no-store')
  async charge(@Req() req: Request, @Body() body: ChargeDto) {
    const user = await getOptionalUser(req);
    const token = extractOrderToken(req, body.orderId);
    return this.payments.charge(body.orderId, { user, token }, req.ip);
  }

  /** Provider webhook — see webhook/webhook-verifier.ts for the design. */
  @Post('webhook')
  @HttpCode(200)
  @RateLimit({ limit: 120, windowMs: 60_000 })
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    if (!this.webhookVerifier) throw new NotFoundException();
    const event = req.rawBody ? this.webhookVerifier.verify(req.rawBody, req.headers) : null;
    if (!event) throw new BadRequestException('Invalid webhook');
    await this.payments.applyWebhookEvent(event);
    // Always 200 for authentic events so the provider does not retry forever.
    return { received: true };
  }
}

/**
 * `POST /orders/:id/pay`: same as `/payment/charge`, but under the order's
 * path, so a guest's httpOnly order cookie (Path=/v1/orders/:id) is sent.
 * This lets a guest who refreshed the confirmation page finish paying.
 */
@Controller('orders')
@UseGuards(RateLimitGuard)
export class OrderPaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post(':id/pay')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: 60_000 })
  @Header('Cache-Control', 'no-store')
  async pay(@Req() req: Request, @Param('id') id: string) {
    const user = await getOptionalUser(req);
    const token = extractOrderToken(req, id);
    return this.payments.charge(id, { user, token }, req.ip);
  }
}
