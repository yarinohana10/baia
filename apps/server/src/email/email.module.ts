import { Global, Module, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, emailService } from './email.service';
import { PrismaEmailStore } from './email-store';

/**
 * Global so any feature module (e.g. orders, for order confirmations) can
 * inject `EmailService` without importing this module explicitly.
 *
 * The service is the process-wide singleton (better-auth uses it too); on
 * start-up it is pointed at the app's PrismaService for the footer details
 * (SiteConfig) and the email log.
 */
@Global()
@Module({
  providers: [{ provide: EmailService, useValue: emailService }],
  exports: [EmailService],
})
export class EmailModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    emailService.setStore(new PrismaEmailStore(this.prisma));
  }

  onModuleDestroy() {
    // Late fire-and-forget sends must not reopen a closed connection.
    emailService.setStore(null);
  }
}
