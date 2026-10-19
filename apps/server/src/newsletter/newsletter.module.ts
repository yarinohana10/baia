import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { AdminNewsletterController, MyNewsletterController, NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';

@Module({
  imports: [AuthModule],
  controllers: [NewsletterController, MyNewsletterController, AdminNewsletterController],
  providers: [RateLimitGuard, NewsletterService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
