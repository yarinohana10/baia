import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ensureAdmin, EnsureAdminError } from './ensure-admin';

const ADMIN_SELECT = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  role: true,
  createdAt: true,
} as const;

export interface CreateAdminInput {
  email: string;
  name?: string;
  password?: string;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  listAdmins() {
    return this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: ADMIN_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Promote an existing user (by email) or create a new admin account.
   * A password is only required (and only used) when the user doesn't exist;
   * an existing user's password is never changed here.
   */
  async createOrPromote(input: CreateAdminInput) {
    try {
      const result = await ensureAdmin(this.prisma, {
        email: input.email,
        name: input.name,
        password: input.password,
        resetPassword: false,
      });
      const user = await this.prisma.user.findUnique({ where: { id: result.userId }, select: ADMIN_SELECT });
      return { action: result.action, user };
    } catch (err) {
      if (err instanceof EnsureAdminError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  /**
   * Remove admin access (role -> CUSTOMER). The account itself is kept.
   * Refuses to remove the last remaining admin. Runs serializable so two
   * concurrent demotions can't both pass the count check.
   */
  async revokeAdmin(userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: ADMIN_SELECT });
        if (!user) throw new NotFoundException('User not found');
        if (user.role !== 'ADMIN') throw new BadRequestException('User is not an admin');

        const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          throw new ConflictException('Cannot remove the last admin');
        }

        return tx.user.update({ where: { id: userId }, data: { role: 'CUSTOMER' }, select: ADMIN_SELECT });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
