export * from './email.types';
export {
  EmailService,
  emailService,
  normalizeLocale,
  createEmailServiceFromEnv,
  createEmailTransportFromEnv,
  isTransientEmailError,
  retryDelaysFromEnv,
} from './email.service';
export type { SendTemplateOptions, SendResult, EmailServiceOptions } from './email.service';
export { EmailModule } from './email.module';
export { PrismaEmailStore, defaultBranding, mergeBranding } from './email-store';
export { renderTemplate, templates, TEMPLATE_REASONS, isCustomerFacing } from './templates';
export type { EmailTemplateData, EmailTemplateName, EmailTemplate } from './templates';
export { SmtpEmailTransport } from './transports/smtp.transport';
export { ConsoleEmailTransport, MemoryEmailTransport } from './transports/console.transport';
