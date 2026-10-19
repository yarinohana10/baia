import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { PickupPointsController } from './pickup-points.controller';
import { PickupPointsService } from './pickup-points.service';

@Module({
  imports: [AuthModule],
  controllers: [PickupPointsController],
  providers: [PickupPointsService, RateLimitGuard],
  exports: [PickupPointsService],
})
export class PickupPointsModule {}
