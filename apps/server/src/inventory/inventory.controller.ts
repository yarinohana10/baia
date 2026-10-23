import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { StockAlertsService } from './stock-alerts.service';

@Controller()
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: StockAlertsService,
  ) {}

  /** In-panel stock alerts: tracked variants of non-hidden products at or under the threshold, lowest first. */
  @Get('admin/inventory/alerts')
  @UseGuards(AuthGuard)
  @Roles('ADMIN')
  async list() {
    const threshold = await this.alerts.lowStockThreshold();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        trackInventory: true,
        isActive: true,
        stockQuantity: { lte: threshold },
        product: { isActive: true },
      },
      orderBy: [{ stockQuantity: 'asc' }, { updatedAt: 'desc' }],
      take: 200,
      select: {
        id: true,
        sku: true,
        color: true,
        size: true,
        stockQuantity: true,
        product: { select: { id: true, nameHe: true, nameEn: true } },
      },
    });
    return {
      threshold,
      items: variants.map((v) => ({
        variantId: v.id,
        productId: v.product.id,
        productNameHe: v.product.nameHe,
        productNameEn: v.product.nameEn,
        color: v.color,
        size: v.size,
        sku: v.sku,
        remaining: v.stockQuantity,
        soldOut: v.stockQuantity <= 0,
      })),
    };
  }
}
