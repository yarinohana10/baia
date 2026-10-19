import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { NewsletterSubscriber, Prisma } from '../generated/prisma';
import type { NewsletterSource } from './dto/newsletter.dto';

export type SubscriberFilter = { search?: string; activeOnly?: boolean };

/** Neutralise spreadsheet formulas (CSV injection) and quote every cell. */
export function csvCell(value: string | null | undefined): string {
  let v = value ?? '';
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent opt-in. A returning (previously unsubscribed) address is
   * re-activated with a fresh consent timestamp. The matching account, if any,
   * is marked as consenting too so the account toggle tells the truth.
   */
  async subscribe(email: string, opts: { locale?: string; source: NewsletterSource }) {
    const now = new Date();
    await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, locale: opts.locale ?? 'he', source: opts.source, consentAt: now },
      update: {
        unsubscribedAt: null,
        consentAt: now,
        ...(opts.locale ? { locale: opts.locale } : {}),
      },
    });
    await this.prisma.user.updateMany({
      where: { email, marketingConsent: false },
      data: { marketingConsent: true, marketingConsentAt: now },
    });
    return { subscribed: true };
  }

  /** Always succeeds (no account/subscriber enumeration). */
  async unsubscribe(email: string) {
    const now = new Date();
    await this.prisma.newsletterSubscriber.updateMany({
      where: { email, unsubscribedAt: null },
      data: { unsubscribedAt: now },
    });
    await this.prisma.user.updateMany({
      where: { email, marketingConsent: true },
      data: { marketingConsent: false, marketingConsentAt: now },
    });
    return { ok: true };
  }

  async getMine(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { marketingConsent: true, marketingConsentAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async setMine(userId: string, consent: boolean, opts: { locale?: string; source?: NewsletterSource }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new NotFoundException('User not found');
    const email = user.email.toLowerCase();
    if (consent) {
      await this.subscribe(email, { locale: opts.locale, source: opts.source ?? 'account' });
    } else {
      await this.unsubscribe(email);
    }
    // The user row may store a differently-cased email; set the flag by id as well.
    await this.prisma.user.update({
      where: { id: userId },
      data: { marketingConsent: consent, marketingConsentAt: new Date() },
    });
    return this.getMine(userId);
  }

  private where(filter: SubscriberFilter): Prisma.NewsletterSubscriberWhereInput {
    const where: Prisma.NewsletterSubscriberWhereInput = {};
    if (filter.activeOnly) where.unsubscribedAt = null;
    if (filter.search) where.email = { contains: filter.search, mode: 'insensitive' };
    return where;
  }

  async findAll(filter: SubscriberFilter & { page: number; limit: number }) {
    const where = this.where(filter);
    const [subscribers, total, activeCount] = await this.prisma.$transaction([
      this.prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filter.page - 1) * filter.limit,
        take: filter.limit,
      }),
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.count({ where: { unsubscribedAt: null } }),
    ]);
    return {
      subscribers,
      total,
      activeCount,
      page: filter.page,
      limit: filter.limit,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    };
  }

  /** UTF-8 CSV with BOM so Excel shows Hebrew correctly. */
  async exportCsv(filter: SubscriberFilter): Promise<string> {
    const rows: NewsletterSubscriber[] = await this.prisma.newsletterSubscriber.findMany({
      where: this.where(filter),
      orderBy: { createdAt: 'asc' },
    });
    const header = ['email', 'locale', 'source', 'status', 'consent_at', 'unsubscribed_at', 'created_at'];
    const lines = rows.map((r) =>
      [
        r.email,
        r.locale,
        r.source,
        r.unsubscribedAt ? 'unsubscribed' : 'active',
        r.consentAt.toISOString(),
        r.unsubscribedAt?.toISOString() ?? '',
        r.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(','),
    );
    return `\uFEFF${[header.join(','), ...lines].join('\r\n')}\r\n`;
  }
}
