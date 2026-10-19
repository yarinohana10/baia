import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { AdminNotificationsController } from './admin-notifications.controller';
import { AdminNotificationsService } from './admin-notifications.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminNotificationsController],
  providers: [AdminNotificationsService, RateLimitGuard],
})
export class AdminNotificationsModule {}
