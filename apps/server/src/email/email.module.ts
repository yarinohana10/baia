import { Global, Module } from '@nestjs/common';
import { EmailService, emailService } from './email.service';

/**
 * Global so any feature module (e.g. orders, for order confirmations) can
 * inject `EmailService` without importing this module explicitly.
 */
@Global()
@Module({
  providers: [{ provide: EmailService, useValue: emailService }],
  exports: [EmailService],
})
export class EmailModule {}
