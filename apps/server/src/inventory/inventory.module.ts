import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { InventoryController } from './inventory.controller';
import { StockAlertsService } from './stock-alerts.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [InventoryController],
  providers: [StockAlertsService],
  exports: [StockAlertsService],
})
export class InventoryModule {}
