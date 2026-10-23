import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { getConfig } from '../config/env';
import { EmailService } from '../email/email.service';
import type { EmailLocale } from '../email/email.types';
import { isOwnerEmail, normalizeEmail } from '../auth/verified-email-grants';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  role: true,
  createdAt: true,
} as const;

export type AddAdminResult =
  | { action: 'promoted' | 'already-admin'; email: string }
  | { action: 'invited'; email: string; invitationId: string };

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async list(callerIsOwner: boolean) {
    const [admins, invitations] = await Promise.all([
      this.prisma.user.findMany({ where: { role: 'ADMIN' }, select: ADMIN_SELECT, orderBy: { createdAt: 'asc' } }),
      this.prisma.adminInvitation.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);
    return {
      admins: admins.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isOwner: isOwnerEmail(u.email),
        createdAt: u.createdAt,
      })),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        invitedByEmail: i.invitedByEmail,
        createdAt: i.createdAt,
      })),
      canManage: callerIsOwner,
    };
  }

  /**
   * Admin rights need a registered, email-verified Account. A verified user is
   * promoted at once; anyone else gets an Admin Invitation (and an email with
   * a register link) that applies when they register and verify that email.
   */
  async add(input: { email: string; inviter: { email: string; name?: string | null }; locale: EmailLocale }): Promise<AddAdminResult> {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, role: true, emailVerified: true },
    });

    if (user?.emailVerified) {
      if (user.role === 'ADMIN') return { action: 'already-admin', email };
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } }),
        this.prisma.adminInvitation.deleteMany({ where: { email } }),
      ]);
      this.logger.log(`AUDIT ${input.inviter.email} promoted ${email} to ADMIN`);
      return { action: 'promoted', email };
    }

    const invitation = await this.prisma.adminInvitation.upsert({
      where: { email },
      create: { email, invitedByEmail: input.inviter.email },
      update: {},
    });
    this.logger.log(`AUDIT ${input.inviter.email} invited ${email} as ADMIN`);
    await this.email.dispatch('admin-invitation', {
      to: email,
      locale: input.locale,
      data: {
        url: `${getConfig().clientUrl}/${input.locale}/register`,
        invitedBy: input.inviter.name?.trim() || input.inviter.email,
      },
    });
    return { action: 'invited', email, invitationId: invitation.id };
  }

  /**
   * Demote an admin to CUSTOMER (the account is kept) and revoke their
   * sessions so access ends immediately. The Owner can't be removed; the last
   * admin can't either. Serializable so concurrent removals can't both pass
   * the count check.
   */
  async remove(userId: string, actorEmail: string) {
    const removed = await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: ADMIN_SELECT });
        if (!user) throw new NotFoundException('User not found');
        if (user.role !== 'ADMIN') throw new BadRequestException('User is not an admin');
        if (isOwnerEmail(user.email)) throw new ForbiddenException('The Owner cannot be removed');

        const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) throw new ConflictException('Cannot remove the last admin');

        const updated = await tx.user.update({ where: { id: userId }, data: { role: 'CUSTOMER' }, select: ADMIN_SELECT });
        await tx.session.deleteMany({ where: { userId } });
        return updated;
      },
      { isolationLevel: 'Serializable' },
    );
    this.logger.log(`AUDIT ${actorEmail} removed ADMIN ${removed.email}`);
    return removed;
  }

  async revokeInvitation(id: string, actorEmail: string) {
    const { count } = await this.prisma.adminInvitation.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('Invitation not found');
    this.logger.log(`AUDIT ${actorEmail} revoked admin invitation ${id}`);
    return { revoked: true };
  }
}
