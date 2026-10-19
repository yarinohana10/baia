import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type { ContactMessageStatus, Prisma } from '../generated/prisma';
import type { CreateContactMessageDto } from './dto/contact.dto';

const clientUrl = () => (process.env.CLIENT_URL || 'http://localhost:3000').split(',')[0].trim().replace(/\/$/, '');

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  /** Store inbox: the configured contact email, else ADMIN_NOTIFY_EMAIL. */
  private async storeInbox(): Promise<string | null> {
    const config = await this.prisma.siteConfig.findUnique({
      where: { id: 'default' },
      select: { contactEmail: true },
    });
    return config?.contactEmail?.trim() || process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
  }

  async create(dto: CreateContactMessageDto) {
    const locale = dto.locale ?? 'he';
    const saved = await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone ?? null,
        orderNumber: dto.orderNumber ?? null,
        subject: dto.subject ?? null,
        message: dto.message,
        locale,
      },
    });

    const inbox = await this.storeInbox();
    const base = clientUrl();
    if (inbox) {
      void this.email.dispatch('contact-notification', {
        to: inbox,
        locale: 'he',
        replyTo: dto.email,
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          orderNumber: dto.orderNumber,
          subject: dto.subject,
          message: dto.message,
          locale,
          adminUrl: `${base}/he/admin/messages`,
        },
      });
    } else {
      console.warn('[contact] no contactEmail / ADMIN_NOTIFY_EMAIL configured - store not notified');
    }
    void this.email.dispatch('contact-auto-reply', {
      to: dto.email,
      locale,
      replyTo: inbox ?? undefined,
      data: { name: dto.name, message: dto.message, shopUrl: `${base}/${locale}` },
    });

    return { id: saved.id };
  }

  async findAll(params: { status?: ContactMessageStatus; search?: string; page: number; limit: number }) {
    const where: Prisma.ContactMessageWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      const q = params.search;
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [messages, total, newCount] = await this.prisma.$transaction([
      this.prisma.contactMessage.findMany({
        where,
        // NEW sorts before HANDLED (enum order), newest first within each.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.contactMessage.count({ where }),
      this.prisma.contactMessage.count({ where: { status: 'NEW' } }),
    ]);
    return {
      messages,
      total,
      newCount,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  async count(status?: ContactMessageStatus) {
    const count = await this.prisma.contactMessage.count({ where: status ? { status } : {} });
    return { count };
  }

  async updateStatus(id: string, status: ContactMessageStatus) {
    const existing = await this.prisma.contactMessage.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Contact message not found');
    return this.prisma.contactMessage.update({ where: { id }, data: { status } });
  }
}
