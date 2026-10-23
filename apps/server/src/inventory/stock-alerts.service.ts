import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { EmailTemplateData } from '../email/templates';

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');

/** Fallback when SiteConfig has no row yet (matches the schema default). */
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

/**
 * Low-stock and sold-out alerts to the store inbox.
 *
 * Each crossing emails once: the first call that sees a variant at or under
 * the threshold claims lowStockNotifiedAt with a guarded UPDATE (only the
 * caller whose UPDATE matched a row sends), likewise soldOutNotifiedAt at 0.
 * Markers are cleared when stock is back above the threshold (sold-out marker
 * also when restocked from 0 but still low), so the next drop alerts again.
 */
@Injectable()
export class StockAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Store inbox: ADMIN_NOTIFY_EMAIL, else SiteConfig.contactEmail. */
  private async inbox(): Promise<string | null> {
    const env = process.env.ADMIN_NOTIFY_EMAIL?.trim();
    if (env) return env;
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' }, select: { contactEmail: true } });
    return config?.contactEmail?.trim() || null;
  }

  async lowStockThreshold(): Promise<number> {
    const config = await this.prisma.siteConfig.findUnique({ where: { id: 'default' }, select: { lowStockThreshold: true } });
    return config?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  }

  /** Call after any stock change (decrement or restock). Never throws; safe to `void`. */
  async notifyAfterStockChange(variantIds: string[]): Promise<void> {
    try {
      const ids = [...new Set(variantIds)];
      if (!ids.length) return;
      const threshold = await this.lowStockThreshold();
      const variants = await this.prisma.productVariant.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          sku: true,
          color: true,
          size: true,
          stockQuantity: true,
          trackInventory: true,
          lowStockNotifiedAt: true,
          soldOutNotifiedAt: true,
          product: { select: { id: true, nameHe: true } },
        },
      });
      for (const v of variants) {
        try {
          await this.handle(v, threshold);
        } catch (err) {
          console.error(`[inventory] stock alert failed for variant ${v.id}: ${(err as Error)?.message}`);
        }
      }
    } catch (err) {
      console.error(`[inventory] stock alerts failed: ${(err as Error)?.message}`);
    }
  }

  private async handle(
    v: {
      id: string;
      sku: string;
      color: string;
      size: string;
      stockQuantity: number;
      trackInventory: boolean;
      lowStockNotifiedAt: Date | null;
      soldOutNotifiedAt: Date | null;
      product: { id: string; nameHe: string };
    },
    threshold: number,
  ) {
    const stock = v.stockQuantity;
    const low = v.trackInventory && stock <= threshold;

    if (!low) {
      if (v.lowStockNotifiedAt || v.soldOutNotifiedAt) {
        await this.prisma.productVariant.updateMany({
          where: { id: v.id, OR: [{ lowStockNotifiedAt: { not: null } }, { soldOutNotifiedAt: { not: null } }] },
          data: { lowStockNotifiedAt: null, soldOutNotifiedAt: null },
        });
      }
      return;
    }

    const now = new Date();
    const data = {
      productName: v.product.nameHe,
      color: v.color,
      size: v.size,
      sku: v.sku,
      remaining: Math.max(0, stock),
      adminUrl: `${clientUrl()}/he/admin/products/${v.product.id}`,
    };

    if (stock <= 0) {
      const claimed = await this.prisma.productVariant.updateMany({
        where: { id: v.id, soldOutNotifiedAt: null },
        data: { soldOutNotifiedAt: now, lowStockNotifiedAt: v.lowStockNotifiedAt ?? now },
      });
      if (claimed.count === 1) await this.send('admin-sold-out', data);
      return;
    }

    // Back above zero but still low: the next sell-out must alert again.
    if (v.soldOutNotifiedAt) {
      await this.prisma.productVariant.updateMany({ where: { id: v.id }, data: { soldOutNotifiedAt: null } });
    }
    const claimed = await this.prisma.productVariant.updateMany({
      where: { id: v.id, lowStockNotifiedAt: null },
      data: { lowStockNotifiedAt: now },
    });
    if (claimed.count === 1) await this.send('admin-low-stock', { ...data, threshold });
  }

  private async send<K extends 'admin-low-stock' | 'admin-sold-out'>(name: K, data: EmailTemplateData[K]) {
    const to = await this.inbox();
    if (!to) {
      console.warn('[inventory] no ADMIN_NOTIFY_EMAIL / contactEmail configured - stock alert not emailed');
      return;
    }
    await this.email.dispatch(name, { to, locale: 'he', data });
  }
}
