import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { LOCALE_HEADER } from '../auth/auth.config';
import { EMAIL_LOCALES, DEFAULT_EMAIL_LOCALE, type EmailLocale } from '../email/email.types';
import { isOwnerEmail } from '../auth/verified-email-grants';
import { AdminUsersService } from './admin-users.service';

export const addAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

type SessionUser = { id: string; email: string; name?: string | null; emailVerified?: boolean };

/** Only the Owner (verified, matching OWNER_EMAIL) may change who is an Admin. */
function requireOwner(req: Request): SessionUser {
  const user = (req as Request & { user?: SessionUser }).user;
  if (!user || !user.emailVerified || !isOwnerEmail(user.email)) {
    throw new ForbiddenException('Only the Owner can manage admins');
  }
  return user;
}

function requestLocale(req: Request): EmailLocale {
  const header = req.header(LOCALE_HEADER)?.toLowerCase();
  return EMAIL_LOCALES.includes(header as EmailLocale) ? (header as EmailLocale) : DEFAULT_EMAIL_LOCALE;
}

@Controller('admin/users')
@UseGuards(AuthGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  /** Admins and pending invitations; any admin may read, only the Owner can change them (canManage). */
  @Get()
  list(@Req() req: Request) {
    const user = (req as Request & { user?: SessionUser }).user;
    return this.adminUsers.list(!!user?.emailVerified && isOwnerEmail(user.email));
  }

  /** Owner only: promote a verified user, or invite an email that has no verified Account yet. */
  @Post()
  add(@Req() req: Request, @Body() body: unknown) {
    const owner = requireOwner(req);
    const parsed = addAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`));
    }
    return this.adminUsers.add({ email: parsed.data.email, inviter: owner, locale: requestLocale(req) });
  }

  /** Owner only: revoke a pending invitation. */
  @Delete('invitations/:id')
  @HttpCode(200)
  revokeInvitation(@Req() req: Request, @Param('id') id: string) {
    const owner = requireOwner(req);
    return this.adminUsers.revokeInvitation(id, owner.email);
  }

  /** Owner only: remove admin access (keeps the account, ends their sessions). */
  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: Request, @Param('id') id: string) {
    const owner = requireOwner(req);
    return this.adminUsers.remove(id, owner.email);
  }
}
