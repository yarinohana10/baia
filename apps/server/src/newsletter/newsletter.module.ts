import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';

@Module({
  imports: [AuthModule],
  controllers: [],
  providers: [RateLimitGuard],
})
export class NewsletterModule {}
