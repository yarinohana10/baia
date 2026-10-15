export * from './email.types';
export {
  EmailService,
  emailService,
  normalizeLocale,
  createEmailServiceFromEnv,
  createEmailTransportFromEnv,
} from './email.service';
export type { SendTemplateOptions } from './email.service';
export { EmailModule } from './email.module';
export { renderTemplate, templates } from './templates';
export type { EmailTemplateData, EmailTemplateName, EmailTemplate } from './templates';
export { SmtpEmailTransport } from './transports/smtp.transport';
export { ConsoleEmailTransport, MemoryEmailTransport } from './transports/console.transport';
