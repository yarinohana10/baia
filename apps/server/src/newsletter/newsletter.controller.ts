import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.guard';
import { strictValidationPipe } from '../common/validation';
import { clampInt, MAX_PAGE } from '../products/pagination';
import { NewsletterService, type SubscriberFilter } from './newsletter.service';
import { SubscribeDto, UnsubscribeDto, UpdateMyConsentDto } from './dto/newsletter.dto';

const MINUTE = 60_000;
export const NEWSLETTER_PAGE_LIMIT = { default: 50, max: 200 };

type AuthedRequest = Request & { user: { id: string } };

@Controller('newsletter')
@UseGuards(RateLimitGuard)
@UsePipes(strictValidationPipe)
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  subscribe(@Body() body: SubscribeDto) {
    return this.newsletter.subscribe(body.email, { locale: body.locale, source: body.source ?? 'footer' });
  }

  @Post('unsubscribe')
  @HttpCode(200)
  @RateLimit({ limit: 10, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  unsubscribe(@Body() body: UnsubscribeDto) {
    return this.newsletter.unsubscribe(body.email);
  }
}

/** The signed-in user's marketing consent (account page and sign-up). */
@Controller('newsletter/me')
@UseGuards(AuthGuard, RateLimitGuard)
@UsePipes(strictValidationPipe)
export class MyNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  get(@Req() req: AuthedRequest) {
    return this.newsletter.getMine(req.user.id);
  }

  @Put()
  @RateLimit({ limit: 20, windowMs: MINUTE })
  @Header('Cache-Control', 'no-store')
  set(@Req() req: AuthedRequest, @Body() body: UpdateMyConsentDto) {
    return this.newsletter.setMine(req.user.id, body.consent, { locale: body.locale, source: body.source });
  }
}

function filterFrom(search?: string, active?: string): SubscriberFilter {
  return {
    search: typeof search === 'string' && search.trim() ? search.trim().slice(0, 100) : undefined,
    activeOnly: active === 'true' || active === '1',
  };
}

@Controller('admin/newsletter')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  findAll(
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.newsletter.findAll({
      ...filterFrom(search, active),
      page: clampInt(page, 1, 1, MAX_PAGE),
      limit: clampInt(limit, NEWSLETTER_PAGE_LIMIT.default, 1, NEWSLETTER_PAGE_LIMIT.max),
    });
  }

  @Get('export.csv')
  async exportCsv(@Res() res: Response, @Query('search') search?: string, @Query('active') active?: string) {
    const csv = await this.newsletter.exportCsv(filterFrom(search, active));
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="baia-newsletter-${date}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  }
}
