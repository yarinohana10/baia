import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RateLimitGuard } from '../common/rate-limit.guard';
import { AdminContactController, ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [AuthModule],
  controllers: [ContactController, AdminContactController],
  providers: [RateLimitGuard, ContactService],
  exports: [ContactService],
})
export class ContactModule {}
