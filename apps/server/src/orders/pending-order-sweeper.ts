import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { OrdersService } from './orders.service';

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_TTL_MINUTES = 60;

/** Minutes an unpaid order holds its stock; 0 disables the sweep. */
export function pendingOrderTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.PENDING_ORDER_TTL_MINUTES;
  const minutes = raw === undefined || raw === '' ? DEFAULT_TTL_MINUTES : Number(raw);
  return Number.isFinite(minutes) && minutes > 0 ? minutes * 60 * 1000 : 0;
}

/** Periodically releases stock held by abandoned (never paid) orders. */
@Injectable()
export class PendingOrderSweeper implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PendingOrderSweeper.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly orders: OrdersService) {}

  onApplicationBootstrap() {
    const ttl = pendingOrderTtlMs();
    if (!ttl || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.sweep(ttl), SWEEP_INTERVAL_MS);
    this.timer.unref();
    void this.sweep(ttl);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async sweep(ttl: number) {
    try {
      const released = await this.orders.releaseExpiredPendingOrders(ttl);
      if (released > 0) this.logger.log(`Cancelled ${released} unpaid order(s) and returned their stock`);
    } catch (err) {
      this.logger.warn(`Pending order sweep failed: ${err}`);
    }
  }
}
