import { Body, Controller, Get, Header, HttpCode, Param, Post, Put, Query, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { clampInt, MAX_PAGE } from '../products/pagination';
import type { ContactMessageStatus } from '../generated/prisma';
import { ContactService } from './contact.service';
import { CONTACT_STATUSES, CreateContactMessageDto, UpdateContactMessageDto } from './dto/contact.dto';

const MINUTE = 60_000;
export const CONTACT_PAGE_LIMIT = { default: 20, max: 100 };

function parseStatus(value: unknown): ContactMessageStatus | undefined {
  return typeof value === 'string' && (CONTACT_STATUSES as readonly string[]).includes(value)
    ? (value as ContactMessageStatus)
    : undefined;
}

/** Public contact form. */
@Controller('contact')
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @HttpCode(201)
  @RateLimit({ limit: 5, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  async create(@Body() body: CreateContactMessageDto) {
    // Honeypot filled in: pretend success so bots learn nothing, store nothing.
    if (body.website) return { ok: true };
    await this.contact.create(body);
    return { ok: true };
  }
}

/** Admin inbox for contact-form messages. */
@Controller('admin/contact-messages')
@UseGuards(AuthGuard)
@Roles('ADMIN')
@UsePipes(strictValidationPipe)
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contact.findAll({
      status: parseStatus(status),
      search: typeof search === 'string' && search.trim() ? search.trim().slice(0, 100) : undefined,
      page: clampInt(page, 1, 1, MAX_PAGE),
      limit: clampInt(limit, CONTACT_PAGE_LIMIT.default, 1, CONTACT_PAGE_LIMIT.max),
    });
  }

  @Get('count')
  @Header('Cache-Control', 'no-store')
  count(@Query('status') status?: string) {
    return this.contact.count(parseStatus(status));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateContactMessageDto) {
    return this.contact.updateStatus(id, body.status);
  }
}
